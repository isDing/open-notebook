import sqlite3
from typing import Annotated, Dict, List, Optional

from ai_prompter import Prompter
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.config import LANGGRAPH_CHECKPOINT_FILE
from open_notebook.domain.notebook import Source, SourceInsight
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils.context_builder import (
    build_source_context,
    format_source_context,
)
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.graph_utils import ThreadedSqliteSaver
from open_notebook.utils.text_utils import (
    combine_message_chunks,
    extract_text_content,
)


class SourceChatState(TypedDict):
    messages: Annotated[list, add_messages]
    source_id: str
    source: Optional[Source]
    insights: Optional[List[SourceInsight]]
    context: Optional[str]
    model_override: Optional[str]
    context_indicators: Optional[Dict[str, List[str]]]


def _source_content_is_available(
    source_info: Dict,
    context_data: Dict,
) -> bool:
    """Return whether source text, including a truncated prefix, is available."""
    status = context_data.get("metadata", {}).get("source_text_status")
    if status is not None:
        return status in {"available", "truncated"}
    full_text = source_info.get("full_text")
    return isinstance(full_text, str) and bool(full_text.strip())


async def call_model_with_source_context(
    state: SourceChatState, config: RunnableConfig
) -> dict:
    """
    Build source context and stream the model response.

    This function:
    1. Uses build_source_context to build source-specific context
    2. Applies the source_chat Jinja2 prompt template
    3. Streams the model response via provision_langchain_model (with
       override support); the aggregated message is what the checkpointer
       persists
    4. Tracks context indicators for referenced insights/content

    Thinking content is preserved verbatim in the stored message; the
    frontend renders it as a collapsed section.
    """
    try:
        return await _call_model_with_source_context_inner(state, config)
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


async def _call_model_with_source_context_inner(
    state: SourceChatState, config: RunnableConfig
) -> dict:
    source_id = state.get("source_id")
    if not source_id:
        raise ValueError("source_id is required in state")

    # Build source context (async node: await directly, no event-loop shims)
    context_data = await build_source_context(
        source_id=source_id,
        max_tokens=50000,  # Reasonable limit for source context
    )

    # Extract source and insights from context
    source = None
    insights = []
    context_indicators: dict[str, list[str | None]] = {
        "sources": [],
        "insights": [],
        "notes": [],
    }

    if context_data.get("sources"):
        source_info = context_data["sources"][0]  # First source
        source = Source(**source_info) if isinstance(source_info, dict) else source_info
        if (
            isinstance(source_info, dict)
            and _source_content_is_available(source_info, context_data)
            and source.id
        ):
            context_indicators["sources"].append(source.id)

    if context_data.get("insights"):
        for insight_data in context_data["insights"]:
            insight = (
                SourceInsight(**insight_data)
                if isinstance(insight_data, dict)
                else insight_data
            )
            insights.append(insight)
            context_indicators["insights"].append(insight.id)

    # Format context for the prompt
    formatted_context = _format_source_context(context_data)

    # Build prompt data for the template
    prompt_data = {
        "source": source.model_dump() if source else None,
        "insights": [insight.model_dump() for insight in insights] if insights else [],
        "context": formatted_context,
        "context_indicators": context_indicators,
    }

    # Apply the source_chat prompt template
    system_prompt = Prompter(prompt_template="source_chat/system").render(
        data=prompt_data
    )
    payload = [SystemMessage(content=system_prompt)] + state.get("messages", [])

    model = await provision_langchain_model(
        str(payload),
        config.get("configurable", {}).get("model_id")
        or state.get("model_override"),
        "chat",
        max_tokens=8192,
    )

    chunks = []
    async for chunk in model.astream(payload):
        chunks.append(chunk)
    cleaned_message = combine_message_chunks(chunks)

    # Normalize structured content to a plain string; keep thinking blocks
    # intact for the UI's collapsed view.
    content = extract_text_content(cleaned_message.content)
    cleaned_message = cleaned_message.model_copy(update={"content": content})

    # Update state with context information
    return {
        "messages": cleaned_message,
        "source": source,
        "insights": insights,
        "context": formatted_context,
        "context_indicators": context_indicators,
    }


def _format_source_context(context_data: Dict) -> str:
    """Format context through the builder's shared budgeted renderer."""
    return format_source_context(context_data)


# Create SQLite checkpointer
conn = sqlite3.connect(
    LANGGRAPH_CHECKPOINT_FILE,
    check_same_thread=False,
)
memory = ThreadedSqliteSaver(conn)

# Create the StateGraph
source_chat_state = StateGraph(SourceChatState)
source_chat_state.add_node("source_chat_agent", call_model_with_source_context)
source_chat_state.add_edge(START, "source_chat_agent")
source_chat_state.add_edge("source_chat_agent", END)
source_chat_graph = source_chat_state.compile(checkpointer=memory)
