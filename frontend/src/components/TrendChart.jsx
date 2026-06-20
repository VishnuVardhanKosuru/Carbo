import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function TrendChart({ history }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const isDark = document.body.classList.contains("dark");
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)";

    const ctx = canvasRef.current.getContext("2d");

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: history.map((r) => r.record_date),
        datasets: [{
          label: "Daily CO₂ (kg)",
          data: history.map((r) => r.footprint_kg),
          borderColor: "hsl(141,52%,42%)",
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
            g.addColorStop(0, "rgba(74,222,128,0.28)");
            g.addColorStop(1, "rgba(74,222,128,0.0)");
            return g;
          },
          borderWidth: 2.5,
          tension: 0.45,
          fill: true,
          pointBackgroundColor: "hsl(141,52%,42%)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(7,18,9,0.92)",
            borderColor: "rgba(74,222,128,0.3)",
            borderWidth: 1,
            titleColor: "#fff",
            bodyColor: "rgba(255,255,255,0.72)",
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items) => `📅 ${items[0].label}`,
              label: (item)  => `  ${item.raw} kg CO₂`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: textColor, font: { size: 11 }, callback: (v) => `${v} kg` },
            title: { display: true, text: "CO₂ (kg)", color: textColor, font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } },
            title: { display: true, text: "Date", color: textColor, font: { size: 11 } },
          },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [history]);

  const hasData = history && history.length > 0;

  return (
    <div className="chart-wrap">
      {!hasData && (
        <div className="chart-empty">
          <span>📈</span>
          <p>Log entries to see your trend</p>
        </div>
      )}
      <canvas ref={canvasRef} id="footprintChart" style={{ display: hasData ? "block" : "none" }} />
    </div>
  );
}
