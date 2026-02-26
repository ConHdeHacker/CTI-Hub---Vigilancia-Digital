from typing import Dict, Any, Optional
from .base import BaseProvider
from .urlhaus import URLHausProvider
from .abuseipdb import AbuseIPDBProvider
from .otx import OTXProvider
from .spamhaus import SpamhausProvider

class ProviderFactory:
    _adapters = {
        "urlhaus": URLHausProvider,
        "abuseipdb": AbuseIPDBProvider,
        "otx": OTXProvider,
        "spamhaus_dnsbl": SpamhausProvider
    }

    @classmethod
    def get_adapter(cls, provider_key: str, config: Dict[str, Any]) -> Optional[BaseProvider]:
        adapter_cls = cls._adapters.get(provider_key)
        if not adapter_cls:
            # Fallback to generic based on type if needed
            return None
        return adapter_cls(provider_key, config)
