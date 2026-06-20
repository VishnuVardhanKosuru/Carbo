"""
Carbo Backend — In-memory footprint history store with Firestore-ready interface.

Provides a ``HistoryStore`` class backed by an in-memory ``deque``.  In a
production cloud deployment the class can be swapped for a Firestore-backed
implementation without touching any of the calling code — the public interface
is identical.

If the ``FIRESTORE_PROJECT`` environment variable is set and the
``google-cloud-firestore`` package is installed, the store will transparently
use Cloud Firestore for persistence.  Otherwise it falls back to the in-memory
deque (default for local development and tests).
"""

from __future__ import annotations

import logging
import os
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
# Optional Firestore client initialisation
# ---------------------------------------------------------------------------

_firestore_client = None
_FIRESTORE_COLLECTION = "footprint_records"


def _init_firestore():  # pragma: no cover
    """Attempt to initialise a Firestore client.

    Returns the Firestore client on success, or ``None`` if the package is not
    installed or the project environment variable is unset.

    Returns:
        Firestore ``Client`` instance or ``None``.
    """
    project = os.getenv("FIRESTORE_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project:
        return None
    try:
        from google.cloud import firestore  # type: ignore[import]

        client = firestore.Client(project=project)
        logger.info("Firestore client initialised.", extra={"project": project})
        return client
    except Exception as exc:  # noqa: BLE001 – best-effort, fall back silently
        logger.warning(
            "Firestore unavailable, falling back to in-memory store.",
            extra={"error": str(exc)},
        )
        return None


# ---------------------------------------------------------------------------
# HistoryStore — unified interface over in-memory or Firestore backend
# ---------------------------------------------------------------------------


class HistoryStore:
    """Thread-local, process-scoped footprint record store.

    Uses Cloud Firestore when ``FIRESTORE_PROJECT`` is configured; otherwise
    maintains records in an in-process ``deque`` (suitable for development and
    unit tests).

    All public methods mirror the previous module-level function signatures so
    that call sites require zero changes.
    """

    def __init__(self) -> None:
        """Initialise the store and attempt Firestore connection."""
        self._store: deque[FootprintRecord] = deque()
        self._db = _init_firestore()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _to_record(self, data: dict) -> FootprintRecord:
        """Deserialise a raw dict into a ``FootprintRecord``.

        Args:
            data: Raw dictionary from Firestore or the in-memory store.

        Returns:
            Validated ``FootprintRecord`` instance.
        """
        return FootprintRecord(**data)  # pragma: no cover

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def log_record(self, request: LogRecordRequest) -> FootprintRecord:
        """Persist a new footprint record (upsert by date).

        If a record with the same ``record_date`` already exists it is replaced
        so that only one record per day is kept.

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

        if self._db is not None:  # pragma: no cover
            try:  # pragma: no cover
                self._db.collection(_FIRESTORE_COLLECTION).document(  # pragma: no cover
                    request.record_date
                ).set(record.model_dump())
                logger.info(
                    "Footprint record saved to Firestore.",
                    extra={"date": request.record_date, "id": record.id},
                )
                return record
            except Exception as exc:  # noqa: BLE001  # pragma: no cover
                logger.warning(
                    "Firestore write failed, falling back to in-memory.",
                    extra={"error": str(exc)},
                )

        # In-memory fallback (upsert)
        self._store = deque(
            r for r in self._store if r.record_date != request.record_date
        )
        self._store.append(record)
        logger.info(
            "Footprint record saved to in-memory store.",
            extra={"date": request.record_date, "id": record.id},
        )
        return record

    def get_history(self) -> HistoryResponse:
        """Return all stored records sorted by date ascending.

        Returns:
            ``HistoryResponse`` with records, count, total, and average.
        """
        if self._db is not None:  # pragma: no cover
            try:  # pragma: no cover
                docs = (  # pragma: no cover
                    self._db.collection(_FIRESTORE_COLLECTION)
                    .order_by("record_date")
                    .stream()
                )
                records = [self._to_record(d.to_dict()) for d in docs]
                count = len(records)
                total_kg = round(sum(r.footprint_kg for r in records), 2)
                avg_daily_kg = round(total_kg / count, 2) if count else 0.0
                return HistoryResponse(
                    records=records,
                    count=count,
                    total_kg=total_kg,
                    avg_daily_kg=avg_daily_kg,
                )
            except Exception as exc:  # noqa: BLE001  # pragma: no cover
                logger.warning(
                    "Firestore read failed, falling back to in-memory.",
                    extra={"error": str(exc)},
                )

        records = sorted(self._store, key=lambda r: r.record_date)
        count = len(records)
        total_kg = round(sum(r.footprint_kg for r in records), 2)
        avg_daily_kg = round(total_kg / count, 2) if count else 0.0
        return HistoryResponse(
            records=records,
            count=count,
            total_kg=total_kg,
            avg_daily_kg=avg_daily_kg,
        )

    def clear_history(self) -> dict[str, Any]:
        """Clear all stored footprint records.

        Returns:
            Confirmation dictionary with the count of deleted records.
        """
        if self._db is not None:  # pragma: no cover
            try:  # pragma: no cover
                docs = self._db.collection(_FIRESTORE_COLLECTION).stream()  # pragma: no cover
                batch = self._db.batch()
                count = 0
                for doc in docs:
                    batch.delete(doc.reference)
                    count += 1
                batch.commit()
                logger.info(
                    "Footprint history cleared from Firestore.",
                    extra={"deleted_count": count},
                )
                return {"deleted": count, "message": "History cleared successfully."}
            except Exception as exc:  # noqa: BLE001  # pragma: no cover
                logger.warning(
                    "Firestore clear failed, falling back to in-memory.",
                    extra={"error": str(exc)},
                )

        count = len(self._store)
        self._store = deque()
        logger.info(
            "Footprint history cleared from in-memory store.",
            extra={"deleted_count": count},
        )
        return {"deleted": count, "message": "History cleared successfully."}

    def reset(self) -> None:
        """Reset the in-memory store (used by tests only).

        This does **not** affect Firestore data; it is intended solely for
        test isolation via the ``autouse`` fixture.
        """
        self._store = deque()


# ---------------------------------------------------------------------------
# Module-level singleton — preserves the original function-call interface
# ---------------------------------------------------------------------------

_history_store = HistoryStore()


def log_record(request: LogRecordRequest) -> FootprintRecord:
    """Persist a new footprint record via the module-level singleton store.

    Args:
        request: Validated ``LogRecordRequest`` with activity data.

    Returns:
        The newly created (or updated) ``FootprintRecord``.
    """
    return _history_store.log_record(request)


def get_history() -> HistoryResponse:
    """Return all stored records via the module-level singleton store.

    Returns:
        ``HistoryResponse`` with records, count, total, and average.
    """
    return _history_store.get_history()


def clear_history() -> dict[str, Any]:
    """Clear all stored footprint records via the module-level singleton store.

    Returns:
        Confirmation dictionary.
    """
    return _history_store.clear_history()
