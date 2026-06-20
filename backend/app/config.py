"""
Carbo Backend — Application Settings (Pydantic v2).

Reads environment variables with sensible defaults.
Mirrors the ElectionApp config pattern for consistency.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings resolved from environment variables / .env file.

    Attributes:
        app_name: Human-readable application name.
        version: Semantic version string.
        port: Port the ASGI server listens on.
        log_level: Python logging level (DEBUG, INFO, WARNING, ERROR).
        allowed_origins: Comma-separated CORS allowed origins.
        cache_ttl_seconds: TTL for the in-memory response cache.
        cache_maxsize: Maximum number of entries in the TTL cache.
        env: Runtime environment ('production' | 'development').
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="Carbo — Carbon Footprint API", description="Application name.")
    version: str = Field(default="2.1.0", description="Semantic version.")
    port: int = Field(default=8001, ge=1, le=65535, description="Listening port.")
    log_level: str = Field(default="INFO", description="Python log level.")
    allowed_origins: str = Field(default="*", description="Comma-separated CORS origins.")
    cache_ttl_seconds: int = Field(default=300, ge=0, description="Cache TTL in seconds.")
    cache_maxsize: int = Field(default=512, ge=1, description="Max cache entries.")
    env: str = Field(default="production", description="Runtime environment.")

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Ensure log_level is a valid Python logging level name."""
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}, got '{v}'.")
        return upper

    def get_allowed_origins(self) -> list[str]:
        """Parse the comma-separated CORS origins string into a list.

        Returns:
            List of origin strings, stripped of whitespace.
        """
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        """Return True when running in development mode."""
        return self.env.lower() == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached Settings singleton.

    Using ``lru_cache`` ensures the .env file is parsed exactly once per
    process, matching the pattern used in ElectionApp.

    Returns:
        The application ``Settings`` instance.
    """
    return Settings()
