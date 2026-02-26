import abc
import httpx
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class BaseProvider(abc.ABC):
    def __init__(self, provider_key: str, config: Dict[str, Any]):
        self.provider_key = provider_key
        self.config = config
        self.endpoint = config.get("endpoint")
        self.auth_payload = config.get("auth_payload", {})
        self.config_json = config.get("config_json", {})
        self.timeout = httpx.Timeout(10.0, connect=5.0)

    @abc.abstractmethod
    async def check(self, value: str) -> Optional[Dict[str, Any]]:
        pass

    async def _get(self, url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None):
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response
            except httpx.HTTPError as e:
                logger.error(f"HTTP error for {self.provider_key}: {e}")
                raise

    async def _post(self, url: str, json: Optional[Dict] = None, headers: Optional[Dict] = None):
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=json, headers=headers)
                response.raise_for_status()
                return response
            except httpx.HTTPError as e:
                logger.error(f"HTTP error for {self.provider_key}: {e}")
                raise
