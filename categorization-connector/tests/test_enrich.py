import pytest
import respx
from httpx import Response
from src.config import settings, config_manager

@pytest.mark.asyncio
@respx.mock
async def test_enrich_flow(client, db_session):
    # Setup: Mock a provider in config
    headers = {"x-admin-token": settings.ADMIN_API_TOKEN}
    provider_data = {
        "provider_key": "abuseipdb",
        "display_name": "AbuseIPDB",
        "enabled": True,
        "provider_type": "api",
        "endpoint": "https://api.abuseipdb.com/api/v2/check",
        "auth_type": "api_key",
        "auth_payload": {"api_key": "test_key"}
    }
    await client.post("/v1/admin/providers", json=provider_data, headers=headers)
    await client.post("/v1/admin/reload", headers=headers)

    # Mock the external API call
    respx.get("https://api.abuseipdb.com/api/v2/check").mock(return_value=Response(200, json={
        "data": {
            "ipAddress": "1.2.3.4",
            "abuseConfidenceScore": 85,
            "countryCode": "US"
        }
    }))

    # Execute Enrich
    response = await client.post("/v1/enrich", json={"value": "1.2.3.4", "type": "ip"})
    assert response.status_code == 200
    data = response.json()
    
    assert data["value"] == "1.2.3.4"
    assert data["total_score"] == 0.85
    assert len(data["evidences"]) == 1
    assert data["evidences"][0]["provider_key"] == "abuseipdb"
    assert data["evidences"][0]["score"] == 0.85
