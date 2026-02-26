import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, JSON, Enum, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base

class ProviderType(String):
    pass # In real code we'd use SQLAlchemy Enum but for simplicity here...

class ProviderConfig(Base):
    __tablename__ = "provider_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_key = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    enabled = Column(Boolean, default=False)
    provider_type = Column(String, nullable=False) # 'dnsbl', 'feed', 'api', 'webhook'
    endpoint = Column(String, nullable=False)
    auth_type = Column(String, default="none")
    auth_payload = Column(JSONB, default={})
    fetch_interval_seconds = Column(Integer)
    ttl_seconds = Column(Integer, default=86400)
    last_fetched_at = Column(DateTime(timezone=True))
    last_hash = Column(String)
    config_json = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    value = Column(String, nullable=False)
    type = Column(String, nullable=False)
    score = Column(Float, default=0)
    metadata_json = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class AlertEvidence(Base):
    __tablename__ = "alert_evidences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"))
    provider_key = Column(String, nullable=False)
    evidence_data = Column(JSONB, nullable=False)
    score = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
