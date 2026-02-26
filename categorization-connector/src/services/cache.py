import json
import redis.asyncio as redis
from typing import Any, Dict, Optional
from ..config import settings

class CacheService:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        data = await self.redis.get(f"cat:{key}")
        if data:
            return json.loads(data)
        return None

    async def set(self, key: str, value: Dict[str, Any], ttl: int = 3600):
        await self.redis.set(f"cat:{key}", json.dumps(value), ex=ttl)

cache_service = CacheService()
