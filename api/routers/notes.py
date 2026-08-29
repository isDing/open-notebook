from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from loguru import logger

from api.models import NoteCreate, NoteNotebookResponse, NoteResponse, NoteUpdate
from open_notebook.database.repository import repo_query
from open_notebook.domain.notebook import Note
from open_notebook.exceptions import (
    InvalidInputError,
    NotFoundError,
    OpenNotebookError,
)

router = APIRouter()


async def _get_note_notebooks(
    note_ids: List[str],
) -> dict[str, List[NoteNotebookResponse]]:
    """Load notebook memberships for notes in one relation query."""
    normalized_ids = {note_id for note_id in note_ids if note_id}
    memberships: dict[str, List[NoteNotebookResponse]] = {
        note_id: [] for note_id in normalized_ids
    }
    if not normalized_ids:
        return memberships

    try:
        rows = await repo_query(
            """
            SELECT in AS note_id, out AS notebook
            FROM artifact
            FETCH notebook
            """
        )
    except Exception as e:
        # Membership is display metadata. A transient relation query failure
        # should not hide otherwise readable notes.
        logger.warning(f"Failed to load notebook memberships for notes: {e}")
        return memberships

    for row in rows:
        note_id = str(row.get("note_id", ""))
        notebook = row.get("notebook")
        if note_id not in normalized_ids or not isinstance(notebook, dict):
            continue
        notebook_id = str(notebook.get("id", ""))
        notebook_name = notebook.get("name")
        if notebook_id and isinstance(notebook_name, str):
            memberships[note_id].append(
                NoteNotebookResponse(id=notebook_id, name=notebook_name)
            )

    return memberships


def _note_response(
    note: Note,
    notebooks: Optional[List[NoteNotebookResponse]] = None,
    command_id: Optional[str] = None,
) -> NoteResponse:
    return NoteResponse(
        id=note.id or "",
        title=note.title,
        content=note.content,
        note_type=note.note_type,
        created=str(note.created),
        updated=str(note.updated),
        command_id=command_id,
        notebooks=notebooks or [],
    )


@router.get("/notes", response_model=List[NoteResponse])
async def get_notes(
    notebook_id: Optional[str] = Query(None, description="Filter by notebook ID"),
):
    """Get all notes with optional notebook filtering."""
    try:
        if notebook_id:
            # Get notes for a specific notebook
            from open_notebook.domain.notebook import Notebook

            notebook = await Notebook.get(notebook_id)
            notes = await notebook.get_notes()
        else:
            # Get all notes
            notes = await Note.get_all(order_by="updated desc")

        memberships = await _get_note_notebooks([note.id or "" for note in notes])
        return [
            _note_response(note, memberships.get(note.id or "", [])) for note in notes
        ]
    except HTTPException:
        raise
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Notebook not found")
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error fetching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching notes: {str(e)}")


@router.post("/notes", response_model=NoteResponse)
async def create_note(note_data: NoteCreate):
    """Create a new note."""
    try:
        # Auto-generate title if not provided and it's an AI note
        title = note_data.title
        if not title and note_data.note_type == "ai" and note_data.content:
            from open_notebook.graphs.prompt import graph as prompt_graph

            prompt = "Based on the Note below, please provide a Title for this content, with max 15 words"
            # LangGraph accepts a partial state dict at runtime, but its typed
            # overloads require the full state type (langgraph typing limitation).
            result = await prompt_graph.ainvoke(  # type: ignore[call-overload]
                {
                    "input_text": note_data.content,
                    "prompt": prompt,
                }
            )
            title = result.get("output", "Untitled Note")

        # Validate note_type
        note_type: Optional[Literal["human", "ai"]] = None
        if note_data.note_type in ("human", "ai"):
            note_type = note_data.note_type  # type: ignore[assignment]
        elif note_data.note_type is not None:
            raise HTTPException(
                status_code=400, detail="note_type must be 'human' or 'ai'"
            )

        new_note = Note(
            title=title,
            content=note_data.content,
            note_type=note_type,
        )
        command_id = await new_note.save()

        # Add to notebook if specified
        if note_data.notebook_id:
            from open_notebook.domain.notebook import Notebook

            # Verify the notebook exists (raises NotFoundError -> 404)
            await Notebook.get(note_data.notebook_id)
            await new_note.add_to_notebook(note_data.notebook_id)

        return _note_response(
            new_note,
            command_id=str(command_id) if command_id else None,
        )
    except HTTPException:
        raise
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Notebook not found")
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating note: {str(e)}")


@router.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    """Get a specific note by ID."""
    try:
        note = await Note.get(note_id)

        memberships = await _get_note_notebooks([note.id or ""])
        return _note_response(note, memberships.get(note.id or "", []))
    except HTTPException:
        raise
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Note not found")
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error fetching note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching note: {str(e)}")


@router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note_update: NoteUpdate):
    """Update a note."""
    try:
        note = await Note.get(note_id)

        # Update only provided fields
        if note_update.title is not None:
            note.title = note_update.title
        if note_update.content is not None:
            note.content = note_update.content
        if note_update.note_type is not None:
            if note_update.note_type in ("human", "ai"):
                note.note_type = note_update.note_type  # type: ignore[assignment]
            else:
                raise HTTPException(
                    status_code=400, detail="note_type must be 'human' or 'ai'"
                )

        command_id = await note.save()

        return _note_response(
            note,
            command_id=str(command_id) if command_id else None,
        )
    except HTTPException:
        raise
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Note not found")
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error updating note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating note: {str(e)}")


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """Delete a note."""
    try:
        note = await Note.get(note_id)

        await note.delete()

        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Note not found")
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error deleting note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting note: {str(e)}")
