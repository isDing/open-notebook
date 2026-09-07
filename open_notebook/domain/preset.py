from typing import ClassVar

from open_notebook.domain.base import ObjectModel


class Preset(ObjectModel):
    """A reusable chat preset prompt: a display title plus the prompt text
    that gets inserted into the chat input box when selected."""

    table_name: ClassVar[str] = "preset_prompt"
    title: str
    prompt: str
