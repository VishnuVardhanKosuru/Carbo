"""
Carbo Backend — FastAPI application factory (v2.1.0).

Configures:
- Structured JSON logging (stdout, Cloud Run compatible)
- GZip response compression middleware
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS middleware (configurable via ALLOWED_ORIGINS env var)
- Pydantic v2 settings via app.config
- In-memory TTL cache initialised at startup
- Global exception handlers for ValidationError and unhandled errors
- Router registration for all API endpoints

Architecture mirrors ElectionApp's main.py for consistency.
"""

from __future__ import annotations

import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.api.endpoints import router
from app.config import get_settings
from app.models.schemas import ErrorDetail

# ---------------------------------------------------------------------------
# Settings singleton
# ---------------------------------------------------------------------------

settings = get_settings()
_LOG_LEVEL_INT = getattr(logging, settings.log_level.upper(), logging.INFO)


# ---------------------------------------------------------------------------
# Structured JSON logging (stdout — parseable by Cloud Run log collector)
# ---------------------------------------------------------------------------


def _configure_logging() -> None:
    """Set up structured JSON logging to stdout."""
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "format": (
                        '{"severity":"%(levelname)s","message":"%(message)s",'
                        '"logger":"%(name)s","time":"%(asctime)s"}'
                    ),
                    "datefmt": "%Y-%m-%dT%H:%M:%S%z",
                }
            },
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                    "formatter": "json",
                }
            },
            "root": {
                "level": settings.log_level.upper(),
                "handlers": ["stdout"],
            },
        }
    )


_configure_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------


async def _security_headers_middleware(request: Request, call_next):
    """Attach security headers to every response.

    Implements OWASP-recommended headers:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: geolocation=()

    Args:
        request: Incoming HTTP request.
        call_next: Next middleware or route handler.

    Returns:
        HTTP response with security headers attached.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    return response


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager.

    Startup:
      1. Log the application version and environment.
      2. Initialise the TTL cache.

    Shutdown:
      1. Log graceful shutdown.

    Args:
        app: The FastAPI application instance.

    Yields:
        Control to the application.
    """
    logger.info(
        "Carbo API starting.",
        extra={"version": settings.version, "env": settings.env},
    )
    # Eagerly touch the cache so TTLCache is initialised
    from app import cache as cache_module  # noqa: PLC0415

    cache_module.stats()  # warms the singleton
    logger.info("Cache initialised.")

    yield  # ← application runs here

    logger.info("Carbo API shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured ``FastAPI`` instance ready to serve requests.
    """
    app = FastAPI(
        title="Carbo — Carbon Footprint API",
        description=(
            "Production-grade REST API for tracking personal carbon footprints. "
            "Provides footprint calculation, history persistence, personalised "
            "eco-tips, and emission factor reference data."
        ),
        version=settings.version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # --- GZip compression (mirrors ElectionApp) ---
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Security headers (raw middleware via decorator) ---
    app.middleware("http")(_security_headers_middleware)

    # --- Global exception handlers ---
    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):  # pragma: no cover
        logger.warning("Pydantic validation error.", extra={"errors": exc.errors()})  # pragma: no cover
        return JSONResponse(  # pragma: no cover
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorDetail(
                code="VALIDATION_ERROR",
                message="Request validation failed.",
                details=str(exc.errors()[:3]),
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception.", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorDetail(
                code="INTERNAL_ERROR",
                message="An unexpected internal error occurred.",
            ).model_dump(),
        )

    # --- Routers ---
    app.include_router(router)

    return app


app = create_app()


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":  # pragma: no cover
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )
