"""Regression: provisioned chat models must have token streaming enabled.

Providers default the LangChain `streaming` flag off (e.g. ChatOpenAI), and
with it off `astream()` degrades to a single non-streamed chunk — which
silently kills real-time token streaming in the chat UI (and langgraph's
stream_mode="messages" events) even though the code calls `astream`.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from esperanto import LanguageModel


def _make_model(fake_langchain):
    model = MagicMock(spec=LanguageModel)
    model.to_langchain.return_value = fake_langchain
    return model


async def _provision(model: MagicMock):
    from open_notebook.ai.provision import provision_langchain_model

    # Await inside the patch context: the coroutine must run while the mock
    # is installed.
    with patch(
        "open_notebook.ai.provision.model_manager.get_default_model",
        new=AsyncMock(return_value=model),
    ):
        return await provision_langchain_model("tiny", None, "chat")


class TestProvisionStreaming:
    @pytest.mark.asyncio
    async def test_streaming_forced_on(self):
        fake_langchain = SimpleNamespace(streaming=False)
        result = await _provision(_make_model(fake_langchain))

        assert result is fake_langchain
        assert fake_langchain.streaming is True

    @pytest.mark.asyncio
    async def test_streaming_left_alone_when_unavailable(self):
        # Providers without a `streaming` attribute are untouched.
        fake_langchain = SimpleNamespace()
        result = await _provision(_make_model(fake_langchain))

        assert result is fake_langchain
        assert not hasattr(fake_langchain, "streaming")
