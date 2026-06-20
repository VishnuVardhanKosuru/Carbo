"""
Carbo Backend — In-memory footprint history store.

Provides a simple in-memory list backed store for footprint records.
In a production cloud deployment this would be replaced by Firestore,
exactly as ElectionApp's incident_service.py uses Firestore with a
local in-memory fallback.
"""

from __future__ import annotations

import logging
import uuid
from collections import deque
from typing import Any

from app.models.schemas import (
    FootprintRecord,
    HistoryResponse,
    LogRecordRequest,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory store (deque with no size limit for this demo)
# ---------------------------------------------------------------------------

_store: deque[FootprintRecord] = deque()


def log_record(request: LogRecordRequest) -> FootprintRecord:
    """Persist a new footprint record to the in-memory store.

    If a record with the same date already exists it is replaced (upsert
    semantics), so only one record per day is kept.

    Args:
        request: Validated ``LogRecordRequest`` with activity data.

    Returns:
        The newly created (or updated) ``FootprintRecord``.
    """
    record = FootprintRecord(
        id=str(uuid.uuid4()),
        record_date=request.record_date,
        transport_km=request.transport_km,
        energy_kwh=request.energy_kwh,
        diet=request.diet,
        footprint_kg=request.footprint_kg,
    )

    # Remove any existing record for the same date (upsert)
    global _store
    _store = deque(r for r in _store if r.record_date != request.record_date)
    _store.append(record)

    logger.info(
        "Footprint record saved.", extra={"date": request.record_date, "id": record.id}
    )
    return record


def get_history() -> HistoryResponse:
    """Return all stored records sorted by date ascending.

    Returns:
        ``HistoryResponse`` with records, count, total, and average.
    """
    records = sorted(_store, key=lambda r: r.record_date)
    count = len(records)
    total_kg = round(sum(r.footprint_kg for r in records), 2)
    avg_daily_kg = round(total_kg / count, 2) if count else 0.0

    return HistoryResponse(
        records=records,
        count=count,
        total_kg=total_kg,
        avg_daily_kg=avg_daily_kg,
    )


def clear_history() -> dict[str, Any]:
    """Clear all stored footprint records.

    Returns:
        Confirmation dictionary.
    """
    global _store
    count = len(_store)
    _store = deque()
    logger.info("Footprint history cleared.", extra={"deleted_count": count})
    return {"deleted": count, "message": "History cleared successfully."}
