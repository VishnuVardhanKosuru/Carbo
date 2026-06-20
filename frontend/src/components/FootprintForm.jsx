import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Emission factors (mirrors backend constants for offline fallback)
// ---------------------------------------------------------------------------

const FACTORS = {
  transport_kg_per_km: 0.192,
  energy_kg_per_kwh: 0.233,
  diet: { vegetarian: 2.5, average: 3.8, meatlover: 5.0 },
  global_avg_daily_kg: 4.7,
};

/**
 * Compute a live carbon estimate from raw form values.
 *
 * @param {string} transport - Transport km input value.
 * @param {string} energy - Energy kWh input value.
 * @param {string} diet - Diet type key.
 * @returns {string} Estimated kg CO₂ to 2 decimal places.
 */
function liveCalc(transport, energy, diet) {
  const t = parseFloat(transport) || 0;
  const e = parseFloat(energy) || 0;
  const d = FACTORS.diet[diet] || FACTORS.diet.average;
  return (
    t * FACTORS.transport_kg_per_km +
    e * FACTORS.energy_kg_per_kwh +
    d
  ).toFixed(2);
}

/**
 * Assign an A–E letter grade based on ratio to global average.
 * Mirrors the backend ``_compute_grade`` logic exactly.
 *
 * @param {number} totalKg - Total footprint in kg CO₂.
 * @returns {string} Letter grade A–E.
 */
function computeGrade(totalKg) {
  const ratio = totalKg / FACTORS.global_avg_daily_kg;
  if (ratio <= 0.5) return "A";
  if (ratio <= 0.75) return "B";
  if (ratio <= 1.0) return "C";
  if (ratio <= 1.5) return "D";
  return "E";
}

/** @param {string} grade */
function gradeColor(grade) {
  if (["A", "B"].includes(grade)) return "#22c55e";
  if (grade === "C") return "#f59e0b";
  return "#ef4444";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FootprintForm — daily activity logger and calculator.
 *
 * @param {Object}   props
 * @param {Function} [props.onResult]    - Called with the full result record.
 * @param {Function} [props.onTips]      - Called with the tips response.
 * @param {boolean}  props.apiAvailable  - Whether the FastAPI backend is online.
 */
export default function FootprintForm({ onResult, onTips, apiAvailable }) {
  const [transport, setTransport] = useState("");
  const [energy, setEnergy] = useState("");
  const [diet, setDiet] = useState("average");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const preview = useMemo(
    () => liveCalc(transport, energy, diet),
    [transport, energy, diet],
  );

  const today = () => new Date().toISOString().split("T")[0];

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      transport_km: parseFloat(transport) || 0,
      energy_kwh: parseFloat(energy) || 0,
      diet,
      record_date: today(),
    };

    try {
      let calcResult, tips;

      if (apiAvailable) {
        [calcResult, tips] = await Promise.all([
          api.calculate(payload),
          api.getTips(payload),
        ]);
        // Persist to backend store (best-effort — don't block on failure)
        await api.logRecord({
          ...payload,
          footprint_kg: calcResult.total_kg,
        }).catch(() => {
          // Log record failure is non-fatal; history is maintained locally
        });
      } else {
        // Offline local fallback calculation
        const totalKg = parseFloat(preview);
        calcResult = {
          transport_kg: parseFloat(
            (payload.transport_km * FACTORS.transport_kg_per_km).toFixed(4),
          ),
          energy_kg: parseFloat(
            (payload.energy_kwh * FACTORS.energy_kg_per_kwh).toFixed(4),
          ),
          diet_kg: FACTORS.diet[payload.diet],
          total_kg: totalKg,
          record_date: today(),
          grade: computeGrade(totalKg),
          equivalence: null,
        };
        tips = {
          tips: [
            "Great effort tracking your footprint! Keep logging daily for insights.",
          ],
        };
      }

      setResult(calcResult);
      onResult?.({
        ...calcResult,
        footprint_kg: calcResult.total_kg,
        record_date: today(),
        ...payload,
      });
      onTips?.(tips);
    } catch (err) {
      const message =
        err?.message || "Calculation failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const color = result ? gradeColor(result.grade) : "inherit";

  return (
    <form id="activityForm" onSubmit={handleSubmit}>
      {/* Offline mode warning */}
      {!apiAvailable && (
        <div className="api-warning">
          <div className="api-warning-dot" />
          Running in offline mode — calculations done locally
        </div>
      )}

      {/* Submission error banner */}
      {error && (
        <div className="form-error-banner" role="alert">
          <span className="form-error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Live score preview */}
      <div className="score-preview">
        <span className="score-label">⚡ Live estimate</span>
        <span className="score-value">{preview}</span>
        <span className="score-unit">kg CO₂</span>
      </div>

      {/* Transport field */}
      <div className="field-group">
        <label className="field-label" htmlFor="transport">
          <span className="field-icon">🚗</span> Transport
          <span className="field-unit">km / day</span>
        </label>
        <input
          id="transport"
          type="number"
          min="0"
          max="10000"
          step="0.1"
          className="field-input"
          placeholder="e.g. 15"
          value={transport}
          onChange={(e) => setTransport(e.target.value)}
        />
      </div>

      {/* Energy field */}
      <div className="field-group">
        <label className="field-label" htmlFor="energy">
          <span className="field-icon">⚡</span> Energy
          <span className="field-unit">kWh / day</span>
        </label>
        <input
          id="energy"
          type="number"
          min="0"
          max="1000"
          step="0.1"
          className="field-input"
          placeholder="e.g. 8"
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
        />
      </div>

      {/* Diet field */}
      <div className="field-group">
        <label className="field-label" htmlFor="diet">
          <span className="field-icon">🥗</span> Diet
        </label>
        <div className="select-wrap">
          <select
            id="diet"
            className="field-input"
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
          >
            <option value="vegetarian">🥦 Vegetarian</option>
            <option value="average">🍽️ Average</option>
            <option value="meatlover">🥩 Meat-heavy</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        id="logBtn"
        className="btn-primary"
        disabled={loading}
      >
        {loading ? "⏳ Calculating…" : "🌿 Calculate & Log"}
      </button>

      {/* Result card */}
      {result && (
        <div className="result-card" id="footprintResult" aria-live="polite">
          <div className="result-header">
            <span className="result-grade" style={{ color }}>
              {result.grade}
            </span>
            <span className="result-total">{result.total_kg} kg CO₂ today</span>
          </div>

          {result.equivalence && (
            <p className="result-equivalence">{result.equivalence}</p>
          )}

          <div className="result-breakdown">
            <div className="breakdown-item">
              <div className="breakdown-icon">🚗</div>
              <div className="breakdown-val">{result.transport_kg} kg</div>
              <div className="breakdown-label">Transport</div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-icon">⚡</div>
              <div className="breakdown-val">{result.energy_kg} kg</div>
              <div className="breakdown-label">Energy</div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-icon">🥗</div>
              <div className="breakdown-val">{result.diet_kg} kg</div>
              <div className="breakdown-label">Diet</div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

FootprintForm.propTypes = {
  onResult: PropTypes.func,
  onTips: PropTypes.func,
  apiAvailable: PropTypes.bool.isRequired,
};
