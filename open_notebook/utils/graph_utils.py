import asyncio
from collections.abc import AsyncIterator, Sequence
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from langgraph.checkpoint.sqlite import SqliteSaver
from loguru import logger


class ThreadedSqliteSaver(SqliteSaver):
    """SqliteSaver that also serves the async graph execution path.

    ``graph.astream()`` drives the checkpointer through its async methods
    (``aget_tuple``/``aput``/...), which plain ``SqliteSaver`` leaves as
    ``NotImplementedError``. ``AsyncSqliteSaver`` would work but must be
    constructed inside a running event loop, so it cannot be created at
    module import time where the graphs are compiled. This adapter runs the
    synchronous SqliteSaver methods in the default thread-pool executor —
    the same threading model aiosqlite (backing ``AsyncSqliteSaver``) uses
    internally — so existing checkpoint files and sync ``get_state`` call
    sites keep working unchanged.
    """

    async def aget_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.get_tuple, config)

    async def alist(
        self,
        config: RunnableConfig | None = None,
        *,
        filter: dict[str, Any] | None = None,  # noqa: A002
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> AsyncIterator[CheckpointTuple]:
        loop = asyncio.get_running_loop()
        tuples = await loop.run_in_executor(
            None,
            lambda: list(self.list(config, filter=filter, before=before, limit=limit)),
        )
        for checkpoint_tuple in tuples:
            yield checkpoint_tuple

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self.put, config, checkpoint, metadata, new_versions
        )

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, self.put_writes, config, writes, task_id, task_path
        )

    async def adelete_thread(self, thread_id: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.delete_thread, thread_id)


async def get_session_message_count(graph, session_id: str) -> int:
    """Get message count from LangGraph state, returns 0 on error."""
    try:
        # Use sync get_state() in a thread (SqliteSaver doesn't support async)
        thread_state = await asyncio.to_thread(
            graph.get_state,
            config=RunnableConfig(configurable={"thread_id": session_id}),
        )
        if (
            thread_state
            and thread_state.values
            and "messages" in thread_state.values
        ):
            return len(thread_state.values["messages"])
    except Exception as e:
        logger.warning(f"Could not fetch message count for session {session_id}: {e}")
    return 0
