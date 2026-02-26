import dns.asyncresolver
from typing import Any, Dict, Optional
from .base import BaseProvider

class SpamhausProvider(BaseProvider):
    async def check(self, value: str) -> Optional[Dict[str, Any]]:
        # Only for IPs
        import ipaddress
        try:
            ipaddress.ip_address(value)
        except ValueError:
            return None

        # Reverse IP for DNSBL
        rev_ip = ".".join(reversed(value.split(".")))
        query = f"{rev_ip}.{self.endpoint}"
        
        try:
            resolver = dns.asyncresolver.Resolver()
            resolver.timeout = 2.0
            resolver.lifetime = 2.0
            answers = await resolver.resolve(query, "A")
            
            # 127.0.0.2 = SBL, 127.0.0.3 = CSS, etc.
            results = [str(r) for r in answers]
            return {
                "provider_key": self.provider_key,
                "score": 0.8 if results else 0,
                "data": {"dns_responses": results}
            }
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return None
        except Exception:
            return None
