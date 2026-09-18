# ADR-008: Chat generation runs as a background job; thinking stays in the message

- **Status**: Accepted
- **Date**: 2026-09
- **Related**: [ADR-004](ADR-004-background-workers.md) (async job pattern), `open_notebook/jobs.py`, `api/routers/chat.py` (`/chat/jobs/{id}/stream`), `frontend/src/lib/utils/thinking.ts`

## Context

Notebook chat was synchronous: the HTTP request stayed open for the whole LLM call. A page refresh or tab close killed the in-flight answer, and long generations blocked the connection with no way to resume. Source chat streamed over that same request, with the same fragility. Separately, chat nodes stripped extended-thinking output (`clean_thinking_content`) before persisting, discarding reasoning the product later wants to show.

## Decision

- **Chat generation is a detached in-process job** (`open_notebook/jobs.py`): `POST /chat/execute` and the source-chat message endpoint submit a job and return a handle (`job_id`, `status`) immediately. The job runs as an asyncio task on the API event loop, so it **survives client disconnect**.
- **Clients attach over SSE** (`GET /chat/jobs/{job_id}/stream`), which first replays every buffered event and then follows live. A refreshed page re-resolves its session's latest job (`GET /chat/sessions/{id}/job`) and re-attaches, resuming exactly where it left off.
- **The final message is persisted via the LangGraph checkpoint** as before, so a completed job's answer is in session history even after the job is swept (TTL). Thinking content is **kept verbatim** in the persisted message; the frontend (`splitThinking`) renders it as a collapsed "Thinking" section instead of stripping it server-side.
- **The chat graphs run their async path over a threaded `SqliteSaver`.** The job runner drives `graph.astream(...)`, and langgraph's async path requires an *async* checkpointer — but the graphs compile at module import (no running event loop), where `AsyncSqliteSaver` cannot be constructed (its `__init__` calls `asyncio.get_running_loop()`). `ThreadedSqliteSaver` (`open_notebook/utils/graph_utils.py`) subclasses `SqliteSaver` and serves the async methods by running the sync ones in the default thread-pool executor — the same threading model aiosqlite uses internally. Existing checkpoint files and the sync `get_state` call sites are unchanged.

## Alternatives considered

- **Keep the long-lived HTTP request** (status quo) — simplest, but a refresh always loses the answer and the client can't resume; the exact pain point this fixes.
- **Move generation to the surreal-commands worker** (ADR-004) — fully decoupled from the API process and survives API restarts, but chat needs the live token stream and per-session in-process state; the worker adds a queue/handoff with no benefit for a request-scoped LLM call.
- **Strip thinking server-side** (status quo) — clean persisted messages, but the UI can no longer offer the collapsed reasoning view without a second storage path.
- **Migrate to `AsyncSqliteSaver` (aiosqlite)** — the "official" async checkpointer, but it must be created inside a running event loop, forcing lazy graph construction and touching every import site of the compiled graphs; the threaded adapter keeps the change to two lines per graph.

## Consequences

- A page refresh mid-generation no longer loses the answer; the UI re-attaches and the answer continues to stream in.
- **Limitation:** jobs live in the API process — a full API restart drops in-flight jobs. Persisted history is intact; the user simply re-asks.
- "Cancel" now detaches the client rather than aborting generation; the job still runs to completion and is persisted.
- The API is no longer strictly request/response for chat: consumers must handle the job-handle + SSE contract, and one active job per session is enforced (submitting a second while one runs is rejected).
- Messages may now contain ` think` blocks; any code that treats `content` as plain answer text must go through `splitThinking` (frontend) or `parse_thinking_content` (backend).
- **SSE responses must send `Cache-Control: no-transform`** (via `SSE_HEADERS` in `api/sse.py`). Browsers send `Accept-Encoding: gzip`, and the Next.js proxy (and any gzip/brotli layer) will otherwise compress the stream — compression buffers chunks until the stream ends, so the whole answer arrives at once and per-token streaming silently dies. The backend streams correctly on its own (verified against uvicorn directly); the fix is the `no-transform` header telling intermediaries not to buffer.
