import PropTypes from "prop-types";

export default function StatStrip({ history, goal, onGoalChange }) {
  const count = history.length;
  const total = history.reduce(
    (s, r) => s + (r.footprint_kg || r.total_kg || 0),
    0,
  );
  const avg = count ? (total / count).toFixed(2) : "—";

  const currentGoal = goal || 4.7;
  const avgNum = parseFloat(avg);

  // Calculate percentage relative to goal (e.g. if avg is 3 and goal is 4, it's -25%)
  const vsGoal =
    count && avgNum !== currentGoal
      ? (((avgNum - currentGoal) / currentGoal) * 100).toFixed(0)
      : null;

  return (
    <div className="stats-strip" id="statsStrip">
      <div className="stat-item">
        <span className="stat-number" id="statAvg">
          {count ? avg : "—"}
        </span>
        <span className="stat-label">Avg Daily kg CO₂</span>
      </div>
      <div className="stat-divider" aria-hidden="true" />

      <div className="stat-item">
        <span className="stat-number" id="statTotal">
          {count ? total.toFixed(1) : "—"}
        </span>
        <span className="stat-label">Total kg CO₂ Logged</span>
      </div>
      <div className="stat-divider" aria-hidden="true" />

      <div className="stat-item">
        <span className="stat-number" id="statDays">
          {count || "—"}
        </span>
        <span className="stat-label">Days Tracked</span>
      </div>
      <div className="stat-divider" aria-hidden="true" />

      <div className="stat-item">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            className="stat-number"
            style={{
              color:
                vsGoal !== null && vsGoal < 0
                  ? "hsl(141,52%,42%)"
                  : vsGoal !== null && vsGoal > 0
                    ? "#ef4444"
                    : undefined,
            }}
          >
            {vsGoal !== null
              ? vsGoal < 0
                ? `${vsGoal}%`
                : `+${vsGoal}%`
              : "—"}
          </span>
          {onGoalChange && (
            <input
              type="number"
              value={currentGoal}
              onChange={(e) => onGoalChange(parseFloat(e.target.value) || 0)}
              step="0.1"
              style={{
                width: "60px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
                borderRadius: "4px",
                padding: "2px 4px",
                fontSize: "0.8rem",
              }}
              aria-label="Set daily reduction goal in kg CO2"
            />
          )}
        </div>
        <span className="stat-label">vs. Daily Goal (kg)</span>
      </div>
    </div>
  );
}

StatStrip.propTypes = {
  history: PropTypes.arrayOf(
    PropTypes.shape({
      footprint_kg: PropTypes.number,
      total_kg: PropTypes.number,
    }),
  ).isRequired,
  goal: PropTypes.number,
  onGoalChange: PropTypes.func,
};
