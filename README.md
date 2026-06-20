# Carbon Footprint Awareness Platform

## Overview
A **pure client‑side** web application that helps individuals understand, track, and reduce their carbon footprint. Users log simple daily actions (transport distance, home energy usage, diet type). The app calculates the total CO₂ emissions, visualizes a trend chart, and offers personalized, actionable tips.

### Key Features
- **Zero‑install** – Runs completely in the browser, data stored in `localStorage` (local‑only persistence).
- **Premium Earth‑green UI** – Glassmorphism cards, responsive layout, smooth micro‑animations, and dark‑mode support.
- **Accurate Calculations** – Uses EPA/DEFRA emission factors. 
- **Personalized Insights** – Context‑aware tips based on entered activities.
- **Accessibility** – Semantic HTML, ARIA labels, WCAG 2.1 AA compliant colors, keyboard‑friendly.
- **Testing** – Jest + jsdom unit tests covering calculations, storage, and UI updates.
- **Deployable on GitHub Pages** – No backend required.

## Tech Stack
- **HTML5**, **CSS3** (vanilla), **JavaScript (ES modules)**
- **Chart.js** (CDN) for data visualization
- **Jest** for unit testing (dev dependency)
- **Google Font – Inter** for modern typography

## Project Structure
```
├─ index.html                      # Main page (semantic, accessible)
├─ public/
│   ├─ css/
│   │   └─ style.css               # Premium earth‑green theme
│   └─ js/
│       ├─ footprint.js            # Emission calculations & tip generation
│       ├─ viz.js                  # Chart.js wrapper
│       └─ app.js                  # App glue: UI, storage, dark‑mode
├─ tests/
│   ├─ footprint.test.js          # Unit tests for calculation logic
│   └─ app.test.js                # DOM & localStorage tests (jsdom)
├─ .gitignore
├─ package.json
└─ README.md
```

## Setup & Development
1. **Clone the repository** (or copy the folder to your workspace).
2. Install dev dependencies:
   ```bash
   npm install
   ```
3. Run the development server (optional) – any static server works, e.g. `npx serve` or open `index.html` directly.
4. Run tests:
   ```bash
   npm test
   ```
5. Deploy to **GitHub Pages** – push the repository to GitHub and enable GitHub Pages from the repository settings (root folder).

## Scripts (package.json)
- `test` – Executes Jest tests.
- `lint` – Runs ESLint (configured with Airbnb style). *(optional)*

## Accessibility Checks
The UI uses:
- Proper heading hierarchy (`h1` → `h2`).
- Labels linked to inputs via `for`/`id`.
- ARIA labels for dark‑mode toggle and chart canvas.
- High contrast ratios (≥ 4.5:1) in both light and dark modes.
- Keyboard‑navigable controls.

## License
MIT – feel free to adapt and improve!
