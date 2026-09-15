"""Per-model thinking level support.

The user picks a thinking level (low | medium | high | xhigh | max | ultra)
per model; the project passes that level straight through to the provider
and does NOT clamp it — whether a provider supports the chosen value is the
provider's (and thus the user's) decision. If the provider rejects it, the
API error is surfaced so the user can pick a different level.

Two providers need a level → token-budget conversion because their APIs
require a numeric budget and cannot accept a level word: Anthropic
(``thinking.budget_tokens``) and Qwen/DashScope (``thinking_budget``).

Applies to both call paths: the native Esperanto path via the model
``config`` dict (merged in ``ModelManager.get_model``), and the LangChain
path (``provision_langchain_model``), which needs explicit post-processing
because ``to_langchain()`` only forwards a fixed set of fields.

Providers without a supported parameter (e.g. cohere) are silently skipped
with a debug log — the user opted into thinking for that model, so a
hard error on every LLM call would be worse than a no-op.
"""

from typing import Any, Dict, Optional

from loguru import logger

from open_notebook.exceptions import InvalidInputError

# Ordered weakest → strongest. "default" (null) is handled separately and
# means "use the provider's own default".
THINKING_LEVELS = ("low", "medium", "high", "xhigh", "max", "ultra")

# The user picks a level; the provider decides whether it supports it. We
# pass the chosen level straight through and do NOT clamp it to a provider
# maximum — if the provider rejects the value the API error is surfaced and
# the user adjusts their choice.
#
# Two providers are the exception because their APIs require a numeric token
# budget and cannot accept a level word at all, so a level → number conversion
# is a format requirement (not a support decision):
#   - Anthropic: `thinking.budget_tokens` (tokens)
#   - Qwen/DashScope: `thinking_budget` (tokens)
_ANTHROPIC_BUDGETS = {
    "low": 1024,
    "medium": 8192,
    "high": 16384,
    "xhigh": 32768,
    "max": 49152,
    "ultra": 65536,
}
_DASHSCOPE_BUDGETS = {
    "low": 1024,
    "medium": 8192,
    "high": 24576,
    "xhigh": 38912,
    "max": 49152,
    "ultra": 65536,
}

# Providers whose chat-completions endpoint accepts an OpenAI-style
# `reasoning_effort` parameter passed verbatim in the request body
# (Esperanto forwards unknown config keys straight into the payload).
_REASONING_EFFORT_PROVIDERS = frozenset(
    {
        "openai",
        "azure",
        "groq",
        "xai",
        "mistral",
        "openrouter",
        "openai_compatible",
        "minimax",
        "novita",
        "ppq",
    }
)

# Providers using Anthropic's `thinking` API shape.
_ANTHROPIC_PROVIDERS = frozenset({"anthropic", "anthropic_compatible"})


def validate_thinking_level(level: Optional[str]) -> Optional[str]:
    """Normalize a thinking level, raising InvalidInputError for bad values.

    None is valid and passes through (meaning "not set / use provider
    default").
    """
    if level is None:
        return None
    normalized = str(level).strip().lower()
    if normalized not in THINKING_LEVELS:
        raise InvalidInputError(
            f"Invalid thinking level: {level!r}. "
            f"Must be one of: {', '.join(THINKING_LEVELS)}"
        )
    return normalized


def _normalize_provider(provider: str) -> str:
    return (provider or "").strip().lower().replace("-", "_")


def thinking_api_params(provider: str, level: Optional[str]) -> Dict[str, Any]:
    """Provider-specific request-body parameters for a thinking level.

    Returns {} when the level is unset or the provider has no supported
    parameter (google/vertex are handled natively by the LangChain layer
    in ``apply_thinking_to_langchain``; cohere/others are skipped).
    """
    if not level:
        return {}
    level = str(level).lower()
    provider = _normalize_provider(provider)
    if provider in _ANTHROPIC_PROVIDERS:
        return {
            "thinking": {
                "type": "enabled",
                "budget_tokens": _ANTHROPIC_BUDGETS[level],
            }
        }
    if provider == "dashscope":
        return {
            "enable_thinking": True,
            "thinking_budget": _DASHSCOPE_BUDGETS[level],
        }
    if provider == "ollama":
        return {"think": True}
    # OpenAI-style `reasoning_effort` (openai, deepseek, groq, xai, mistral,
    # openrouter, openai-compatible gateways, ...): pass the user's level
    # through verbatim; the provider decides whether it supports it.
    if provider == "deepseek" or provider in _REASONING_EFFORT_PROVIDERS:
        return {"reasoning_effort": level}
    return {}


def min_max_tokens_for(provider: str, level: Optional[str]) -> Optional[int]:
    """Minimum max_tokens the API requires for this thinking level, if any.

    Anthropic requires ``max_tokens`` to be greater than
    ``thinking.budget_tokens``, so the budget plus a margin for the final
    answer is the floor.
    """
    if not level:
        return None
    if _normalize_provider(provider) in _ANTHROPIC_PROVIDERS:
        return _ANTHROPIC_BUDGETS[str(level).lower()] + 1024
    return None


def apply_thinking_to_langchain(
    model: Any, provider: str, level: Optional[str]
) -> None:
    """Apply a thinking level to a LangChain chat model instance.

    Mutates the instance in place. Safe to call with level=None (no-op).
    """
    if not level:
        return
    provider = _normalize_provider(provider)
    level = str(level).lower()

    # Native LangChain fields first (ChatGoogleGenerativeAI / ChatOllama).
    if provider in ("google", "vertex") and hasattr(model, "thinking_level"):
        model.thinking_level = level
        return
    if provider in ("ollama", "omlx") and hasattr(model, "reasoning"):
        model.reasoning = True
        return

    params = thinking_api_params(provider, level)
    if not params:
        logger.debug(
            f"Thinking level '{level}' not supported for provider '{provider}'"
        )
        return

    min_max = min_max_tokens_for(provider, level)
    if min_max and hasattr(model, "max_tokens"):
        current = model.max_tokens or 0
        if current < min_max:
            model.max_tokens = min_max

    if hasattr(model, "extra_body"):
        model.extra_body = {**(model.extra_body or {}), **params}
        return
    if hasattr(model, "model_kwargs"):
        model.model_kwargs = {**(model.model_kwargs or {}), **params}
        return
    logger.debug(
        f"LangChain model {type(model).__name__} exposes neither extra_body "
        f"nor model_kwargs; skipping thinking level '{level}'"
    )
