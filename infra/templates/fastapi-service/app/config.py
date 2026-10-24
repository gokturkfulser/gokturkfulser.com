"""Ortam değişkenlerinden okunan ayarlar (pydantic-settings)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Ortam değişkeni adları alan adlarıdır: APP_NAME, ENVIRONMENT, LOG_LEVEL, PORT.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "sablon"
    environment: str = "production"
    log_level: str = "INFO"
    # uvicorn portu Dockerfile CMD'inde sabit (8000); değiştirirsen ikisini birlikte değiştir.
    port: int = 8000
    # Dağıtılan image'ın sürümü; CI build-arg ile gömer (bkz. Dockerfile).
    version: str = "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
