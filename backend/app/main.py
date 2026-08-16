from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.api.routes import assets, demo, field_actions, operations
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import Base, SessionLocal, engine
from app.scripts.seed import reset_demo_dataset

logger = get_logger("main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("main/lifespan - start", extra={"params": {"environment": settings.environment}})
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "assets" in inspector.get_table_names():
        db = SessionLocal()
        try:
            has_data = db.execute(Base.metadata.tables["assets"].select().limit(1)).first()
        finally:
            db.close()
        if not has_data:
            logger.info("main/lifespan - seeding empty database", extra={"params": {}})
            reset_demo_dataset()

    yield
    logger.info("main/lifespan - shutdown", extra={"params": {}})


app = FastAPI(
    title=settings.app_name,
    description="Phase 1 AI Asset Intelligence Platform POC — Operations Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router, prefix=settings.api_prefix)
app.include_router(operations.router, prefix=settings.api_prefix)
app.include_router(field_actions.router, prefix=settings.api_prefix)
app.include_router(demo.router, prefix=settings.api_prefix)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
