import os
import yaml
import logging
import asyncio
from typing import Any, Dict, List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from sqlalchemy import select
from .database import async_session
from .models import ProviderConfig
from .services.vault import VaultService

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:password@localhost:5432/categorization")
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    ADMIN_API_TOKEN: str = Field(default="changeme")
    VAULT_ADDR: Optional[str] = None
    VAULT_TOKEN: Optional[str] = None
    CONFIG_TTL_SECONDS: int = 86400
    
    class Config:
        env_file = ".env"

settings = Settings()

class ConfigManager:
    _instance = None
    _snapshot: Dict[str, Any] = {}
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigManager, cls).__new__(cls)
        return cls._instance

    @property
    def snapshot(self) -> Dict[str, Any]:
        return self._snapshot

    async def reload(self):
        async with self._lock:
            logger.info("Reloading configuration...")
            new_config = await self._load_config()
            self._snapshot = new_config
            logger.info("Configuration reloaded successfully.")

    async def _load_config(self) -> Dict[str, Any]:
        # 1. Load from config.yml (Bootstrap)
        yml_config = self._load_from_yml()
        
        # 2. Load from DB
        db_providers = await self._load_from_db()
        
        # Merge: DB overrides YML
        providers = {p["provider_key"]: p for p in yml_config.get("providers", [])}
        for db_p in db_providers:
            providers[db_p["provider_key"]] = db_p

        # 3. Handle Secrets (Vault -> Env -> DB)
        vault = VaultService()
        for key, p in providers.items():
            # Try Vault if configured
            if p.get("auth_type") == "vault" or settings.VAULT_ADDR:
                vault_path = p.get("auth_payload", {}).get("vault")
                if vault_path:
                    secrets = await vault.get_secrets(vault_path)
                    if secrets:
                        p["auth_payload"].update(secrets)
            
            # Fallback to Env vars for emergency
            env_key = f"CONFIG_{key.upper()}_API_KEY"
            if os.getenv(env_key):
                p["auth_payload"]["api_key"] = os.getenv(env_key)

        return {"providers": providers}

    def _load_from_yml(self) -> Dict[str, Any]:
        config_path = os.getenv("CONFIG_YML_PATH", "config.yml")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                return yaml.safe_load(f) or {}
        return {}

    async def _load_from_db(self) -> List[Dict[str, Any]]:
        try:
            async with async_session() as session:
                result = await session.execute(select(ProviderConfig))
                configs = result.scalars().all()
                return [
                    {
                        "provider_key": c.provider_key,
                        "display_name": c.display_name,
                        "enabled": c.enabled,
                        "provider_type": c.provider_type,
                        "endpoint": c.endpoint,
                        "auth_type": c.auth_type,
                        "auth_payload": c.auth_payload,
                        "fetch_interval_seconds": c.fetch_interval_seconds,
                        "ttl_seconds": c.ttl_seconds,
                        "config_json": c.config_json
                    }
                    for c in configs
                ]
        except Exception as e:
            logger.error(f"Error loading config from DB: {e}")
            return []

config_manager = ConfigManager()
