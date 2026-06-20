"""
Carbo Backend — FastAPI route controllers.

Implements the following endpoints (mirroring ElectionApp's endpoint style):
  GET  /api/v1/health                – Service health check (liveness probe)
  GET  /api/v1/cache/stats           – In-memory cache hit/miss statistics
  POST /api/v1/footprint/calculate   – Calculate carbon footprint
  POST /api/v1/footprint/log         – Log and persist a footprint record
  GET  /api/v1/footprint/history     – Retrieve all stored records
  DELETE /api/v1/footprint/history   – Clear all stored records
  POST /api/v1/tips                  – Generate personalised eco-tips
  GET  /api/v1/factors               – Emission factors reference data

All routes use strict Pydantic v2 validation and return structured
HTTP errors with machine-readable ``ErrorDetail`` codes.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app import cache as cache_module
from app.config import get_settings
from app.models.schemas import (
    CacheStatsResponse,
    EmissionFactors,
    ErrorDetail,
    FootprintRequest,
    FootprintResult,
    HealthResponse,
    HistoryResponse,
    LogRecordRequest,
    TipsResponse,
    DietType,
)
from app.services import footprint_service, history_service, tips_service

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1", tags=["Carbo API"])

# Module-level start time for uptime calculation
_START_TIME: float = time.monotonic()


# ---------------------------------------------------------------------------
# Health & Monitoring
# ---------------------------------------------------------------------------


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description=(
        "Returns service status, version, and uptime in seconds. "
        "Used as a liveness/readiness probe. Always returns HTTP 200 when operational."
    ),
)
async def health_check() -> HealthResponse:
    """Return service health status.

    Returns:
        ``HealthResponse`` with status='ok', version, uptime, and environment.
    """
    return HealthResponse(
        status="ok",
        version=settings.version,
        uptime_seconds=round(time.monotonic() - _START_TIME, 2),
        environment=settings.env,
    )


@router.get(
    "/cache/stats",
    response_model=CacheStatsResponse,
    summary="Cache Statistics",
    description="Returns TTL cache hit/miss counts and current fill level.",
)
async def cache_stats() -> CacheStatsResponse:
    """Return in-memory cache performance statistics.

    Returns:
        ``CacheStatsResponse`` with hit count, miss count, hit rate, and size info.
    """
    s = cache_module.stats()
    return CacheStatsResponse(**s)


# ---------------------------------------------------------------------------
# Footprint Calculation
# ---------------------------------------------------------------------------


@router.post(
    "/footprint/calculate",
    response_model=FootprintResult,
    status_code=status.HTTP_200_OK,
    summary="Calculate Carbon Footprint",
    description=(
        "Accepts transport km, energy kWh, and diet type. Returns the daily "
        "carbon footprint broken down by category, with a letter grade "
        "(A–E) relative to the global average of 4.7 kg CO₂/day."
    ),
)
async def calculate_footprint(request: FootprintRequest) -> FootprintResult:
    """Calculate a daily carbon footprint from activity inputs.

    Results are cached by SHA-256 key of the input parameters (TTL=5 min)
    to reduce computation on repeated identical requests.

    Args:
        request: Validated ``FootprintRequest`` body.

    Returns:
        ``FootprintResult`` with breakdown, total, date, and grade.
    """
    # Check cache first
    key = cache_module.make_key(
        "calculate",
        request.transport_km,
        request.energy_kwh,
        request.diet.value,
        request.record_date,
    )
    cached = cache_module.get(key)
    if cached:
        logger.debug("Cache hit for footprint calculation.")
        return FootprintResult(**cached)

    result = footprint_service.calculate_footprint(request)
    cache_module.set(key, result.model_dump())
    return result


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


@router.post(
    "/footprint/log",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Log Footprint Record",
    description="Persist a footprint record to the in-memory store (upsert by date).",
)
async def log_footprint(request: LogRecordRequest) -> dict:
    """Persist a new or updated footprint record.

    Args:
        request: Validated ``LogRecordRequest`` body.

    Returns:
        The stored record as a dict.
    """
    record = history_service.log_record(request)
    return record.model_dump()


@router.get(
    "/footprint/history",
    response_model=HistoryResponse,
    summary="Get Footprint History",
    description="Returns all stored footprint records sorted by date ascending.",
)
async def get_history() -> HistoryResponse:
    """Return the full footprint history.

    Returns:
        ``HistoryResponse`` with records, count, total, and average.
    """
    return history_service.get_history()


@router.delete(
    "/footprint/history",
    summary="Clear Footprint History",
    description="Delete all stored footprint records.",
    status_code=status.HTTP_200_OK,
)
async def clear_history() -> dict:
    """Clear all stored footprint records.

    Returns:
        Confirmation dict with number of deleted records.
    """
    return history_service.clear_history()


# ---------------------------------------------------------------------------
# Tips
# ---------------------------------------------------------------------------


@router.post(
    "/tips",
    response_model=TipsResponse,
    summary="Generate Eco Tips",
    description="Returns personalised eco-tips based on activity inputs.",
)
async def get_tips(request: FootprintRequest) -> TipsResponse:
    """Generate context-aware eco-tips from activity data.

    Args:
        request: Validated ``FootprintRequest`` body (only diet, transport_km,
                 energy_kwh are used; record_date is ignored).

    Returns:
        ``TipsResponse`` with a list of actionable tips.
    """
    return tips_service.generate_tips(
        transport_km=request.transport_km,
        energy_kwh=request.energy_kwh,
        diet=request.diet,
    )


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------


@router.get(
    "/factors",
    response_model=EmissionFactors,
    summary="Emission Factors",
    description=(
        "Returns the emission factors used in footprint calculations "
        "(EPA/DEFRA dataset). Useful for client-side preview calculations."
    ),
)
async def get_factors() -> EmissionFactors:
    """Return emission factor reference data.

    Returns:
        ``EmissionFactors`` containing transport, energy, and diet factors.
    """
    data = footprint_service.get_emission_factors()
    return EmissionFactors(**data)
