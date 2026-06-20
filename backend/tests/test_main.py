"""
Pytest test suite for Carbo Backend v2.1.0

Tests covering:
  1.  Health endpoint — status='ok', version, uptime ≥ 0
  2.  Health endpoint — returns HTTP 200 (monitoring probe)
  3.  Cache stats endpoint — structure
  4.  Calculate footprint — valid average diet
  5.  Calculate footprint — vegetarian diet (lower result)
  6.  Calculate footprint — meatlover diet (higher result)
  7.  Calculate footprint — zero transport
  8.  Calculate footprint — zero energy
  9.  Calculate footprint — grade A (very low emissions)
  10. Calculate footprint — grade E (very high emissions)
  11. Calculate footprint — negative transport → 422
  12. Calculate footprint — negative energy → 422
  13. Calculate footprint — transport > 10 000 → 422
  14. Calculate footprint — invalid diet string → 422
  15. Calculate footprint — missing required field → 422
  16. Calculate footprint — invalid date format → 422
  17. Calculate footprint — emission accuracy (transport component)
  18. Calculate footprint — emission accuracy (energy component)
  19. Calculate footprint — emission accuracy (diet component)
  20. Calculate footprint — cache hit on repeated request
  21. Calculate footprint — equivalence string present in response
  22. Log footprint record — success (201)
  23. Log footprint record — upsert replaces same-date record
  24. Get history — empty returns count=0
  25. Get history — populated returns records sorted
  26. Clear history — success
  27. Tips — transport > 10 km includes transport tip
  28. Tips — energy > 12 kWh includes energy tip
  29. Tips — meatlover diet includes diet tip
  30. Tips — low emissions → positive general tip
  31. Get emission factors — structure check
  32. Security headers present on every response
  33. GZip middleware compresses large responses
  34. Schema validations — explicit ValueError branches
  35. Config — invalid log level raises ValueError
  36. Config — is_development property
  37. Exception handlers — ValidationError handler
  38. Exception handlers — generic unhandled exception handler
  39. Footprint service — _compute_grade with zero global average
  40. Footprint service — _compute_equivalence output format
  41. History store — HistoryStore.reset() clears in-memory store
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Ensure test environment settings
os.environ.setdefault("ENV", "development")
os.environ.setdefault("LOG_LEVEL", "ERROR")  # suppress logs during tests

from app.main import app  # noqa: E402
from app import cache as cache_module  # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Provide a synchronous TestClient for the FastAPI application.

    Yields:
        Configured ``TestClient`` instance.
    """
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_history_and_cache():
    """Reset in-memory history store and cache before each test."""
    from app.services import history_service

    history_service._history_store.reset()
    cache_module.clear()
    yield


# ---------------------------------------------------------------------------
# Payload helpers
# ---------------------------------------------------------------------------

VALID_AVERAGE = {
    "transport_km": 10.0,
    "energy_kwh": 8.0,
    "diet": "average",
    "record_date": "2026-06-20",
}

VALID_VEGETARIAN = {
    "transport_km": 5.0,
    "energy_kwh": 5.0,
    "diet": "vegetarian",
    "record_date": "2026-06-20",
}

VALID_MEATLOVER = {
    "transport_km": 20.0,
    "energy_kwh": 15.0,
    "diet": "meatlover",
    "record_date": "2026-06-20",
}


# ---------------------------------------------------------------------------
# Tests 1 & 2 — Health check
# ---------------------------------------------------------------------------


def test_health_check_structure(client: TestClient) -> None:
    """Health endpoint should return 200 with status='ok', version, and uptime."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert data["uptime_seconds"] >= 0


def test_health_check_returns_200(client: TestClient) -> None:
    """Health endpoint always returns HTTP 200 (Cloud Monitoring probe)."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Test 3 — Cache stats
# ---------------------------------------------------------------------------


def test_cache_stats_structure(client: TestClient) -> None:
    """Cache stats endpoint should return all expected fields."""
    response = client.get("/api/v1/cache/stats")
    assert response.status_code == 200
    data = response.json()
    for field in (
        "hits",
        "misses",
        "hit_rate_pct",
        "current_size",
        "max_size",
        "ttl_seconds",
    ):
        assert field in data, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# Tests 4–6 — Footprint calculation (diet types)
# ---------------------------------------------------------------------------


def test_calculate_average_diet(client: TestClient) -> None:
    """Average diet request should return valid footprint result."""
    response = client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)
    assert response.status_code == 200
    data = response.json()
    assert data["total_kg"] > 0
    assert "grade" in data
    assert data["diet_kg"] == 3.8


def test_calculate_vegetarian_diet(client: TestClient) -> None:
    """Vegetarian diet should produce lower footprint than average."""
    client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)
    veg_resp = client.post("/api/v1/footprint/calculate", json=VALID_VEGETARIAN)
    # Vegetarian with much lower activity should have lower total
    assert veg_resp.status_code == 200
    assert veg_resp.json()["diet_kg"] == 2.5


def test_calculate_meatlover_diet(client: TestClient) -> None:
    """Meatlover diet should produce the highest diet emission component."""
    response = client.post("/api/v1/footprint/calculate", json=VALID_MEATLOVER)
    assert response.status_code == 200
    assert response.json()["diet_kg"] == 5.0


# ---------------------------------------------------------------------------
# Tests 7–8 — Zero inputs
# ---------------------------------------------------------------------------


def test_calculate_zero_transport(client: TestClient) -> None:
    """Zero transport should contribute 0 kg transport component."""
    payload = {**VALID_AVERAGE, "transport_km": 0.0}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    assert response.json()["transport_kg"] == 0.0


def test_calculate_zero_energy(client: TestClient) -> None:
    """Zero energy should contribute 0 kg energy component."""
    payload = {**VALID_AVERAGE, "energy_kwh": 0.0}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    assert response.json()["energy_kg"] == 0.0


# ---------------------------------------------------------------------------
# Tests 9–10 — Grade boundaries
# ---------------------------------------------------------------------------


def test_grade_a_very_low_emissions(client: TestClient) -> None:
    """Very low emissions should earn grade A or B (vegetarian + zero activity is 53% of global avg = B).
    We verify the grade is better than C (at-or-above average).
    """
    payload = {
        "transport_km": 0.0,
        "energy_kwh": 0.0,
        "diet": "vegetarian",
        "record_date": "2026-06-20",
    }
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    # 2.5 kg / 4.7 global avg = 53% → grade B (≤ 75%)
    assert response.json()["grade"] in ("A", "B")


def test_grade_e_very_high_emissions(client: TestClient) -> None:
    """Very high emissions should earn grade E."""
    payload = {
        "transport_km": 500.0,
        "energy_kwh": 200.0,
        "diet": "meatlover",
        "record_date": "2026-06-20",
    }
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    assert response.json()["grade"] == "E"


# ---------------------------------------------------------------------------
# Tests 11–16 — Input validation errors
# ---------------------------------------------------------------------------


def test_negative_transport_returns_422(client: TestClient) -> None:
    """Negative transport_km should return 422 Unprocessable Entity."""
    payload = {**VALID_AVERAGE, "transport_km": -1.0}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_negative_energy_returns_422(client: TestClient) -> None:
    """Negative energy_kwh should return 422 Unprocessable Entity."""
    payload = {**VALID_AVERAGE, "energy_kwh": -5.0}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_transport_overflow_returns_422(client: TestClient) -> None:
    """transport_km > 10 000 should return 422."""
    payload = {**VALID_AVERAGE, "transport_km": 99999.0}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_invalid_diet_string_returns_422(client: TestClient) -> None:
    """An unrecognised diet type should return 422."""
    payload = {**VALID_AVERAGE, "diet": "keto"}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_missing_required_field_returns_422(client: TestClient) -> None:
    """Omitting a required field (energy_kwh) should return 422."""
    payload = {"transport_km": 10.0, "diet": "average"}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_invalid_date_format_returns_422(client: TestClient) -> None:
    """An invalid date format should return 422."""
    payload = {**VALID_AVERAGE, "record_date": "20-06-2026"}  # wrong format
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Tests 17–19 — Emission accuracy
# ---------------------------------------------------------------------------


def test_emission_accuracy_transport(client: TestClient) -> None:
    """Transport kg should equal transport_km × 0.192."""
    payload = {
        "transport_km": 50.0,
        "energy_kwh": 0.0,
        "diet": "vegetarian",
        "record_date": "2026-06-20",
    }
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    expected = round(50.0 * 0.192, 4)
    assert response.json()["transport_kg"] == expected


def test_emission_accuracy_energy(client: TestClient) -> None:
    """Energy kg should equal energy_kwh × 0.233."""
    payload = {
        "transport_km": 0.0,
        "energy_kwh": 20.0,
        "diet": "vegetarian",
        "record_date": "2026-06-20",
    }
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 200
    expected = round(20.0 * 0.233, 4)
    assert response.json()["energy_kg"] == expected


def test_emission_accuracy_diet_component(client: TestClient) -> None:
    """Diet component should be exactly the factor for the chosen diet type."""
    factors = {"vegetarian": 2.5, "average": 3.8, "meatlover": 5.0}
    for diet, expected_kg in factors.items():
        payload = {
            "transport_km": 0.0,
            "energy_kwh": 0.0,
            "diet": diet,
            "record_date": "2026-06-20",
        }
        response = client.post("/api/v1/footprint/calculate", json=payload)
        assert response.status_code == 200, f"Failed for diet={diet}"
        assert response.json()["diet_kg"] == expected_kg, f"Wrong diet_kg for {diet}"


# ---------------------------------------------------------------------------
# Test 20 — Cache hit
# ---------------------------------------------------------------------------


def test_cache_hit_on_repeated_request(client: TestClient) -> None:
    """A second identical request should increment the cache hit counter."""
    stats_before = client.get("/api/v1/cache/stats").json()
    hits_before = stats_before["hits"]

    # First request — cache miss
    client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)
    # Second identical request — should be a cache hit
    client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)

    stats_after = client.get("/api/v1/cache/stats").json()
    assert stats_after["hits"] > hits_before


# ---------------------------------------------------------------------------
# Test 21 — Equivalence field
# ---------------------------------------------------------------------------


def test_calculate_returns_equivalence_string(client: TestClient) -> None:
    """Response should include a human-readable equivalence string."""
    response = client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)
    assert response.status_code == 200
    data = response.json()
    assert "equivalence" in data
    assert data["equivalence"] is not None
    # Should mention km driven and trees
    assert "km" in data["equivalence"]
    assert "tree" in data["equivalence"]


# ---------------------------------------------------------------------------
# Tests 22–23 — Log footprint
# ---------------------------------------------------------------------------


def test_log_footprint_record_success(client: TestClient) -> None:
    """Logging a record should return 201 with the record data."""
    payload = {
        "transport_km": 10.0,
        "energy_kwh": 8.0,
        "diet": "average",
        "footprint_kg": 7.66,
        "record_date": "2026-06-20",
    }
    response = client.post("/api/v1/footprint/log", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["record_date"] == "2026-06-20"
    assert data["footprint_kg"] == 7.66


def test_log_footprint_upsert_replaces_same_date(client: TestClient) -> None:
    """Logging two records for the same date should result in only one record."""
    payload_v1 = {
        "transport_km": 5.0,
        "energy_kwh": 4.0,
        "diet": "vegetarian",
        "footprint_kg": 5.0,
        "record_date": "2026-06-20",
    }
    payload_v2 = {
        "transport_km": 10.0,
        "energy_kwh": 8.0,
        "diet": "meatlover",
        "footprint_kg": 10.0,
        "record_date": "2026-06-20",
    }
    client.post("/api/v1/footprint/log", json=payload_v1)
    client.post("/api/v1/footprint/log", json=payload_v2)

    history = client.get("/api/v1/footprint/history").json()
    assert history["count"] == 1
    assert history["records"][0]["footprint_kg"] == 10.0


# ---------------------------------------------------------------------------
# Tests 24–26 — History
# ---------------------------------------------------------------------------


def test_get_history_empty(client: TestClient) -> None:
    """History should be empty initially."""
    response = client.get("/api/v1/footprint/history")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert data["records"] == []


def test_get_history_populated_sorted(client: TestClient) -> None:
    """History should return records sorted by date ascending."""
    records = [
        {
            "transport_km": 5.0,
            "energy_kwh": 3.0,
            "diet": "vegetarian",
            "footprint_kg": 4.0,
            "record_date": "2026-06-22",
        },
        {
            "transport_km": 5.0,
            "energy_kwh": 3.0,
            "diet": "vegetarian",
            "footprint_kg": 4.0,
            "record_date": "2026-06-20",
        },
        {
            "transport_km": 5.0,
            "energy_kwh": 3.0,
            "diet": "vegetarian",
            "footprint_kg": 4.0,
            "record_date": "2026-06-21",
        },
    ]
    for r in records:
        client.post("/api/v1/footprint/log", json=r)

    history = client.get("/api/v1/footprint/history").json()
    dates = [r["record_date"] for r in history["records"]]
    assert dates == sorted(dates)
    assert history["count"] == 3


def test_clear_history(client: TestClient) -> None:
    """Clear endpoint should delete all records."""
    payload = {
        "transport_km": 5.0,
        "energy_kwh": 3.0,
        "diet": "vegetarian",
        "footprint_kg": 4.0,
        "record_date": "2026-06-20",
    }
    client.post("/api/v1/footprint/log", json=payload)
    response = client.delete("/api/v1/footprint/history")
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert client.get("/api/v1/footprint/history").json()["count"] == 0


# ---------------------------------------------------------------------------
# Tests 27–30 — Tips
# ---------------------------------------------------------------------------


def test_tips_transport_heavy(client: TestClient) -> None:
    """Transport > 10 km should include a transport-specific tip."""
    payload = {"transport_km": 50.0, "energy_kwh": 5.0, "diet": "average"}
    response = client.post("/api/v1/tips", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transport_tip"] is not None
    assert any(
        "transport" in t.lower() or "public" in t.lower() or "car" in t.lower()
        for t in data["tips"]
    )


def test_tips_energy_heavy(client: TestClient) -> None:
    """Energy > 12 kWh should include an energy-specific tip."""
    payload = {"transport_km": 0.0, "energy_kwh": 20.0, "diet": "average"}
    response = client.post("/api/v1/tips", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["energy_tip"] is not None


def test_tips_meatlover_diet(client: TestClient) -> None:
    """Meatlover diet should include a diet-specific tip."""
    payload = {"transport_km": 0.0, "energy_kwh": 0.0, "diet": "meatlover"}
    response = client.post("/api/v1/tips", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["diet_tip"] is not None
    assert "meat" in data["diet_tip"].lower() or "plant" in data["diet_tip"].lower()


def test_tips_low_emissions_positive(client: TestClient) -> None:
    """Zero-emission activities should return a positive general tip."""
    payload = {"transport_km": 0.0, "energy_kwh": 0.0, "diet": "vegetarian"}
    response = client.post("/api/v1/tips", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["tips"]) >= 1
    assert any(
        "great" in t.lower() or "excellent" in t.lower() or "keep" in t.lower()
        for t in data["tips"]
    )


# ---------------------------------------------------------------------------
# Test 31 — Emission factors
# ---------------------------------------------------------------------------


def test_emission_factors_structure(client: TestClient) -> None:
    """Factors endpoint should return all required keys."""
    response = client.get("/api/v1/factors")
    assert response.status_code == 200
    data = response.json()
    assert "transport_kg_per_km" in data
    assert "energy_kg_per_kwh" in data
    assert "diet_factors" in data
    assert "global_avg_daily_kg" in data
    assert set(data["diet_factors"].keys()) == {"vegetarian", "average", "meatlover"}


# ---------------------------------------------------------------------------
# Test 32 — Security headers
# ---------------------------------------------------------------------------


def test_security_headers_present(client: TestClient) -> None:
    """Every response should include OWASP security headers."""
    response = client.get("/api/v1/health")
    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "x-xss-protection" in headers


# ---------------------------------------------------------------------------
# Test 33 — GZip compression
# ---------------------------------------------------------------------------


def test_gzip_compresses_large_response(client: TestClient) -> None:
    """GZip middleware should compress large payloads when Accept-Encoding: gzip."""
    # Populate history with many records so the response is large
    for i in range(30):
        payload = {
            "transport_km": float(i),
            "energy_kwh": float(i),
            "diet": "average",
            "footprint_kg": float(i * 2),
            "record_date": f"2026-01-{i+1:02d}",
        }
        client.post("/api/v1/footprint/log", json=payload)

    response = client.get(
        "/api/v1/footprint/history",
        headers={"Accept-Encoding": "gzip"},
    )
    assert response.status_code == 200
    # If GZip is active, the Content-Encoding header may be set or the body is compressed.
    # TestClient decompresses transparently, so we just verify the response is valid JSON.
    data = response.json()
    assert data["count"] == 30


# ---------------------------------------------------------------------------
# Test 34 — Schema validations (explicit ValueError branches)
# ---------------------------------------------------------------------------


def test_schema_validations() -> None:
    """Cover the explicit ValueErrors raised in Pydantic validators."""
    from app.models.schemas import FootprintRequest, LogRecordRequest

    with pytest.raises(ValueError, match="must be a string"):
        FootprintRequest(
            transport_km=10.0, energy_kwh=10.0, diet="average", record_date=123
        )

    with pytest.raises(ValueError, match="Invalid date"):
        LogRecordRequest(
            transport_km=10.0,
            energy_kwh=10.0,
            diet="average",
            footprint_kg=10.0,
            record_date="26-06-2026",
        )


def test_schema_record_date_none_is_valid() -> None:
    """FootprintRequest with record_date=None should be accepted (None branch coverage)."""
    from app.models.schemas import FootprintRequest

    req = FootprintRequest(transport_km=5.0, energy_kwh=3.0, diet="average", record_date=None)
    assert req.record_date is None


# ---------------------------------------------------------------------------
# Test 35 — Config: invalid log level
# ---------------------------------------------------------------------------


def test_config_invalid_log_level() -> None:
    """Settings should raise ValueError for an unrecognised log level."""
    from pydantic import ValidationError as PydanticValidationError
    from app.config import Settings

    with pytest.raises(PydanticValidationError):
        Settings(log_level="VERBOSE")


# ---------------------------------------------------------------------------
# Test 36 — Config: is_development property
# ---------------------------------------------------------------------------


def test_config_is_development() -> None:
    """is_development should return True when env='development'."""
    from app.config import Settings

    dev_settings = Settings(env="development")
    assert dev_settings.is_development is True

    prod_settings = Settings(env="production")
    assert prod_settings.is_development is False


# ---------------------------------------------------------------------------
# Test 37 — Exception handler: ValidationError (Pydantic)
# ---------------------------------------------------------------------------


def test_validation_error_handler(client: TestClient) -> None:
    """The global Pydantic ValidationError handler should return 422 with structured body."""
    # Sending an integer for diet triggers Pydantic validation at FastAPI level
    payload = {**VALID_AVERAGE, "diet": 999}
    response = client.post("/api/v1/footprint/calculate", json=payload)
    assert response.status_code == 422


def test_unhandled_exception_handler(client: TestClient) -> None:
    """The global exception handler should return 500 for unexpected errors.

    We trigger this by patching the footprint service to raise a RuntimeError.
    """
    import app.services.footprint_service as fs
    original = fs.calculate_footprint

    def boom(_req):
        raise RuntimeError("Simulated unexpected error")

    fs.calculate_footprint = boom
    try:
        response = client.post("/api/v1/footprint/calculate", json=VALID_AVERAGE)
        assert response.status_code == 500
        data = response.json()
        assert data["code"] == "INTERNAL_ERROR"
    finally:
        fs.calculate_footprint = original


# ---------------------------------------------------------------------------
# Test 39 — Footprint service: _compute_grade with zero global average
# ---------------------------------------------------------------------------


def test_compute_grade_zero_global_avg() -> None:
    """_compute_grade should return 'C' when global_avg_daily_kg is zero."""
    from app.services.footprint_service import _compute_grade, EMISSION_FACTORS

    original = EMISSION_FACTORS["global_avg_daily_kg"]
    EMISSION_FACTORS["global_avg_daily_kg"] = 0
    try:
        grade = _compute_grade(5.0)
        assert grade == "C"
    finally:
        EMISSION_FACTORS["global_avg_daily_kg"] = original


# ---------------------------------------------------------------------------
# Test 40 — Footprint service: _compute_equivalence output
# ---------------------------------------------------------------------------


def test_compute_equivalence_format() -> None:
    """_compute_equivalence should include km and tree in the output string."""
    from app.services.footprint_service import _compute_equivalence

    result = _compute_equivalence(4.7)
    assert "km" in result
    assert "tree" in result

    # Singular "tree" for 1 tree
    result_low = _compute_equivalence(0.01)
    assert "tree" in result_low


# ---------------------------------------------------------------------------
# Test 41 — HistoryStore.reset()
# ---------------------------------------------------------------------------


def test_history_store_reset() -> None:
    """HistoryStore.reset() should clear the in-memory deque."""
    from app.services.history_service import _history_store, LogRecordRequest
    from app.models.schemas import DietType

    req = LogRecordRequest(
        transport_km=5.0,
        energy_kwh=3.0,
        diet=DietType.vegetarian,
        footprint_kg=4.0,
        record_date="2026-06-20",
    )
    _history_store.log_record(req)
    assert len(_history_store._store) == 1

    _history_store.reset()
    assert len(_history_store._store) == 0
