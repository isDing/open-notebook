"""In-process LLM generation jobs.

Chat generation runs as a detached asyncio task on the API process event
loop, decoupled from the HTTP request that submitted it. That means:

- the client can disconnect (page refresh, tab close) and the generation
  keeps running to completion, with the final message persisted to the
  LangGraph checkpoint as before;
- a client (re)attaches over SSE, which first replays every buffered event
  and then follows live, so a refreshed page resumes exactly where it left
  off;
- completed jobs are retained for a TTL so a late re-attach can still
  replay the result, then dropped (the final message is already in the
  checkpoint, so nothing is lost).

Limitation: jobs live in the API process. A full API restart drops
in-flight jobs; persisted history stays intact and the user simply re-asks.

Event protocol (SSE ``data:`` lines, one JSON object each):
- ``{"type": "delta", "content": str}`` — raw model token text. May contain
  `think` blocks; the frontend splits thinking vs. content for display.
- ``{"type": "context_indicators", "data": {...}}`` — source chat only.
- ``{"type": "complete", "message_id": str, "content": str, ...}`` —
  terminal; content is the final persisted AI message.
- ``{"type": "error", "message": str}`` — terminal.
"""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

from langchain_core.runnables import RunnableConfig
from loguru import logger

from open_notebook.exceptions import InvalidInputError
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content

# How long finished jobs stay attachable after they end.
COMPLETED_TTL_SECONDS = 600.0

# How often the SSE attach loop sends a keepalive comment while idle.
SSE_KEEPALIVE_SECONDS = 15.0


def _chunk_text(message: Any) -> str:
    """Extract plain text from a streamed LLM message chunk."""
    content = getattr(message, "content", message)
    text = extract_text_content(content)
    return text if isinstance(text, str) else str(text)


@dataclass
class GenerationJob:
    job_id: str
    session_id: str
    kind: str  # "notebook_chat" | "source_chat"
    input_state: Dict[str, Any]
    model_override: Optional[str]
    status: str = "running"  # running | completed | failed
    events: list = field(default_factory=list)  # SSE-ready lines, in order
    subscribers: set = field(default_factory=set)  # asyncio.Queue per attach
    created_at: float = field(default_factory=time.monotonic)
    finished_at: Optional[float] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    task: Optional[asyncio.Task] = None

    def subscribe(self) -> "tuple[asyncio.Queue, int]":
        """Register a subscriber. Returns (queue, buffered_count).

        `events` is indexed from 0; events with seq >= buffered_count are new
        and will arrive on the queue, the rest are already in `events` for
        replay.
        """
        queue: asyncio.Queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue, len(self.events)

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self.subscribers.discard(queue)

    def publish(self, event: Dict[str, Any]) -> None:
        """Append an event to the replay buffer and push it to subscribers."""
        line = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        self.events.append(line)
        seq = len(self.events) - 1
        for queue in list(self.subscribers):
            queue.put_nowait((seq, line))


class GenerationJobManager:
    """Tracks and runs generation jobs. One active job per session."""

    def __init__(self, runner: Optional[Callable] = None):
        self._jobs: Dict[str, GenerationJob] = {}
        self._latest_by_session: Dict[str, str] = {}
        # Injectable for tests; default runs the chat graphs.
        self._runner: Callable = runner or self._default_runner

    # --- lookups ---------------------------------------------------------

    def _sweep(self) -> None:
        now = time.monotonic()
        for job_id in list(self._jobs):
            job = self._jobs[job_id]
            if (
                job.status != "running"
                and job.finished_at is not None
                and now - job.finished_at > COMPLETED_TTL_SECONDS
            ):
                del self._jobs[job_id]
                if self._latest_by_session.get(job.session_id) == job_id:
                    del self._latest_by_session[job.session_id]

    def get(self, job_id: str) -> Optional[GenerationJob]:
        self._sweep()
        return self._jobs.get(job_id)

    def latest_for_session(self, session_id: str) -> Optional[GenerationJob]:
        """Most recent job for a session (running, or finished within TTL)."""
        self._sweep()
        job_id = self._latest_by_session.get(session_id)
        return self._jobs.get(job_id) if job_id else None

    # --- submission ------------------------------------------------------

    def submit(
        self,
        *,
        kind: str,
        session_id: str,
        input_state: Dict[str, Any],
        model_override: Optional[str] = None,
    ) -> GenerationJob:
        latest = self.latest_for_session(session_id)
        if latest is not None and latest.status == "running":
            raise InvalidInputError(
                "A response is already being generated for this session"
            )

        job = GenerationJob(
            job_id=str(uuid.uuid4()),
            session_id=session_id,
            kind=kind,
            input_state=input_state,
            model_override=model_override,
        )
        self._jobs[job.job_id] = job
        self._latest_by_session[session_id] = job.job_id

        try:
            loop = asyncio.get_running_loop()
            job.task = loop.create_task(self._run(job))
        except RuntimeError:
            # No event loop (e.g. sync test context): run inline.
            logger.debug(f"Job {job.job_id}: no running loop, running inline")
            asyncio.run(self._run(job))
        return job

    # --- execution -------------------------------------------------------

    async def _run(self, job: GenerationJob) -> None:
        try:
            result = await self._runner(job)
            job.result = result or {}
            job.status = "completed"
            job.finished_at = time.monotonic()
            job.publish({"type": "complete", **job.result})
        except Exception as e:
            logger.error(f"Generation job {job.job_id} failed: {e}")
            _, user_message = classify_error(e)
            job.error = user_message
            job.status = "failed"
            job.finished_at = time.monotonic()
            job.publish({"type": "error", "message": user_message})

    @staticmethod
    async def _default_runner(job: GenerationJob) -> Dict[str, Any]:
        from open_notebook.graphs.chat import graph as chat_graph
        from open_notebook.graphs.source_chat import source_chat_graph

        graphs: Dict[str, Any] = {
            "notebook_chat": chat_graph,
            "source_chat": source_chat_graph,
        }
        graph = graphs.get(job.kind)
        if graph is None:
            raise ValueError(f"Unknown job kind: {job.kind}")

        config = RunnableConfig(
            configurable={
                "thread_id": job.session_id,
                "model_id": job.model_override,
            }
        )

        # stream_mode="messages" yields LLM tokens as they are produced;
        # the node aggregates them into the message the checkpointer stores.
        async for item in graph.astream(  # type: ignore[call-overload]
            input=job.input_state,
            config=config,
            stream_mode="messages",
        ):
            message, _metadata = item
            text = _chunk_text(message)
            if text:
                job.publish({"type": "delta", "content": text})

        # Final state for anything beyond tokens (e.g. context indicators,
        # the persisted message id/content).
        state = await asyncio.to_thread(graph.get_state, config=config)
        result: Dict[str, Any] = {}
        if state is not None and state.values:
            values = state.values
            messages = values.get("messages") or []
            if messages:
                last = messages[-1]
                result["message_id"] = getattr(last, "id", None)
                result["content"] = extract_text_content(
                    getattr(last, "content", "")
                )
            indicators = values.get("context_indicators")
            if indicators is not None:
                # Published as its own event (protocol) and kept in the
                # terminal payload for convenience.
                job.publish({"type": "context_indicators", "data": indicators})
                result["context_indicators"] = indicators
        return result


# Process-wide manager; routers submit jobs and attach streams to it.
manager = GenerationJobManager()
