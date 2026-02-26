from typing import Any, Dict, Optional
from .base import BaseProvider

class URLHausProvider(BaseProvider):
    async def check(self, value: str) -> Optional[Dict[str, Any]]:
        # URLHaus API for single check
        api_url = "https://urlhaus-api.abuse.ch/v1/url/"
        try:
            # Note: URLHaus API is POST for URL check
            # For simplicity, we use the API instead of parsing the whole feed in runtime
            response = await self._post(api_url, json={"url": value})
            data = response.json()
            
            if data.get("query_status") == "ok":
                return {
                    "provider_key": self.provider_key,
                    "score": 1.0 if data.get("url_status") == "online" else 0.5,
                    "data": data
                }
            return None
        except Exception:
            return None
