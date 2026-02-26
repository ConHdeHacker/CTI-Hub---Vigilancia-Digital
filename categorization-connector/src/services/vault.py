import hvac
import logging
from typing import Dict, Any, Optional
from ..config import settings

logger = logging.getLogger(__name__)

class VaultService:
    def __init__(self):
        self.client = None
        if settings.VAULT_ADDR:
            try:
                self.client = hvac.Client(url=settings.VAULT_ADDR, token=settings.VAULT_TOKEN)
            except Exception as e:
                logger.error(f"Failed to initialize Vault client: {e}")

    async def get_secrets(self, path: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            # hvac is synchronous, in a real async app we might use a wrapper or a different lib
            # but for this example we'll assume it's fast enough or used during init
            read_response = self.client.secrets.kv.v2.read_secret_version(path=path)
            return read_response['data']['data']
        except Exception as e:
            logger.error(f"Error reading from Vault at {path}: {e}")
            return None
