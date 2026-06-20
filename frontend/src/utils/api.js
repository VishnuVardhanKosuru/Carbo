// API client — communicates with the FastAPI backend

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001/api/v1";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message || "API error"), { status: res.status, data: err });
  }
  return res.json();
}

export const api = {
  health:     ()        => request("/health"),
  cacheStats: ()        => request("/cache/stats"),
  factors:    ()        => request("/factors"),

  calculate: (body)     => request("/footprint/calculate", { method: "POST", body: JSON.stringify(body) }),
  logRecord: (body)     => request("/footprint/log",       { method: "POST", body: JSON.stringify(body) }),
  getHistory: ()        => request("/footprint/history"),
  clearHistory: ()      => request("/footprint/history",   { method: "DELETE" }),

  getTips: (body)       => request("/tips",                { method: "POST", body: JSON.stringify(body) }),
};
