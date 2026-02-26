from typing import Any, Dict, Optional
from .base import BaseProvider

class AbuseIPDBProvider(BaseProvider):
    async def check(self, value: str) -> Optional[Dict[str, Any]]:
        api_key = self.auth_payload.get("api_key")
        if not api_key:
            return None

        headers = {
            "Key": api_key,
            "Accept": "application/json"
        }
        params = {
            "ipAddress": value,
            "maxAgeInDays": 90
        }
        
        try:
            response = await self._get(self.endpoint, params=params, headers=headers)
            data = response.json().get("data", {})
            
            confidence_score = data.get("abuseConfidenceScore", 0)
            return {
                "provider_key": self.provider_key,
                "score": confidence_score / 100.0,
                "data": data
            }
        except Exception:
            return None
