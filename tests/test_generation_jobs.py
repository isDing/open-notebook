"""Tests for streaming chat generation.

Covers:
- `open_notebook.jobs` — the in-process job manager (buffering, replay
  without duplicates/gaps, one active job per session, TTL sweep)
- the routers — execute/message endpoints submit jobs; the SSE attach
  endpoint replays buffered events and follows live
- the graph nodes — async token streaming, aggregation, thinking preserved
"""

import asyncio
import json
import time
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessageChunk, HumanMessage
from langchain_core.runnables import RunnableConfig

from open_notebook.exceptions import InvalidInputError
from open_notebook.jobs import (
    COMPLETED_TTL_SECONDS,
    GenerationJob,
    GenerationJobManager,
)
from open_notebook.jobs import (
    manager as job_manager,
)

# --- helpers ---------------------------------------------------------------


def _job(session_id="s1", kind="notebook_chat"):
    return GenerationJob(
        job_id="job-1",
        session_id=session_id,
        kind=kind,
        input_state={},
        model_override=None,
    )


async def _wait_task(job):
    assert job.task is not None
    await job.task


class FakeModel:
    """LangChain-like chat model yielding fixed chunks from astream."""

    def __init__(self, chunks):
        self.chunks = chunks
        self.payloads = []

    async def astream(self, payload):
        self.payloads.append(payload)
        for chunk in self.chunks:
            yield chunk


@pytest.fixture
def fast_runner():
    """Swap the manager runner for a fast fake that publishes two deltas."""
    original = job_manager._runner

    async def fake(job):
        job.publish({"type": "delta", "content": "Hel"})
        job.publish({"type": "delta", "content": "lo"})
        return {"message_id": "ai-1", "content": "Hello"}

    job_manager._runner = fake
    yield
    job_manager._runner = original


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    # Context manager keeps a single event loop alive across requests, so
    # job tasks submitted in one request are still running in the next.
    with TestClient(app) as test_client:
        yield test_client


def _wait_for_status(job, expected="completed", timeout=5.0):
    deadline = time.monotonic() + timeout
    while job.status == "running" and time.monotonic() < deadline:
        time.sleep(0.01)
    assert job.status == expected, f"job status={job.status} error={job.error}"


def _sse_payloads(lines):
    payloads = []
    for line in lines:
        if line.startswith("data: "):
            payloads.append(json.loads(line[6:]))
    return payloads


# --- manager unit tests ----------------------------------------------------


class TestGenerationJob:
    def test_publish_buffers_and_notifies(self):
        job = _job()
        queue, last_seq = job.subscribe()
        assert last_seq == 0

        job.publish({"type": "delta", "content": "a"})
        job.publish({"type": "delta", "content": "b"})

        assert len(job.events) == 2
        assert job.events[0] == 'data: {"type": "delta", "content": "a"}\n\n'

        seq, line = queue.get_nowait()
        assert seq == 0
        assert '"a"' in line
        seq, line = queue.get_nowait()
        assert seq == 1
        assert '"b"' in line

    def test_attach_replays_without_dups_or_gaps(self):
        job = _job()
        job.publish({"type": "delta", "content": "1"})  # buffered before attach

        queue, buffered_count = job.subscribe()
        buffered = list(job.events)

        job.publish({"type": "delta", "content": "2"})  # live after attach

        seq, live_line = queue.get_nowait()
        assert seq == buffered_count  # first index not covered by the replay
        assert '"2"' in live_line

        delivered = buffered + [live_line]
        assert len(delivered) == 2
        assert [json.loads(line[6:])["content"] for line in delivered] == ["1", "2"]

    def test_unsubscribe_stops_delivery(self):
        job = _job()
        queue, _ = job.subscribe()
        job.unsubscribe(queue)
        job.publish({"type": "delta", "content": "x"})
        assert queue.empty()


class TestGenerationJobManager:
    @pytest.mark.asyncio
    async def test_run_publishes_complete_with_result(self):
        async def runner(job):
            job.publish({"type": "delta", "content": "ok"})
            return {"message_id": "m1", "content": "ok"}

        manager = GenerationJobManager(runner=runner)
        job = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        await _wait_task(job)

        assert job.status == "completed"
        payloads = _sse_payloads(job.events)
        assert [p["type"] for p in payloads] == ["delta", "complete"]
        assert payloads[-1]["message_id"] == "m1"

    @pytest.mark.asyncio
    async def test_run_publishes_classified_error(self):
        async def runner(job):
            raise RuntimeError("boom")

        manager = GenerationJobManager(runner=runner)
        job = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        await _wait_task(job)

        assert job.status == "failed"
        payloads = _sse_payloads(job.events)
        assert payloads[-1]["type"] == "error"
        assert payloads[-1]["message"]

    @pytest.mark.asyncio
    async def test_default_runner_publishes_context_indicators(self):
        """Source-chat runs surface context_indicators as their own event,
        before the terminal complete."""
        from open_notebook.jobs import GenerationJobManager

        class FakeState:
            values = {
                "messages": [AIMessageChunk(content="Hi")],
                "context_indicators": {
                    "sources": ["source:1"],
                    "insights": [],
                    "notes": [],
                },
            }

        class FakeGraph:
            async def astream(self, **kwargs):
                yield (AIMessageChunk(content="Hi"), {})

            def get_state(self, config):
                return FakeState()

        job = _job(kind="source_chat")
        with patch(
            "open_notebook.graphs.chat.graph", FakeGraph()
        ), patch(
            "open_notebook.graphs.source_chat.source_chat_graph", FakeGraph()
        ):
            await GenerationJobManager._default_runner(job)

        payloads = _sse_payloads(job.events)
        assert [p["type"] for p in payloads] == ["delta", "context_indicators"]
        assert payloads[1]["data"]["sources"] == ["source:1"]

    @pytest.mark.asyncio
    async def test_submit_rejects_second_active_job(self):
        release = asyncio.Event()

        async def blocker(job):
            await release.wait()
            return {}

        manager = GenerationJobManager(runner=blocker)
        first = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        try:
            with pytest.raises(InvalidInputError):
                manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        finally:
            release.set()
        await _wait_task(first)
        assert first.status == "completed"

        # After completion the same session may submit again.
        second = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        await _wait_task(second)
        assert second.status == "completed"

    @pytest.mark.asyncio
    async def test_ttl_sweep_drops_expired_jobs(self):
        async def runner(job):
            return {}

        manager = GenerationJobManager(runner=runner)
        job = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        await _wait_task(job)
        assert manager.get(job.job_id) is not None

        job.finished_at = time.monotonic() - COMPLETED_TTL_SECONDS - 1

        assert manager.get(job.job_id) is None
        assert manager.latest_for_session("s1") is None

    def test_latest_for_session_tracks_replacement(self):
        async def runner(job):
            return {}

        manager = GenerationJobManager(runner=runner)
        # Sync context: submit runs the job inline.
        first = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        assert first.status == "completed"
        second = manager.submit(kind="notebook_chat", session_id="s1", input_state={})
        assert second.status == "completed"
        latest = manager.latest_for_session("s1")
        assert latest is not None and latest.job_id == second.job_id


# --- router endpoint tests --------------------------------------------------


class TestChatExecuteEndpoint:
    @pytest.mark.asyncio
    @patch("api.routers.chat.chat_graph")
    @patch("api.routers.chat.get_session_or_404", new_callable=AsyncMock)
    async def test_execute_submits_job_and_stream_replays(
        self, mock_session, mock_graph, client, fast_runner
    ):
        session_ns = SimpleNamespace(
            id="chat_session:s1", model_override=None, save=AsyncMock()
        )
        mock_session.return_value = ("chat_session:s1", session_ns)
        mock_graph.get_state.return_value = SimpleNamespace(
            values={"messages": []}
        )

        resp = client.post(
            "/api/chat/execute",
            json={"session_id": "s1", "message": "hi", "context": {}},
        )
        assert resp.status_code == 200
        body = resp.json()
        job_id = body["job_id"]
        assert body["session_id"] == "chat_session:s1"
        assert body["status"] in ("running", "completed")

        job = job_manager.latest_for_session("chat_session:s1")
        _wait_for_status(job, "completed")

        # Session job lookup (the refresh re-attach path).
        lookup = client.get("/api/chat/sessions/s1/job")
        assert lookup.status_code == 200
        assert lookup.json() == {"job_id": job_id, "status": "completed"}

        # SSE attach replays the full event history and terminates.
        with client.stream("GET", f"/api/chat/jobs/{job_id}/stream") as stream:
            assert stream.status_code == 200
            assert stream.headers["content-type"].startswith("text/event-stream")
            payloads = _sse_payloads(list(stream.iter_lines()))

        assert [p["type"] for p in payloads] == ["delta", "delta", "complete"]
        assert "".join(p.get("content", "") for p in payloads[:2]) == "Hello"
        assert payloads[-1]["content"] == "Hello"

    @pytest.mark.asyncio
    @patch("api.routers.chat.get_session_or_404", new_callable=AsyncMock)
    async def test_session_job_lookup_404_without_job(
        self, mock_session, client
    ):
        session_ns = SimpleNamespace(id="chat_session:empty", model_override=None)
        mock_session.return_value = ("chat_session:empty", session_ns)

        resp = client.get("/api/chat/sessions/empty/job")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_stream_unknown_job_404(self, client):
        resp = client.get("/api/chat/jobs/nope/stream")
        assert resp.status_code == 404


class TestSourceChatMessageEndpoint:
    @pytest.mark.asyncio
    @patch("api.routers.source_chat.source_chat_graph")
    @patch("api.routers.source_chat.get_verified_source_session", new_callable=AsyncMock)
    async def test_send_message_submits_job(
        self, mock_verify, mock_graph, client, fast_runner
    ):
        session_ns = SimpleNamespace(
            id="chat_session:s2", model_override=None, save=AsyncMock()
        )
        mock_verify.return_value = (
            "source:x",
            SimpleNamespace(id="source:x"),
            "chat_session:s2",
            session_ns,
        )
        mock_graph.get_state.return_value = SimpleNamespace(
            values={"messages": []}
        )

        resp = client.post(
            "/api/sources/x/chat/sessions/s2/messages", json={"message": "hi"}
        )
        assert resp.status_code == 200
        body = resp.json()
        job_id = body["job_id"]
        assert body["session_id"] == "chat_session:s2"

        job = job_manager.latest_for_session("chat_session:s2")
        assert job is not None
        _wait_for_status(job, "completed")
        assert job.kind == "source_chat"

        with client.stream("GET", f"/api/chat/jobs/{job_id}/stream") as stream:
            payloads = _sse_payloads(list(stream.iter_lines()))
        assert payloads[-1]["type"] == "complete"


# --- graph node tests -------------------------------------------------------


class TestChatNodeStreaming:
    @pytest.mark.asyncio
    async def test_node_streams_aggregates_and_preserves_thinking(self):
        from open_notebook.graphs.chat import ThreadState, call_model_with_messages

        chunks = [
            AIMessageChunk(content="think"),
            AIMessageChunk(content="Let me reason."),
            AIMessageChunk(content="\n</think>"),
            AIMessageChunk(content="Here is the answer."),
        ]
        model = FakeModel(chunks)

        with patch(
            "open_notebook.graphs.chat.provision_langchain_model",
            new_callable=AsyncMock,
            return_value=model,
        ), patch("open_notebook.graphs.chat.Prompter") as mock_prompter:
            mock_prompter.return_value.render.return_value = "system prompt"
            result = await call_model_with_messages(
                cast(ThreadState, {"messages": [HumanMessage(content="hi")]}),
                RunnableConfig(configurable={"model_id": None}),
            )

        message = result["messages"]
        assert message.type == "ai"
        assert message.content == (
            "thinkLet me reason.\n</think>Here is the answer."
        )
        # The system prompt was prepended to the streamed payload.
        assert model.payloads[0][0].content == "system prompt"

    @pytest.mark.asyncio
    async def test_node_empty_stream_yields_empty_ai_message(self):
        from open_notebook.graphs.chat import ThreadState, call_model_with_messages

        model = FakeModel([])
        with patch(
            "open_notebook.graphs.chat.provision_langchain_model",
            new_callable=AsyncMock,
            return_value=model,
        ), patch("open_notebook.graphs.chat.Prompter") as mock_prompter:
            mock_prompter.return_value.render.return_value = "system prompt"
            result = await call_model_with_messages(
                cast(ThreadState, {"messages": []}), RunnableConfig(configurable={})
            )

        assert result["messages"].content == ""


class TestSourceChatNodeStreaming:
    @pytest.mark.asyncio
    async def test_node_builds_context_streams_and_tracks_indicators(self):
        from open_notebook.graphs.source_chat import (
            SourceChatState,
            call_model_with_source_context,
        )

        context_data = {
            "sources": [
                {"id": "source:1", "title": "T", "full_text": "Body text"}
            ],
            "insights": [
                {
                    "id": "insight:1",
                    "source_id": "source:1",
                    "insight_type": "summary",
                    "content": "An insight",
                }
            ],
            "notes": [],
            "metadata": {"source_text_status": "available"},
        }
        model = FakeModel([AIMessageChunk(content="Answer.")])

        with patch(
            "open_notebook.graphs.source_chat.build_source_context",
            new_callable=AsyncMock,
            return_value=context_data,
        ) as mock_build, patch(
            "open_notebook.graphs.source_chat.provision_langchain_model",
            new_callable=AsyncMock,
            return_value=model,
        ), patch("open_notebook.graphs.source_chat.Prompter") as mock_prompter:
            mock_prompter.return_value.render.return_value = "system prompt"
            result = await call_model_with_source_context(
                cast(
                    SourceChatState,
                    {"messages": [HumanMessage(content="hi")], "source_id": "source:1"},
                ),
                RunnableConfig(configurable={"model_id": None}),
            )

        mock_build.assert_awaited_once_with(source_id="source:1", max_tokens=50000)
        assert result["messages"].content == "Answer."
        assert result["context_indicators"]["sources"] == ["source:1"]
        assert result["context_indicators"]["insights"] == ["insight:1"]
        assert "Body text" in result["context"]
        assert result["source"].id == "source:1"


# --- real graph: async path against the SqliteSaver checkpointer ------------


class TestChatGraphAsyncCheckpointerPath:
    """Regression: `graph.astream()` (the job runner's path) must work against
    the SqliteSaver-backed checkpointer. Plain SqliteSaver leaves the async
    checkpointer methods as NotImplementedError, so every real chat used to
    crash with "The SqliteSaver does not support async methods".
    """

    @pytest.mark.asyncio
    async def test_astream_streams_tokens_and_persists_message(self):
        import uuid

        from langchain_core.language_models.fake_chat_models import (
            FakeListChatModel,
        )

        from open_notebook.graphs.chat import ThreadState, graph

        model = FakeListChatModel(responses=["Hello world"])
        thread_id = f"test-async-path-{uuid.uuid4().hex}"
        config = RunnableConfig(configurable={"thread_id": thread_id})
        state = cast(ThreadState, {"messages": [HumanMessage(content="hi")]})

        with patch(
            "open_notebook.graphs.chat.provision_langchain_model",
            new_callable=AsyncMock,
            return_value=model,
        ), patch("open_notebook.graphs.chat.Prompter") as mock_prompter:
            mock_prompter.return_value.render.return_value = "system prompt"
            events = [
                event
                async for event in graph.astream(
                    state,  # type: ignore[arg-type]
                    config=config,
                    stream_mode="messages",
                )
            ]

        # stream_mode="messages" surfaced the model's chunks as they streamed.
        streamed = "".join(chunk.content for chunk, _ in events)  # type: ignore[union-attr]
        assert streamed == "Hello world"

        # The checkpoint round-trip (aget_tuple -> aput) persisted the reply.
        snapshot = graph.get_state(config)
        contents = [str(m.content) for m in snapshot.values["messages"]]
        assert "Hello world" in contents
        assert "hi" in contents
