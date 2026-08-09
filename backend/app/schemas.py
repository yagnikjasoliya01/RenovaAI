from typing import Optional

from pydantic import BaseModel, Field


class RegionPayload(BaseModel):
    label: str
    points: list[list[float]] = Field(min_length=3)
    material_id: Optional[str] = None


class SaveProjectPayload(BaseModel):
    scale_ft: Optional[float] = None
    scale_px: Optional[float] = None
    reference_note: Optional[str] = None
    texture_scale: Optional[float] = 1.0
    regions: list[RegionPayload] = Field(default_factory=list)


class RenamePayload(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ChatPayload(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class GenerateImagePayload(BaseModel):
    user_preferences: Optional[str] = Field(default="", max_length=2000)
