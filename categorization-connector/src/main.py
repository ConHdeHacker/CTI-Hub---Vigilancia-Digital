import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from .config import config_manager
from .api import admin, enrich
from prometheus_client import make_asgi_app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load initial config
    await config_manager.reload()
    yield

app = FastAPI(
    title="Categorization Connector",
    version="1.0.0",
    lifespan=lifespan
)

# Metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Routes
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])
app.include_router(enrich.router, prefix="/v1", tags=["Enrich"])

@app.get("/health")
async def health():
    return {"status": "ok"}
