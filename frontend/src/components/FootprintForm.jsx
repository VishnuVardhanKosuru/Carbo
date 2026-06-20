import { useState, useMemo } from "react";
import { api } from "../utils/api";

const FACTORS = {
  transport_kg_per_km: 0.192,
  energy_kg_per_kwh: 0.233,
  diet: { vegetarian: 2.5, average: 3.8, meatlover: 5.0 },
};

function liveCalc(transport, energy, diet) {
  const t = parseFloat(transport) || 0;
  const e = parseFloat(energy)    || 0;
  const d = FACTORS.diet[diet] || 3.8;
  return (t * FACTORS.transport_kg_per_km + e * FACTORS.energy_kg_per_kwh + d).toFixed(2);
}

export default function FootprintForm({ onResult, onTips, apiAvailable }) {
  const [transport, setTransport] = useState("");
  const [energy,    setEnergy]    = useState("");
  const [diet,      setDiet]      = useState("average");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);

  const preview = useMemo(() => liveCalc(transport, energy, diet), [transport, energy, diet]);

  const today = () => new Date().toISOString().split("T")[0];

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      transport_km: parseFloat(transport) || 0,
      energy_kwh:   parseFloat(energy)    || 0,
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
        // Also log to backend
        await api.logRecord({
          ...payload,
          footprint_kg: calcResult.total_kg,
        });
      } else {
        // Local fallback calculation
        calcResult = {
          transport_kg: parseFloat((payload.transport_km * FACTORS.transport_kg_per_km).toFixed(4)),
          energy_kg:    parseFloat((payload.energy_kwh   * FACTORS.energy_kg_per_kwh).toFixed(4)),
          diet_kg:      FACTORS.diet[payload.diet],
          total_kg:     parseFloat(preview),
          record_date:  today(),
          grade:        parseFloat(preview) / 4.7 <= 0.75 ? "B" : parseFloat(preview) / 4.7 <= 1 ? "C" : "D",
        };
        tips = { tips: ["Great effort tracking your footprint! Keep logging daily for insights."] };
      }

      setResult(calcResult);
      onResult?.({ ...calcResult, footprint_kg: calcResult.total_kg, record_date: today(), ...payload });
      onTips?.(tips);
    } catch (err) {
      console.error("Calculation error:", err);
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = result
    ? ["A","B"].includes(result.grade) ? "#22c55e"
    : result.grade === "C" ? "#f59e0b" : "#ef4444"
    : "inherit";

  return (
    <form id="activityForm" onSubmit={handleSubmit}>
      {!apiAvailable && (
        <div className="api-warning">
          <div className="api-warning-dot" />
          Running in offline mode — calculations done locally
        </div>
      )}

      {/* Live score */}
      <div className="score-preview">
        <span className="score-label">⚡ Live estimate</span>
        <span className="score-value">{preview}</span>
        <span className="score-unit">kg CO₂</span>
      </div>

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

      <button type="submit" id="logBtn" className="btn-primary" disabled={loading}>
        {loading ? "⏳ Calculating…" : "🌿 Calculate & Log"}
      </button>

      {result && (
        <div className="result-card" id="footprintResult">
          <div style={{ display: "flex", alignItems: "baseline", gap: ".4rem", marginBottom: ".4rem" }}>
            <span className="result-grade" style={{ color: gradeColor }}>
              {result.grade}
            </span>
            <span className="result-total">{result.total_kg} kg CO₂ today</span>
          </div>
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
