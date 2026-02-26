import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas import EnrichRequest, EnrichResponse, ProviderEvidence
from ..config import config_manager
from ..providers.factory import ProviderFactory
from ..services.cache import cache_service
from ..services.scoring import scoring_service
from ..models import Alert, AlertEvidence

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/enrich", response_model=EnrichResponse)
async def enrich_value(request: EnrichRequest, db: AsyncSession = Depends(get_db)):
    value = request.value
    
    # 1. Check Cache
    cached_result = await cache_service.get(value)
    if cached_result:
        return EnrichResponse(**cached_result, cached=True)

    # 2. Get Active Providers
    providers_config = config_manager.snapshot.get("providers", {})
    active_providers = [k for k, v in providers_config.items() if v.get("enabled")]
    
    if not active_providers:
        return EnrichResponse(value=value, type="unknown", total_score=0, evidences=[])

    # 3. Parallel Execution
    tasks = []
    for p_key in active_providers:
        adapter = ProviderFactory.get_adapter(p_key, providers_config[p_key])
        if adapter:
            tasks.append(adapter.check(value))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    evidences = []
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"Provider error: {res}")
            continue
        if res:
            evidences.append(ProviderEvidence(
                provider_key=res["provider_key"],
                score=res["score"],
                data=res["data"]
            ))

    # 4. Scoring
    total_score = scoring_service.calculate(evidences)
    
    # 5. Persistence
    alert = Alert(value=value, type=request.type or "unknown", score=total_score)
    db.add(alert)
    await db.flush()
    
    for ev in evidences:
        db_ev = AlertEvidence(
            alert_id=alert.id,
            provider_key=ev.provider_key,
            evidence_data=ev.data,
            score=ev.score
        )
        db.add(db_ev)
    
    await db.commit()

    response = EnrichResponse(
        value=value,
        type=alert.type,
        total_score=total_score,
        evidences=evidences
    )

    # 6. Cache
    await cache_service.set(value, response.dict())

    return response
