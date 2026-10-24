import logging

from fastapi import FastAPI

from app.config import get_settings
from app.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.version)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": settings.version}


@app.get("/")
def root() -> dict[str, str]:
    logger.info("kök istek", extra={"environment": settings.environment})
    return {"service": settings.app_name}
