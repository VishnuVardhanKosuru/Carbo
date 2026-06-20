// app.js – Main application orchestrator

import { calculateFootprint, generateTips } from "./footprint.js";
import { initThree, updateBars, showLoading, initHeroGlobe } from "./threeViz.js";
import { initChart, addRecordToChart } from "./viz.js";

/* ---- Storage ---- */
const STORAGE_KEY = "cf_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

/* ---- Date helper ---- */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ---- Stats strip ---- */
function updateStats(history) {
  const days    = history.length;
  const total   = history.reduce((s, r) => s + r.footprint, 0);
  const avg     = days ? (total / days).toFixed(2) : "—";
  const totalFmt = days ? total.toFixed(1) : "—";

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; }
  };
  set("statAvg",   avg);
  set("statTotal", totalFmt);
  set("statDays",  days || "—");
}

/* ---- Result & tips ---- */
function renderResult(record) {
  const resultDiv = document.getElementById("footprintResult");
  if (resultDiv) {
    resultDiv.textContent = `🌿 Today's footprint: ${record.footprint} kg CO₂`;
    resultDiv.classList.remove("hidden");
    resultDiv.style.animation = "none";
    requestAnimationFrame(() => { resultDiv.style.animation = ""; });
  }

  const tipsDiv = document.getElementById("tips");
  if (tipsDiv) {
    const tips = generateTips(record.activity);
    tipsDiv.innerHTML = `<h3>💡 Personalised Tips</h3><ul>${tips.map(t => `<li>${t}</li>`).join("")}</ul>`;
  }
}

/* ---- Live score preview ---- */
function bindLivePreview(form) {
  const score = document.getElementById("liveScore");
  function recalc() {
    const transport = parseFloat(form.transport.value) || 0;
    const energy    = parseFloat(form.energy.value) || 0;
    const diet      = form.diet.value || "average";
    const fp        = calculateFootprint({ transport, energy, diet });
    if (score) score.textContent = fp;
  }
  form.addEventListener("input", recalc);
  recalc();
}

/* ---- Chart empty state ---- */
function syncChartEmpty(history) {
  const empty = document.getElementById("chartEmpty");
  if (empty) empty.classList.toggle("hidden", history.length > 0);
}

/* ---- Background particle canvas ---- */
function initParticles() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.35 + 0.05,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.body.classList.contains("dark");
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(74,222,128,${p.alpha})`
        : `rgba(34,197,94,${p.alpha * 0.6})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  makeParticles();
  window.addEventListener("resize", () => { resize(); makeParticles(); });
  draw();
}

/* ---- Init ---- */
function initApp() {
  const form      = document.getElementById("activityForm");
  const themeBtn  = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  /* Theme */
  const savedTheme = localStorage.getItem("cf_theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
  document.body.classList.toggle("dark", isDark);
  if (themeIcon) themeIcon.textContent = isDark ? "☀️" : "🌙";

  themeBtn?.addEventListener("click", () => {
    const nowDark = document.body.classList.toggle("dark");
    localStorage.setItem("cf_theme", nowDark ? "dark" : "light");
    if (themeIcon) themeIcon.textContent = nowDark ? "☀️" : "🌙";
  });

  /* Particles */
  initParticles();

  /* Hero globe */
  const heroGlobe = document.getElementById("heroGlobe");
  if (heroGlobe) initHeroGlobe(heroGlobe);

  /* History */
  let history = loadHistory();

  /* Chart */
  syncChartEmpty(history);
  initChart(history);

  /* 3D */
  const threeContainer = document.getElementById("threeContainer");
  showLoading(true);
  if (threeContainer) {
    // Small delay so spinner is visible on first load
    setTimeout(() => initThree(threeContainer, history), 200);
  }

  /* Stats */
  updateStats(history);

  /* Show last result if history exists */
  if (history.length) renderResult(history[history.length - 1]);

  /* Live preview */
  if (form) bindLivePreview(form);

  /* Form submit */
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const transport = e.target.transport.value;
    const energy    = e.target.energy.value;
    const diet      = e.target.diet.value;
    const activity  = { transport, energy, diet };
    const footprint = calculateFootprint(activity);
    const record    = { date: todayStr(), footprint, activity };

    history = [...history, record];
    saveHistory(history);
    renderResult(record);
    addRecordToChart(record);
    syncChartEmpty(history);
    updateBars(history);
    updateStats(history);
    form.reset();

    // Reset live score
    const score = document.getElementById("liveScore");
    if (score) score.textContent = "—";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
