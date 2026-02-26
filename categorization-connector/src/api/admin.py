from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List
from ..database import get_db
from ..models import ProviderConfig
from ..schemas import ProviderConfigSchema, ProviderConfigUpdate, ReloadResponse
from ..config import config_manager, settings

router = APIRouter()

async def verify_admin(x_admin_token: str = Header(...)):
    if x_admin_token != settings.ADMIN_API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid admin token")

@router.get("/providers", response_model=List[ProviderConfigSchema], dependencies=[Depends(verify_admin)])
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProviderConfig))
    return result.scalars().all()

@router.post("/providers", response_model=ProviderConfigSchema, dependencies=[Depends(verify_admin)])
async def create_provider(config: ProviderConfigSchema, db: AsyncSession = Depends(get_db)):
    db_config = ProviderConfig(**config.dict())
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

@router.put("/providers/{provider_key}", response_model=ProviderConfigSchema, dependencies=[Depends(verify_admin)])
async def update_provider(provider_key: str, update_data: ProviderConfigUpdate, db: AsyncSession = Depends(get_db)):
    query = update(ProviderConfig).where(ProviderConfig.provider_key == provider_key).values(**update_data.dict(exclude_unset=True)).returning(ProviderConfig)
    result = await db.execute(query)
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=404, detail="Provider not found")
    await db.commit()
    return updated

@router.post("/reload", response_model=ReloadResponse, dependencies=[Depends(verify_admin)])
async def reload_config():
    await config_manager.reload()
    return {"status": "success", "providers_loaded": list(config_manager.snapshot["providers"].keys())}

@router.get("/providers/{provider_key}/config", dependencies=[Depends(verify_admin)])
async def get_provider_runtime_config(provider_key: str):
    config = config_manager.snapshot["providers"].get(provider_key)
    if not config:
        raise HTTPException(status_code=404, detail="Provider not found in runtime")
    
    # Hide sensitive data
    safe_config = config.copy()
    if "auth_payload" in safe_config:
        safe_config["auth_payload"] = {k: "***" for k in safe_config["auth_payload"]}
    return safe_config
