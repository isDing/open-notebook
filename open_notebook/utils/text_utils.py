"""
Text utilities for Open Notebook.
Extracted from main utils to avoid circular imports.
"""

import re
import unicodedata
from typing import TYPE_CHECKING, Tuple

if TYPE_CHECKING:
    from langchain_core.messages import AIMessage

# Patterns for matching thinking content in AI responses
# Standard pattern: <think>...</think>
THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.DOTALL)
# Pattern for malformed output: content</think> (missing opening tag)
THINK_PATTERN_NO_OPEN = re.compile(r"^(.*?)</think>", re.DOTALL)


def remove_non_ascii(text: str) -> str:
    """Remove non-ASCII characters from text."""
    return re.sub(r"[^\x00-\x7F]+", "", text)


def remove_non_printable(text: str) -> str:
    """Remove non-printable characters from text."""
    # Replace any special Unicode whitespace characters with a regular space
    text = re.sub(r"[\u2000-\u200B\u202F\u205F\u3000]", " ", text)

    # Replace unusual line terminators with a single newline
    text = re.sub(r"[\u2028\u2029\r]", "\n", text)

    # Remove control characters, except newlines and tabs
    text = "".join(
        char for char in text if unicodedata.category(char)[0] != "C" or char in "\n\t"
    )

    # Replace non-breaking spaces with regular spaces
    text = text.replace("\xa0", " ").strip()

    # Keep letters (including accented ones), numbers, spaces, newlines, tabs, and basic punctuation
    return re.sub(r"[^\w\s.,!?\-\n\t]", "", text, flags=re.UNICODE)


def parse_thinking_content(content: str) -> Tuple[str, str]:
    """
    Parse message content to extract thinking content from <think> tags.

    Handles both well-formed tags and malformed output where the opening
    <think> tag is missing but </think> is present.

    Args:
        content (str): The original message content

    Returns:
        Tuple[str, str]: (thinking_content, cleaned_content)
            - thinking_content: Content from within <think> tags
            - cleaned_content: Original content with <think> blocks removed

    Example:
        >>> content = "<think>Let me analyze this</think>Here's my answer"
        >>> thinking, cleaned = parse_thinking_content(content)
        >>> print(thinking)
        "Let me analyze this"
        >>> print(cleaned)
        "Here's my answer"
    """
    # Input validation
    if not isinstance(content, str):
        return "", str(content) if content is not None else ""

    # Limit processing for very large content (100KB limit)
    if len(content) > 100000:
        return "", content

    # Find all well-formed thinking blocks
    thinking_matches = THINK_PATTERN.findall(content)

    if thinking_matches:
        # Join all thinking content with double newlines
        thinking_content = "\n\n".join(match.strip() for match in thinking_matches)

        # Remove all <think>...</think> blocks from the original content
        cleaned_content = THINK_PATTERN.sub("", content)

        # Clean up extra whitespace
        cleaned_content = re.sub(r"\n\s*\n\s*\n", "\n\n", cleaned_content).strip()

        return thinking_content, cleaned_content

    # Handle malformed output: content</think> (missing opening tag)
    # Some models like Nemotron output thinking without the opening <think> tag
    malformed_match = THINK_PATTERN_NO_OPEN.match(content)
    if malformed_match:
        thinking_content = malformed_match.group(1).strip()
        # Remove the thinking content and </think> tag
        cleaned_content = content[malformed_match.end() :].strip()
        return thinking_content, cleaned_content

    return "", content


def clean_thinking_content(content: str) -> str:
    """
    Remove thinking content from AI responses, returning only the cleaned content.

    This is a convenience function for cases where you only need the cleaned
    content and don't need access to the thinking process.

    Args:
        content (str): The original message content with potential <think> tags

    Returns:
        str: Content with <think> blocks removed and whitespace cleaned

    Example:
        >>> content = "<think>Let me think...</think>Here's the answer"
        >>> clean_thinking_content(content)
        "Here's the answer"
    """
    _, cleaned_content = parse_thinking_content(content)
    return cleaned_content


def combine_message_chunks(chunks) -> "AIMessage":
    """Combine streamed message chunks into a single normalized AIMessage.

    `chunk + chunk` is the idiomatic LangChain way to fold streamed chunks and
    preserve metadata. An empty stream yields an empty AIMessage.
    """
    from langchain_core.messages import AIMessage

    if not chunks:
        return AIMessage(content="")
    combined = chunks[0]
    for chunk in chunks[1:]:
        combined = combined + chunk
    return as_ai_message(combined)


def as_ai_message(message) -> "AIMessage":
    """Normalize a (possibly chunked) AI message to a plain AIMessage.

    Concatenated `AIMessageChunk`s keep `type == "AIMessageChunk"` in
    langchain-core 1.x, which breaks the `human|ai` message-type contract used
    by the chat APIs. Chat-graph nodes must persist the normalized message.
    """
    from langchain_core.messages import AIMessage

    if isinstance(message, AIMessage) and type(message) is AIMessage:
        return message
    return AIMessage(
        content=message.content,
        id=message.id,
        name=message.name,
        additional_kwargs=message.additional_kwargs,
        response_metadata=message.response_metadata,
        tool_calls=message.tool_calls,
        invalid_tool_calls=message.invalid_tool_calls,
        usage_metadata=message.usage_metadata,
    )


def extract_text_content(content) -> str:
    """Extract text from LLM response content.

    Handles both plain string responses and structured content formats
    (e.g. Gemini's envelope format):
    [{'type': 'text', 'text': '...', 'extras': {...}}]

    Args:
        content: The content from an AI message, either a string or a list of parts.

    Returns:
        The extracted text content as a string.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                text_parts.append(part["text"])
            elif isinstance(part, str):
                text_parts.append(part)
        return "".join(text_parts)
    return str(content)
