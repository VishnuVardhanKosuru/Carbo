export default function Navbar({ dark, onToggleTheme, apiAvailable }) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="nav-brand">
        <span className="nav-logo" aria-hidden="true">🌿</span>
        <span className="nav-title">Carbo</span>
        <span className="api-badge" title={apiAvailable ? "FastAPI backend connected" : "Offline mode"}>
          {apiAvailable ? "API ✓" : "Offline"}
        </span>
      </div>
      <div className="nav-actions">
        <button
          id="themeToggle"
          className="icon-btn"
          aria-label="Toggle dark mode"
          onClick={onToggleTheme}
        >
          <span id="themeIcon">{dark ? "☀️" : "🌙"}</span>
        </button>
      </div>
    </nav>
  );
}
