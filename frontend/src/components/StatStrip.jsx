export default function StatStrip({ history }) {
  const count = history.length;
  const total = history.reduce((s, r) => s + (r.footprint_kg || r.total_kg || 0), 0);
  const avg   = count ? (total / count).toFixed(2) : "—";
  const GLOBAL = 4.7;
  const vs = count ? ((parseFloat(avg) / GLOBAL) * 100 - 100).toFixed(0) : null;

  return (
    <div className="stats-strip" id="statsStrip">
      <div className="stat-item">
        <span className="stat-number" id="statAvg">{count ? avg : "—"}</span>
        <span className="stat-label">Avg Daily kg CO₂</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-number" id="statTotal">{count ? total.toFixed(1) : "—"}</span>
        <span className="stat-label">Total kg CO₂ Logged</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-number" id="statDays">{count || "—"}</span>
        <span className="stat-label">Days Tracked</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-number" style={{ color: vs !== null && vs < 0 ? "hsl(141,52%,42%)" : vs !== null ? "#ef4444" : undefined }}>
          {vs !== null ? (vs < 0 ? `${vs}%` : `+${vs}%`) : "—"}
        </span>
        <span className="stat-label">vs. Global Avg (4.7 kg)</span>
      </div>
    </div>
  );
}
