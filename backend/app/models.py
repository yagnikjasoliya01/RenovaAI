from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # User isolation
    name = Column(String, nullable=True)
    original_image = Column(String, nullable=False)
    generated_image = Column(String, nullable=True)
    scale_ft = Column(Float, nullable=True)  # reference dimension in feet
    scale_px = Column(Float, nullable=True)  # reference dimension in pixels
    reference_note = Column(String, nullable=True)
    texture_scale = Column(Float, nullable=True)  # material pattern scale multiplier
    last_report_html = Column(Text, nullable=True)  # Cached LLM-generated report
    last_report_data = Column(JSON, nullable=True)  # Cached report engine/llm data
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=True)

    regions = relationship(
        "Region", back_populates="project", cascade="all, delete-orphan"
    )


class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)  # wall/window/balcony/pillar/...
    points = Column(JSON, nullable=False)  # [[x,y], ...] polygon
    material_id = Column(String, nullable=True)

    project = relationship("Project", back_populates="regions")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    role = Column(String, nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=True)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=True)  # e.g., "Renovation Report - 08 Aug 2026"
    html_content = Column(Text, nullable=False)  # Complete HTML report
    report_data = Column(JSON, nullable=False)  # Engine/LLM data
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class UserMaterialRate(Base):
    __tablename__ = "user_material_rates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    material_id = Column(String, nullable=False)  # e.g., "paint_acrylic"
    rate = Column(Float, nullable=False)  # Custom material rate
    labor_rate = Column(Float, nullable=False)  # Custom labor rate
    
    # Composite unique constraint: one custom rate per user per material
    __table_args__ = (
        {"schema": None},
    )
