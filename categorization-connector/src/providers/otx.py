from typing import Any, Dict, Optional
from .base import BaseProvider

class OTXProvider(BaseProvider):
    async def check(self, value: str) -> Optional[Dict[str, Any]]:
        api_key = self.auth_payload.get("api_key")
        # OTX can work without API key for some endpoints but limited
        
        headers = {"X-OTX-API-KEY": api_key} if api_key else {}
        
        # Determine type (simplified)
        indicator_type = "domain" if "." in value and not value.replace(".","").isdigit() else "IPv4"
        url = f"{self.endpoint}{indicator_type}/{value}/general"
        
        try:
            response = await self._get(url, headers=headers)
            data = response.json()
            
            pulse_count = data.get("pulse_info", {}).get("count", 0)
            return {
                "provider_key": self.provider_key,
                "score": min(pulse_count / 10.0, 1.0),
                "data": data
            }
        except Exception:
            return None
