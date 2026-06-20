// viz.js – Chart.js premium line chart for footprint trends

let footprintChart = null;

const chartColors = {
  line:   "hsl(141, 52%, 45%)",
  fill:   "rgba(74, 222, 128, 0.12)",
  point:  "hsl(141, 52%, 45%)",
  grid:   "rgba(255,255,255,0.05)",
  text:   "rgba(255,255,255,0.4)",
};

function isDark() {
  return document.body.classList.contains("dark");
}

function chartDefaults() {
  const dark = isDark();
  return {
    gridColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    textColor: dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
  };
}

export function initChart(history) {
  const canvas = document.getElementById("footprintChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const labels = history.map(r => r.date);
  const data   = history.map(r => r.footprint);

  if (footprintChart) {
    footprintChart.destroy();
    footprintChart = null;
  }

  const { gridColor, textColor } = chartDefaults();

  footprintChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Daily CO₂ (kg)",
        data,
        borderColor: "hsl(141, 52%, 45%)",
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          gradient.addColorStop(0, "rgba(74,222,128,0.28)");
          gradient.addColorStop(1, "rgba(74,222,128,0.0)");
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.45,
        fill: true,
        pointBackgroundColor: "hsl(141, 52%, 45%)",
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
            title: items => `📅 ${items[0].label}`,
            label: item  => `  ${item.raw} kg CO₂`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: textColor,
            font: { size: 11, family: "'Inter', sans-serif" },
            callback: v => `${v} kg`,
          },
          title: {
            display: true,
            text: "CO₂ (kg)",
            color: textColor,
            font: { size: 11 },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: 11, family: "'Inter', sans-serif" },
          },
          title: {
            display: true,
            text: "Date",
            color: textColor,
            font: { size: 11 },
          },
        },
      },
    },
  });
}

export function addRecordToChart(record) {
  if (!footprintChart) return;
  footprintChart.data.labels.push(record.date);
  footprintChart.data.datasets[0].data.push(record.footprint);
  footprintChart.update("active");
}
