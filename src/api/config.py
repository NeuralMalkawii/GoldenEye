"""Runtime configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    model_path: str = "models/best.onnx"
    confidence_threshold: float = 0.25
    nms_iou_threshold: float = 0.45
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"
    upload_dir: str = "uploads"
    jobs_dir: str = "jobs"
    max_upload_mb: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()
