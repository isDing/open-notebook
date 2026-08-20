from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from esperanto import TextToSpeechModel

from open_notebook.ai.connection_tester import _select_test_voice
from open_notebook.ai.connection_tester import (
    test_individual_model as run_individual_model_test,
)


def test_selects_full_moss_ttsd_voice_id():
    model = SimpleNamespace(
        provider="openai_compatible",
        name="fnlp/MOSS-TTSD-v0.5",
    )

    voice = _select_test_voice(model, MagicMock(spec=TextToSpeechModel))

    assert voice == "fnlp/MOSS-TTSD-v0.5:alex"


def test_keeps_default_voice_for_other_openai_compatible_models():
    model = SimpleNamespace(
        provider="openai_compatible",
        name="some-provider/standard-tts",
    )

    voice = _select_test_voice(model, MagicMock(spec=TextToSpeechModel))

    assert voice == "alloy"


@pytest.mark.asyncio
async def test_moss_ttsd_connection_test_sends_full_voice_id():
    model = SimpleNamespace(
        id="model:test-moss-ttsd",
        provider="openai_compatible",
        type="text_to_speech",
        name="fnlp/MOSS-TTSD-v0.5",
    )
    esp_model = MagicMock(spec=TextToSpeechModel)
    esp_model.agenerate_speech = AsyncMock(
        return_value=SimpleNamespace(content=b"audio")
    )
    manager = MagicMock()
    manager.get_model = AsyncMock(return_value=esp_model)

    with patch("open_notebook.ai.models.ModelManager", return_value=manager):
        success, _ = await run_individual_model_test(model)

    assert success is True
    esp_model.agenerate_speech.assert_awaited_once_with(
        text="Hello from Open Notebook",
        voice="fnlp/MOSS-TTSD-v0.5:alex",
    )
