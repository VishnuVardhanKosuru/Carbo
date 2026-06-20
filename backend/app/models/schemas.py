"""
Carbo Backend — Pydantic v2 request/response schemas.

Provides strict input validation and sanitization to prevent injection
attacks, mirroring the pattern from ElectionApp schemas.py.
"""

from __future__ import annotations

import re
from datetime import date
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class DietType(str, Enum):
    """Supported diet categories with associated emission factors."""
    vegetarian = "vegetarian"
    average = "average"
    meatlover = "meatlover"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class FootprintRequest(BaseModel):
    """Request payload for calculating a daily carbon footprint.

    Attributes:
        transport_km: Kilometres of car/motorbike travel today.
        energy_kwh: kWh of home electricity consumed today.
        diet: Diet type for the day.
        date: ISO date string for this record (defaults to today).
    """

    transport_km: float = Field(
        ...,
        ge=0,
        le=10_000,
        description="Kilometres of motorised transport today (0–10 000).",
        examples=[15.0],
    )
    energy_kwh: float = Field(
        ...,
        ge=0,
        le=1_000,
        description="kWh of home electricity consumed today (0–1 000).",
        examples=[8.0],
    )
    diet: DietType = Field(
        ...,
        description="Diet type: 'vegetarian', 'average', or 'meatlover'.",
        examples=["average"],
    )
    record_date: Optional[str] = Field(
        default=None,
        description="ISO 8601 date (YYYY-MM-DD). Defaults to today if omitted.",
        examples=["2026-06-20"],
    )

    @field_validator("record_date", mode="before")
    @classmethod
    def validate_date(cls, v: Any) -> Optional[str]:
        """Validate ISO date format if provided.

        Args:
            v: Raw date value from client.

        Returns:
            Validated date string or None.

        Raises:
            ValueError: If the date string is not a valid ISO 8601 date.
        """
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("record_date must be a string in YYYY-MM-DD format.")
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date '{v}'. Expected format: YYYY-MM-DD.")
        return v


class LogRecordRequest(BaseModel):
    """Request payload for persisting a footprint record (with pre-computed value).

    Attributes:
        transport_km: Kilometres of transport.
        energy_kwh: kWh of energy.
        diet: Diet type.
        footprint_kg: Pre-calculated footprint (kg CO₂).
        record_date: ISO date string.
    """

    transport_km: float = Field(..., ge=0, le=10_000)
    energy_kwh: float = Field(..., ge=0, le=1_000)
    diet: DietType
    footprint_kg: float = Field(..., ge=0, description="Total CO₂ in kilograms.")
    record_date: str = Field(..., description="ISO 8601 date (YYYY-MM-DD).")

    @field_validator("record_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        """Validate ISO date format.

        Args:
            v: Date string.

        Returns:
            Validated date string.

        Raises:
            ValueError: If not valid ISO 8601.
        """
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date '{v}'. Expected YYYY-MM-DD.")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class FootprintResult(BaseModel):
    """Response schema for a single footprint calculation.

    Attributes:
        transport_kg: CO₂ from transport (kg).
        energy_kg: CO₂ from energy (kg).
        diet_kg: CO₂ from diet (kg).
        total_kg: Total footprint (kg CO₂).
        record_date: Date this footprint was calculated for.
        grade: Letter grade (A–E) based on global avg comparison.
    """

    transport_kg: float
    energy_kg: float
    diet_kg: float
    total_kg: float
    record_date: str
    grade: str


class FootprintRecord(BaseModel):
    """A stored footprint record including activity breakdown.

    Attributes:
        id: Unique record identifier.
        record_date: ISO date string.
        transport_km: km of transport.
        energy_kwh: kWh of energy.
        diet: Diet type.
        footprint_kg: Total CO₂ (kg).
    """

    id: str
    record_date: str
    transport_km: float
    energy_kwh: float
    diet: DietType
    footprint_kg: float


class HistoryResponse(BaseModel):
    """Response containing all stored footprint records.

    Attributes:
        records: List of footprint records, sorted by date ascending.
        count: Total number of records.
        total_kg: Sum of all footprint values.
        avg_daily_kg: Average daily footprint.
    """

    records: List[FootprintRecord]
    count: int
    total_kg: float
    avg_daily_kg: float


class TipsResponse(BaseModel):
    """Personalised eco-tips based on activity data.

    Attributes:
        tips: List of tip strings.
        transport_tip: Tip specific to transport (if applicable).
        energy_tip: Tip specific to energy (if applicable).
        diet_tip: Tip specific to diet (if applicable).
    """

    tips: List[str]
    transport_tip: Optional[str] = None
    energy_tip: Optional[str] = None
    diet_tip: Optional[str] = None


class EmissionFactors(BaseModel):
    """Reference data: emission factors used in calculations.

    Attributes:
        transport_kg_per_km: kg CO₂ per km of car travel.
        energy_kg_per_kwh: kg CO₂ per kWh of electricity.
        diet_factors: kg CO₂ per day per diet type.
        global_avg_daily_kg: Global average daily footprint (kg CO₂).
    """

    transport_kg_per_km: float
    energy_kg_per_kwh: float
    diet_factors: dict[str, float]
    global_avg_daily_kg: float


class HealthResponse(BaseModel):
    """Service health check response.

    Attributes:
        status: Always 'ok' when the service is operational.
        version: Semantic version of the API.
        uptime_seconds: Seconds since the process started.
        environment: Runtime environment string.
    """

    status: str
    version: str
    uptime_seconds: float
    environment: str


class CacheStatsResponse(BaseModel):
    """Cache hit/miss statistics response.

    Attributes:
        hits: Number of cache hits since startup.
        misses: Number of cache misses since startup.
        hit_rate_pct: Percentage of requests served from cache.
        current_size: Current number of cached entries.
        max_size: Maximum cache capacity.
        ttl_seconds: Time-to-live per entry in seconds.
        uptime_seconds: Seconds since cache module was initialised.
    """

    hits: int
    misses: int
    hit_rate_pct: float
    current_size: int
    max_size: int
    ttl_seconds: int
    uptime_seconds: float


class ErrorDetail(BaseModel):
    """Machine-readable error response body.

    Attributes:
        code: Short uppercase error code (e.g. 'VALIDATION_ERROR').
        message: Human-readable error message.
        details: Optional extra context (truncated to 300 chars).
    """

    code: str
    message: str
    details: Optional[str] = None
