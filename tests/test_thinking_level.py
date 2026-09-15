"""Tests for per-model thinking level support (open_notebook/ai/thinking.py)."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from open_notebook.ai.thinking import (
    THINKING_LEVELS,
    apply_thinking_to_langchain,
    min_max_tokens_for,
    thinking_api_params,
    validate_thinking_level,
)
from open_notebook.exceptions import InvalidInputError


class TestValidateThinkingLevel:
    def test_none_passes_through(self):
        assert validate_thinking_level(None) is None

    @pytest.mark.parametrize("level", THINKING_LEVELS)
    def test_valid_levels(self, level):
        assert validate_thinking_level(level) == level

    def test_case_and_whitespace_normalized(self):
        assert validate_thinking_level(" HIGH ") == "high"

    @pytest.mark.parametrize("bad", ["off", "extreme", "very-high", "turbo", ""])
    def test_invalid_levels_raise(self, bad):
        with pytest.raises(InvalidInputError):
            validate_thinking_level(bad)


class TestThinkingApiParams:
    def test_none_level_returns_empty(self):
        assert thinking_api_params("openai", None) == {}

    def test_openai_family_reasoning_effort(self):
        for provider in ["openai", "azure", "groq", "xai", "mistral", "openrouter"]:
            assert thinking_api_params(provider, "high") == {
                "reasoning_effort": "high"
            }

    def test_openai_family_passes_level_through(self):
        # No clamping: the user's level goes straight to the provider.
        for level in ["low", "medium", "high", "xhigh", "max", "ultra"]:
            assert thinking_api_params("openai", level) == {
                "reasoning_effort": level
            }

    def test_openai_compatible_gateways(self):
        for provider in ["openai_compatible", "minimax", "novita", "ppq"]:
            assert thinking_api_params(provider, "low") == {
                "reasoning_effort": "low"
            }

    def test_deepseek_passes_level_through(self):
        # No clamping: DeepSeek gets whatever level the user picked.
        for level in ["low", "medium", "high", "xhigh", "max", "ultra"]:
            assert thinking_api_params("deepseek", level) == {
                "reasoning_effort": level
            }

    def test_anthropic_thinking_budget(self):
        params = thinking_api_params("anthropic", "medium")
        assert params["thinking"]["type"] == "enabled"
        assert params["thinking"]["budget_tokens"] == 8192
        assert thinking_api_params("anthropic_compatible", "low")["thinking"][
            "budget_tokens"
        ] == 1024
        expected = {
            "low": 1024,
            "medium": 8192,
            "high": 16384,
            "xhigh": 32768,
            "max": 49152,
            "ultra": 65536,
        }
        for level, budget in expected.items():
            assert thinking_api_params("anthropic", level)["thinking"][
                "budget_tokens"
            ] == budget

    def test_dashscope_enable_thinking(self):
        params = thinking_api_params("dashscope", "high")
        assert params["enable_thinking"] is True
        assert params["thinking_budget"] == 24576
        expected = {
            "low": 1024,
            "medium": 8192,
            "high": 24576,
            "xhigh": 38912,
            "max": 49152,
            "ultra": 65536,
        }
        for level, budget in expected.items():
            assert thinking_api_params("dashscope", level)["thinking_budget"] == budget

    def test_ollama_think(self):
        assert thinking_api_params("ollama", "low") == {"think": True}

    @pytest.mark.parametrize("provider", ["google", "vertex", "cohere", "omlx"])
    def test_unsupported_providers_return_empty(self, provider):
        assert thinking_api_params(provider, "high") == {}


class TestMinMaxTokensFor:
    def test_none_level(self):
        assert min_max_tokens_for("anthropic", None) is None

    def test_anthropic_requires_budget_plus_margin(self):
        assert min_max_tokens_for("anthropic", "low") == 2048
        assert min_max_tokens_for("anthropic", "high") == 17408
        assert min_max_tokens_for("anthropic_compatible", "medium") == 9216
        assert min_max_tokens_for("anthropic", "xhigh") == 33792
        assert min_max_tokens_for("anthropic", "ultra") == 66560

    def test_other_providers_none(self):
        assert min_max_tokens_for("openai", "high") is None


class FakeLangchainModel:
    """Minimal stand-in exposing the attributes apply_thinking_to_langchain checks."""

    def __init__(self, **fields):
        for key, value in fields.items():
            setattr(self, key, value)

    def __getattr__(self, name):
        raise AttributeError(name)


class TestApplyThinkingToLangchain:
    def test_no_op_when_level_none(self):
        model = FakeLangchainModel(extra_body={"existing": 1})
        apply_thinking_to_langchain(model, "openai", None)
        assert model.extra_body == {"existing": 1}

    def test_openai_like_extra_body(self):
        model = FakeLangchainModel(extra_body={"existing": 1})
        apply_thinking_to_langchain(model, "openai", "high")
        assert model.extra_body == {"existing": 1, "reasoning_effort": "high"}

    def test_extra_body_merges_over_none(self):
        model = FakeLangchainModel(extra_body=None)
        apply_thinking_to_langchain(model, "openrouter", "low")
        assert model.extra_body == {"reasoning_effort": "low"}

    def test_anthropic_model_kwargs_and_max_tokens_bump(self):
        model = FakeLangchainModel(
            model_kwargs={},
            max_tokens=850,
        )
        apply_thinking_to_langchain(model, "anthropic", "high")
        assert model.model_kwargs["thinking"]["budget_tokens"] == 16384
        assert model.max_tokens == 17408

    def test_anthropic_max_tokens_not_reduced(self):
        model = FakeLangchainModel(model_kwargs={}, max_tokens=32000)
        apply_thinking_to_langchain(model, "anthropic", "low")
        assert model.max_tokens == 32000

    def test_google_native_thinking_level(self):
        model = FakeLangchainModel(thinking_level=None)
        apply_thinking_to_langchain(model, "google", "medium")
        assert model.thinking_level == "medium"

    def test_google_passes_level_through(self):
        # No clamping: whatever level the user picked goes to the provider.
        for level in ["low", "medium", "high", "xhigh", "max", "ultra"]:
            model = FakeLangchainModel(thinking_level=None)
            apply_thinking_to_langchain(model, "google", level)
            assert model.thinking_level == level

    def test_ollama_native_reasoning(self):
        model = FakeLangchainModel(reasoning=None)
        apply_thinking_to_langchain(model, "ollama", "low")
        assert model.reasoning is True

    def test_unsupported_provider_is_noop(self):
        model = FakeLangchainModel()
        apply_thinking_to_langchain(model, "cohere", "high")


@pytest.fixture
def client():
    from api.main import app

    return TestClient(app)


class TestUpdateThinkingEndpoint:
    @pytest.mark.asyncio
    @patch("api.routers.models.Model.get", new_callable=AsyncMock)
    async def test_set_thinking_level(self, mock_get, client):
        from open_notebook.ai.models import Model

        instance = Model(
            id="model:1", name="gpt-5", provider="openai", type="language"
        )
        mock_get.return_value = instance
        with patch.object(Model, "save", new_callable=AsyncMock) as mock_save:
            response = client.put(
                "/api/models/model:1/thinking",
                json={"thinking_level": "high"},
            )
        assert response.status_code == 200
        assert response.json()["thinking_level"] == "high"
        assert instance.thinking_level == "high"
        mock_save.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("api.routers.models.Model.get", new_callable=AsyncMock)
    async def test_clear_thinking_level_with_null(self, mock_get, client):
        from open_notebook.ai.models import Model

        instance = Model(
            id="model:1",
            name="gpt-5",
            provider="openai",
            type="language",
            thinking_level="high",
        )
        mock_get.return_value = instance
        with patch.object(Model, "save", new_callable=AsyncMock):
            response = client.put(
                "/api/models/model:1/thinking",
                json={"thinking_level": None},
            )
        assert response.status_code == 200
        assert response.json()["thinking_level"] is None

    @pytest.mark.asyncio
    @patch("api.routers.models.Model.get", new_callable=AsyncMock)
    async def test_invalid_level_returns_400(self, mock_get, client):
        from open_notebook.ai.models import Model

        instance = Model(
            id="model:1", name="gpt-5", provider="openai", type="language"
        )
        mock_get.return_value = instance
        with patch.object(Model, "save", new_callable=AsyncMock):
            response = client.put(
                "/api/models/model:1/thinking",
                json={"thinking_level": "extreme"},
            )
        assert response.status_code == 400

    @pytest.mark.asyncio
    @patch("api.routers.models.Model.get", new_callable=AsyncMock)
    async def test_missing_model_returns_404(self, mock_get, client):
        from open_notebook.exceptions import NotFoundError

        mock_get.side_effect = NotFoundError("not found")
        response = client.put(
            "/api/models/model:1/thinking",
            json={"thinking_level": "high"},
        )
        assert response.status_code == 404


class TestCreateModelThinkingLevel:
    @pytest.mark.asyncio
    @patch("open_notebook.database.repository.repo_query", new_callable=AsyncMock)
    async def test_create_with_thinking_level(self, mock_repo_query, client):
        mock_repo_query.return_value = []
        from open_notebook.ai.models import Model

        with patch.object(Model, "save", new_callable=AsyncMock):
            response = client.post(
                "/api/models",
                json={
                    "name": "gpt-5",
                    "provider": "openai",
                    "type": "language",
                    "thinking_level": "ultra",
                },
            )
            assert response.status_code == 200
            assert response.json()["thinking_level"] == "ultra"

    @pytest.mark.asyncio
    @patch("open_notebook.database.repository.repo_query", new_callable=AsyncMock)
    @patch("api.routers.models.Model.save", new_callable=AsyncMock)
    async def test_create_with_invalid_thinking_level(self, mock_save, mock_repo_query, client):
        mock_repo_query.return_value = []
        response = client.post(
            "/api/models",
                json={
                    "name": "gpt-5",
                    "provider": "openai",
                    "type": "language",
                    "thinking_level": "turbo",
                },
        )
        assert response.status_code == 400
