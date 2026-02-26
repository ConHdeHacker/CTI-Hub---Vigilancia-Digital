import pytest
from src.config import settings

@pytest.mark.asyncio
async def test_list_providers_unauthorized(client):
    response = await client.get("/v1/admin/providers")
    assert response.status_code == 422 # Missing header

@pytest.mark.asyncio
async def test_list_providers_forbidden(client):
    response = await client.get("/v1/admin/providers", headers={"x-admin-token": "wrong"})
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_create_and_list_provider(client):
    headers = {"x-admin-token": settings.ADMIN_API_TOKEN}
    provider_data = {
        "provider_key": "test_prov",
        "display_name": "Test Provider",
        "enabled": True,
        "provider_type": "api",
        "endpoint": "http://test.com"
    }
    
    # Create
    resp = await client.post("/v1/admin/providers", json=provider_data, headers=headers)
    assert resp.status_code == 200
    
    # List
    resp = await client.get("/v1/admin/providers", headers=headers)
    assert resp.status_code == 200
    providers = resp.json()
    assert any(p["provider_key"] == "test_prov" for p in providers)

@pytest.mark.asyncio
async def test_reload_config(client):
    headers = {"x-admin-token": settings.ADMIN_API_TOKEN}
    resp = await client.post("/v1/admin/reload", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
