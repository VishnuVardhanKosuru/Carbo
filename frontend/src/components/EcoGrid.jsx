const ECO_ACTIONS = [
  {
    icon: "🚲",
    title: "Cycle More",
    desc: "Replace short car trips with cycling. Save ~0.192 kg CO₂ per km.",
  },
  {
    icon: "🌱",
    title: "Plant-Based Meals",
    desc: "One plant-based meal per day saves ~52 kg CO₂ per year.",
  },
  {
    icon: "💡",
    title: "Switch to LED",
    desc: "LEDs use 75% less energy and last 25× longer than incandescent bulbs.",
  },
  {
    icon: "♻️",
    title: "Reduce & Reuse",
    desc: "Producing new goods accounts for ~45% of global carbon emissions.",
  },
];

export default function EcoGrid() {
  return (
    <div>
      <div className="panel-header">
        <span className="panel-icon">🌍</span>
        <div>
          <div className="panel-title">Eco Actions</div>
          <div className="panel-sub">Small changes, big impact</div>
        </div>
      </div>
      <div className="eco-grid">
        {ECO_ACTIONS.map((a) => (
          <div key={a.title} className="eco-card">
            <div className="eco-icon">{a.icon}</div>
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
