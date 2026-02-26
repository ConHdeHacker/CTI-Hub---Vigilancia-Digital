from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class ProviderConfigSchema(BaseModel):
    provider_key: str
    display_name: str
    enabled: bool = False
    provider_type: str
    endpoint: str
    auth_type: str = "none"
    auth_payload: Dict[str, Any] = {}
    fetch_interval_seconds: Optional[int] = None
    ttl_seconds: int = 86400
    config_json: Dict[str, Any] = {}

    class Config:
        from_attributes = True

class ProviderConfigUpdate(BaseModel):
    display_name: Optional[str] = None
    enabled: Optional[bool] = None
    endpoint: Optional[str] = None
    auth_type: Optional[str] = None
    auth_payload: Optional[Dict[str, Any]] = None
    fetch_interval_seconds: Optional[int] = None
    ttl_seconds: Optional[int] = None
    config_json: Optional[Dict[str, Any]] = None

class ReloadResponse(BaseModel):
    status: str
    providers_loaded: List[str]

class EnrichRequest(BaseModel):
    value: str
    type: Optional[str] = None # 'ip', 'domain', 'url'

class ProviderEvidence(BaseModel):
    provider_key: str
    score: float
    data: Dict[str, Any]

class EnrichResponse(BaseModel):
    value: str
    type: str
    total_score: float
    evidences: List[ProviderEvidence]
    cached: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
