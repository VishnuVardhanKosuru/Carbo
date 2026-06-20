"""
Carbo Backend — Carbon footprint calculation service.

Implements EPA/DEFRA-based emission factors and business logic for
computing daily carbon footprints. Mirrors the layered service
architecture from ElectionApp's election_logic.py.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from app.models.schemas import DietType, FootprintRequest, FootprintResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Emission factors (EPA / DEFRA public datasets)
# ---------------------------------------------------------------------------

EMISSION_FACTORS: dict[str, Any] = {
    # Average passenger car: 0.192 kg CO₂ per km
    "transport_kg_per_km": 0.192,
    # UK grid average electricity: 0.233 kg CO₂ per kWh (2024 DEFRA)
    "energy_kg_per_kwh": 0.233,
    # Diet daily footprint (kg CO₂ per day)
    "diet": {
        DietType.vegetarian: 2.5,
        DietType.average: 3.8,
        DietType.meatlover: 5.0,
    },
    # Global average daily per-capita footprint (kg CO₂)
    "global_avg_daily_kg": 4.7,
}

# Letter-grade thresholds vs global average
_GRADE_THRESHOLDS: list[tuple[float, str]] = [
    (0.50, "A"),   # ≤ 50% of global avg
    (0.75, "B"),   # ≤ 75%
    (1.00, "C"),   # ≤ 100% (at global avg)
    (1.50, "D"),   # ≤ 150%
    (float("inf"), "E"),  # > 150%
]


def _compute_grade(total_kg: float) -> str:
    """Assign a letter grade (A–E) based on comparison with the global average.

    Args:
        total_kg: Calculated total footprint in kg CO₂.

    Returns:
        Single letter grade string.
    """
    global_avg = EMISSION_FACTORS["global_avg_daily_kg"]
    ratio = total_kg / global_avg if global_avg else 1.0
    for threshold, grade in _GRADE_THRESHOLDS:
        if ratio <= threshold:
            return grade
    return "E"


def calculate_footprint(request: FootprintRequest) -> FootprintResult:
    """Calculate the carbon footprint for a single day's activities.

    Emission formula:
        transport_kg = transport_km × 0.192
        energy_kg    = energy_kwh  × 0.233
        diet_kg      = diet_factor[diet_type]
        total_kg     = transport_kg + energy_kg + diet_kg

    Args:
        request: Validated ``FootprintRequest`` containing activity data.

    Returns:
        ``FootprintResult`` with per-category breakdown, total, date, and grade.
    """
    transport_kg = round(request.transport_km * EMISSION_FACTORS["transport_kg_per_km"], 4)
    energy_kg    = round(request.energy_kwh   * EMISSION_FACTORS["energy_kg_per_kwh"],    4)
    diet_kg      = EMISSION_FACTORS["diet"][request.diet]
    total_kg     = round(transport_kg + energy_kg + diet_kg, 2)
    grade        = _compute_grade(total_kg)
    record_date  = request.record_date or date.today().isoformat()

    logger.info(
        "Footprint calculated.",
        extra={
            "transport_km": request.transport_km,
            "energy_kwh": request.energy_kwh,
            "diet": request.diet,
            "total_kg": total_kg,
            "grade": grade,
        },
    )

    return FootprintResult(
        transport_kg=transport_kg,
        energy_kg=energy_kg,
        diet_kg=diet_kg,
        total_kg=total_kg,
        record_date=record_date,
        grade=grade,
    )


def get_emission_factors() -> dict[str, Any]:
    """Return the emission factors reference dictionary.

    Returns:
        Serialisable dict of all emission factors used in calculations.
    """
    return {
        "transport_kg_per_km": EMISSION_FACTORS["transport_kg_per_km"],
        "energy_kg_per_kwh": EMISSION_FACTORS["energy_kg_per_kwh"],
        "diet_factors": {k.value: v for k, v in EMISSION_FACTORS["diet"].items()},
        "global_avg_daily_kg": EMISSION_FACTORS["global_avg_daily_kg"],
    }
