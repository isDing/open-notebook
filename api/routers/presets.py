from typing import List

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.models import PresetCreate, PresetResponse, PresetUpdate
from open_notebook.domain.preset import Preset
from open_notebook.exceptions import OpenNotebookError

router = APIRouter()


def _preset_response(preset: Preset) -> PresetResponse:
    return PresetResponse(
        id=preset.id or "",
        title=preset.title,
        prompt=preset.prompt,
        created=str(preset.created),
        updated=str(preset.updated),
    )


@router.get("/presets", response_model=List[PresetResponse])
async def get_presets():
    """Get all preset prompts."""
    try:
        presets = await Preset.get_all(order_by="title asc")
        return [_preset_response(preset) for preset in presets]
    except HTTPException:
        raise
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error fetching presets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching presets: {str(e)}")


@router.post("/presets", response_model=PresetResponse)
async def create_preset(preset_data: PresetCreate):
    """Create a new preset prompt."""
    try:
        new_preset = Preset(
            title=preset_data.title,
            prompt=preset_data.prompt,
        )
        await new_preset.save()
        return _preset_response(new_preset)
    except HTTPException:
        raise
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error creating preset: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error creating preset: {str(e)}"
        )


@router.get("/presets/{preset_id}", response_model=PresetResponse)
async def get_preset(preset_id: str):
    """Get a specific preset prompt by ID."""
    try:
        preset = await Preset.get(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        return _preset_response(preset)
    except HTTPException:
        raise
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error fetching preset {preset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching preset: {str(e)}"
        )


@router.put("/presets/{preset_id}", response_model=PresetResponse)
async def update_preset(preset_id: str, preset_update: PresetUpdate):
    """Update a preset prompt."""
    try:
        preset = await Preset.get(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

        if preset_update.title is not None:
            preset.title = preset_update.title
        if preset_update.prompt is not None:
            preset.prompt = preset_update.prompt

        await preset.save()
        return _preset_response(preset)
    except HTTPException:
        raise
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error updating preset {preset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error updating preset: {str(e)}"
        )


@router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    """Delete a preset prompt."""
    try:
        preset = await Preset.get(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

        await preset.delete()
        return {"message": "Preset deleted successfully"}
    except HTTPException:
        raise
    except OpenNotebookError:
        raise
    except Exception as e:
        logger.error(f"Error deleting preset {preset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting preset: {str(e)}"
        )
