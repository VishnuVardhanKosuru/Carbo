# 🌿 Carbo — Carbon Footprint Tracker

A premium, full-stack web application designed to help individuals track, understand, and reduce their daily carbon footprint using real-time 3D visualizations.

## 🚀 Architecture

This platform was recently upgraded from a static vanilla JS site to a production-grade decoupled architecture:

1. **Frontend (React + Vite)**: A highly interactive, glassmorphic UI built with React. Features interactive 3D elements powered by **Three.js** (Hero Globe, 3D Bar Chart) and 2D charts via **Chart.js**. It also gracefully falls back to local computation if the backend API is offline.
2. **Backend (FastAPI)**: A high-performance Python REST API that calculates accurate CO₂ emissions based on scientific factors, serves personalized eco-tips, and stores activity history (mocked Firestore logic). It includes strict **Pydantic v2 validation**, a **TTL cache**, and security headers middleware.

---

## 🛠️ How to Run Locally

You need to run both the backend and frontend servers simultaneously in separate terminal windows.

### 1. Run the FastAPI Backend
Open a terminal and navigate to the `backend` directory:
```bash
cd backend

# Install python dependencies (FastAPI, Uvicorn, etc.)
python3 -m pip install -r requirements.txt

# Run the development server
python3 -m uvicorn app.main:app --reload --port 8001
```
> **Note**: The API runs on port `8001`. You can view the interactive API documentation at [http://localhost:8001/docs](http://localhost:8001/docs).

### 2. Run the React Frontend
Open a *second* terminal and navigate to the `frontend` directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
> **Note**: The UI will run on port `5173`. Open your browser to [http://localhost:5173](http://localhost:5173) to view the application!

---

## 🧪 Testing

Both layers are fully tested with high coverage. You can run all tests from the root directory using:

```bash
npm test
```

*(This command will automatically run Vitest for the frontend and Pytest for the backend).*

Alternatively, you can run them individually:
- **Backend Tests**: `cd backend && python3 -m pytest tests/`
- **Frontend Tests**: `cd frontend && npx vitest run`

---

## 🌍 Fallback / Legacy Version
If you wish to view the legacy Vanilla JavaScript/HTML version, it is still preserved in the root `index.html` and the `public/` directory. You can view it by simply serving the root directory:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000/`. Note that the new React frontend is entirely separate and superior.
