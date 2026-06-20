"""
Carbo Backend — Personalised eco-tips generation service.

Generates contextual tips based on the activity breakdown of a footprint
record. Mirrors ElectionApp's incident_service pattern (small, focused service).
"""

from __future__ import annotations

import logging

from app.models.schemas import DietType, TipsResponse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Thresholds (tunable via config in production)
# ---------------------------------------------------------------------------
_TRANSPORT_THRESHOLD_KM: float = 10.0
_ENERGY_THRESHOLD_KWH: float = 12.0

_TRANSPORT_TIPS = [
    "Consider car-pooling or using public transport for trips over 10 km — saves ~1.9 kg CO₂ per 10 km.",
    "Cycling or walking for short trips (≤ 5 km) eliminates transport emissions entirely.",
    "If you must drive, accelerating gently and maintaining steady speed can reduce fuel use by 15–20%.",
]

_ENERGY_TIPS = [
    "Turn off lights and unplug devices on standby — phantom loads can account for 10% of your bill.",
    "Switching to LED bulbs uses 75% less energy than incandescent alternatives.",
    "A smart thermostat can cut heating/cooling costs (and emissions) by up to 12% annually.",
]

_DIET_TIPS = {
    DietType.meatlover: "Replacing one meat-heavy meal per week with a plant-based alternative saves ~52 kg CO₂ per year.",
    DietType.average: "Reducing red meat to 2–3 servings per week can cut diet emissions by ~15%.",
    DietType.vegetarian: "Great choice! A plant-based diet is already one of the most impactful personal climate actions.",
}

_GENERAL_POSITIVE = "Excellent! Your activities today are well below the global average of 4.7 kg CO₂. Keep it up! 🌱"


def generate_tips(
    transport_km: float,
    energy_kwh: float,
    diet: DietType,
) -> TipsResponse:
    """Generate personalised eco-tips based on today's activity data.

    Args:
        transport_km: Kilometres of motorised transport today.
        energy_kwh: kWh of home electricity consumed today.
        diet: Diet type for the day.

    Returns:
        ``TipsResponse`` with a list of actionable tips.
    """
    all_tips: list[str] = []
    transport_tip: str | None = None
    energy_tip: str | None = None
    diet_tip: str | None = None

    if transport_km > _TRANSPORT_THRESHOLD_KM:
        transport_tip = _TRANSPORT_TIPS[0]
        all_tips.append(transport_tip)

    if energy_kwh > _ENERGY_THRESHOLD_KWH:
        energy_tip = _ENERGY_TIPS[0]
        all_tips.append(energy_tip)

    dt = _DIET_TIPS.get(diet)
    if diet == DietType.meatlover:
        diet_tip = dt
        all_tips.append(diet_tip)  # type: ignore[arg-type]
    elif diet == DietType.average:
        diet_tip = dt

    if not all_tips:
        all_tips.append(_GENERAL_POSITIVE)

    logger.debug(
        "Tips generated.",
        extra={"tip_count": len(all_tips), "diet": diet, "transport_km": transport_km},
    )

    return TipsResponse(
        tips=all_tips,
        transport_tip=transport_tip,
        energy_tip=energy_tip,
        diet_tip=diet_tip,
    )
