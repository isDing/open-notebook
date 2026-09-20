import sqlite3
from typing import Annotated, Optional

from ai_prompter import Prompter
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.config import LANGGRAPH_CHECKPOINT_FILE
from open_notebook.domain.notebook import Notebook
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.graph_utils import ThreadedSqliteSaver
from open_notebook.utils.text_utils import (
    combine_message_chunks,
    extract_text_content,
)


class ThreadState(TypedDict):
    messages: Annotated[list, add_messages]
    notebook: Optional[Notebook]
    context: Optional[str]
    context_config: Optional[dict]
    model_override: Optional[str]


async def call_model_with_messages(state: ThreadState, config: RunnableConfig) -> dict:
    """Stream the model response and store the aggregated message.

    The node is async so `graph.astream(..., stream_mode="messages")` can
    surface LLM tokens in real time; the aggregated message returned here is
    what the checkpointer persists. Thinking content (e.g. `think` blocks)
    is preserved verbatim — the frontend renders it as a collapsed section
    instead of stripping it.
    """
    try:
        system_prompt = Prompter(prompt_template="chat/system").render(data=state)  # type: ignore[arg-type]
        payload = [SystemMessage(content=system_prompt)] + state.get("messages", [])
        model_id = config.get("configurable", {}).get("model_id") or state.get(
            "model_override"
        )

        model = await provision_langchain_model(
            str(payload), model_id, "chat", max_tokens=32768
        )

        chunks = []
        async for chunk in model.astream(payload):
            chunks.append(chunk)
        message = combine_message_chunks(chunks)

        # Normalize structured content (e.g. Gemini's part lists) to a plain
        # string; keep thinking blocks intact for the UI's collapsed view.
        content = extract_text_content(message.content)
        return {"messages": message.model_copy(update={"content": content})}
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


conn = sqlite3.connect(
    LANGGRAPH_CHECKPOINT_FILE,
    check_same_thread=False,
)
memory = ThreadedSqliteSaver(conn)

agent_state = StateGraph(ThreadState)
agent_state.add_node("agent", call_model_with_messages)
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile(checkpointer=memory)
