import { useEffect, useRef, useState, useCallback } from "react";

import Navbar from "./components/Navbar.jsx";
import HeroGlobe from "./components/HeroGlobe.jsx";
import StatStrip from "./components/StatStrip.jsx";
import FootprintForm from "./components/FootprintForm.jsx";
import TrendChart from "./components/TrendChart.jsx";
import ThreeBarChart from "./components/ThreeBarChart.jsx";
import EcoGrid from "./components/EcoGrid.jsx";
import { useHistory } from "./hooks/useHistory.js";
import { api } from "./utils/api.js";

// ---- Background particles ----
function initParticles(canvas) {
  const ctx = canvas.getContext("2d");
  let particles;
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: Math.random() * 0.35 + 0.05,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dark = document.body.classList.contains("dark");
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = dark
        ? `rgba(74,222,128,${p.a})`
        : `rgba(34,197,94,${p.a * 0.6})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  draw();
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem("cf_theme");
    return s
      ? s === "dark"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  const [tips, setTips] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const canvasRef = useRef(null);
  const { history, addRecord, clearAll } = useHistory();

  // Theme
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("cf_theme", dark ? "dark" : "light");
  }, [dark]);

  // Particles
  useEffect(() => {
    if (canvasRef.current) initParticles(canvasRef.current);
  }, []);

  // Check API availability
  useEffect(() => {
    api
      .health()
      .then(() => setApiAvailable(true))
      .catch(() => setApiAvailable(false));
  }, []);

  const handleResult = useCallback(
    (record) => {
      addRecord({
        record_date: record.record_date,
        footprint_kg: record.footprint_kg || record.total_kg,
        transport_km: record.transport_km,
        energy_kwh: record.energy_kwh,
        diet: record.diet,
      });
    },
    [addRecord],
  );

  const handleTips = useCallback((t) => setTips(t), []);

  return (
    <>
      <canvas ref={canvasRef} id="bgCanvas" aria-hidden="true" />

      <Navbar
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        apiAvailable={apiAvailable}
      />

      {/* Hero */}
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-content">
          <p className="hero-eyebrow">🌍 Carbon Footprint Tracker</p>
          <h1 id="hero-heading" className="hero-title">
            Track Your <span className="gradient-text">Carbon Impact</span>{" "}
            Daily
          </h1>
          <p className="hero-subtitle">
            Understand, log, and reduce your personal carbon footprint with
            science-based emission factors and personalised eco-tips.
          </p>
          <button
            className="hero-cta"
            onClick={() =>
              document
                .getElementById("activityForm")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            🌿 Start Tracking
          </button>
        </div>
        <div className="hero-visual">
          <HeroGlobe />
        </div>
      </section>

      {/* Stats Strip */}
      <StatStrip history={history} />

      {/* Dashboard */}
      <main className="dashboard" id="dashboard">
        {/* Form panel */}
        <section className="panel panel-form" aria-label="Log Activity">
          <div className="panel-header">
            <span className="panel-icon">📋</span>
            <div>
              <div className="panel-title">Log Today's Activities</div>
              <div className="panel-sub">
                Enter your daily transport, energy & diet
              </div>
            </div>
          </div>
          <FootprintForm
            onResult={handleResult}
            onTips={handleTips}
            apiAvailable={apiAvailable}
          />

          {tips && tips.tips?.length > 0 && (
            <div className="tips-container" id="tips">
              <div className="tips-heading">💡 Personalised Tips</div>
              <ul className="tips-list">
                {tips.tips.map((t, i) => (
                  <li key={i} className="tips-item">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ marginTop: "1rem", textAlign: "right" }}>
              <button className="btn-ghost" onClick={clearAll}>
                🗑️ Clear History
              </button>
            </div>
          )}
        </section>

        {/* Chart panel */}
        <section
          className="panel panel-chart"
          aria-label="Footprint trend chart"
        >
          <div className="panel-header">
            <span className="panel-icon">📈</span>
            <div>
              <div className="panel-title">Footprint Trend</div>
              <div className="panel-sub">Daily CO₂ emissions over time</div>
            </div>
          </div>
          <TrendChart history={history} />
        </section>

        {/* 3D panel */}
        <section className="panel panel-3d" aria-label="3D bar chart">
          <div className="panel-header">
            <span className="panel-icon">📊</span>
            <div>
              <div className="panel-title">3D Visualisation</div>
              <div className="panel-sub">
                Last 10 entries — hover bars for details
              </div>
            </div>
          </div>
          <ThreeBarChart history={history} />
        </section>

        {/* Eco actions panel */}
        <section className="panel panel-eco" aria-label="Eco actions">
          <EcoGrid />
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">🌿 Carbo</div>
        <p className="footer-copy">
          Powered by FastAPI · React · Three.js · Chart.js &nbsp;|&nbsp; Built
          with 💚 by Vishnu Vardhan Kosuru
        </p>
      </footer>
    </>
  );
}
