# 🔥 WildfireOS

**AI-Powered Wildfire Intelligence & Command System**

A real-time multi-agent decision support system for wildfire incident command, combining deterministic physics calculations with coordinated AI agents to provide tactical recommendations, threat assessments, and automated alerts.

---

## 🚀 Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY and GEMINI_API_KEY

# 2. Start backend (Terminal 1)
cd backend
pip install -r requirements.txt
python main.py

# 3. Start frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 4. Open http://localhost:5173
```

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)
- **Google Gemini API Key** - [Get one here](https://aistudio.google.com/app/apikey)

---

## 🎯 Overview

Command-and-control platform for wildfire incident commanders combining deterministic physics with coordinated AI agents.

**Core Capabilities:**
- **Physics-grounded AI** - Deterministic calculations validate all AI outputs; violations trigger automatic replanning
- **Geographic historical memory** - Gemini analyzes past fires from the same region to inform tactics
- **Multi-agent orchestration** - 6 specialized agents (GPT-4o + Gemini) coordinate analysis in real-time
- **Closed-loop validation** - Failed physics checks force agent replanning (max 2 retries)
- **Interactive mapping** - Leaflet visualization with fire perimeters, terrain, infrastructure
- **Offline-first** - Works without connectivity using cached data and IndexedDB

---

## 🏗️ Architecture

### Multi-Agent Pipeline

```
                          Live Fire Data
                                ↓
                    Graph Physics Engine
                  (deterministic calculations)
                                ↓
        ┌───────────────────────┴───────────────────────┐
        ↓                                                ↓
  Historical Memory                                Physics Data
   (Gemini 1.5 Pro)                              (spread, threat)
  Finds regional fires                                  ↓
        ↓                                                ↓
        └───────────────────┬────────────────────────────┘
                            ↓
            ┌───────────────┴───────────────┐
            ↓                                ↓
    Fire Behavior Agent             Risk Analysis Agent
         (GPT-4o)                        (GPT-4o)
  Physics + History               Physics + History
            ↓                                ↓
            └───────────────┬────────────────┘
                            ↓
            ┌───────────────┴───────────────┐
            ↓                                ↓
    Notification Agent              Recommendation Agent
         (GPT-4o)                        (GPT-4o)
      3 factual alerts                 1 tactical action
            ↓                                ↓
            └───────────────┬────────────────┘
                            ↓
                        Validator
                (physics constraint check)
                            ↓
                     Frontend Output
```

**Agent Roles:**

1. **Graph Physics Engine** - Computes spread velocity, threat levels using deterministic formulas
2. **Historical Memory** (Gemini) - Finds past fires in same region, provides learned tactics
3. **Fire Behavior** (GPT-4o) - Analyzes spread patterns using physics + historical context
4. **Risk Analysis** (GPT-4o) - Identifies threatened infrastructure using physics + history
5. **Notification** (GPT-4o) - Generates 3 concise alerts (≤10 words each)
6. **Recommendation** (GPT-4o) - Provides 1 tactical action (≤12 words) with rationale
7. **Validator** - Enforces physics constraints; triggers replanning if violated (max 2 retries)

---

## 📡 API Reference

**Main Endpoint**
- `POST /api/process-live-data/{time_index}` - Process timestamped fire data (index: 1-5)
  - Returns: notifications (3 facts) + recommendation (1 action) + physics calculations

**Data Endpoints**
- `GET /api/data/all` - Static map data (fire perimeter, terrain, infrastructure)
- `GET /api/notifications?limit=20&offset=0` - Agent-generated notifications
- `GET /api/recommendations/latest` - Most recent recommendation
- `GET /health` - Health check
- `WebSocket ws://localhost:8000/ws` - Real-time agent status streaming

**Full docs:** http://localhost:8000/docs

---

## 🧪 How It Works

### Historical Context Integration

**Geographic-first matching:**
1. System loads past fires from `historical_fires.json` (behavior, tactics, resources)
2. Gemini prioritizes **same region** (e.g., Northern California), then matches wind/slope/vegetation
3. Generates 3-sentence summary of how those regional fires behaved
4. Context provided to Fire Behavior & Risk Analysis agents for informed predictions

**Example output:**
> "The 2022 Canyon Creek Fire in Northern California exhibited rapid uphill spread through chaparral under 25mph NE winds on 30° slopes, requiring defensive positioning ahead of the fire front. Resources escalated 5x when fire reached chaparral belt, with dozer lines on ridgetops proving most effective."

### Closed-Loop Validation

Physics engine establishes ground truth; AI outputs must comply or trigger replanning:

```python
# Deterministic baseline
if slope > 20: threat = "CRITICAL"
if town_distance < 5km: threat = "CRITICAL"

# AI outputs "ELEVATED" → ❌ Validator rejects

# System forces replan:
# "Physics violation: deterministic calculates CRITICAL but you output ELEVATED. You MUST escalate."

# AI retries → outputs "CRITICAL" → ✅ Approved
```

**Result:** No AI hallucinations. All recommendations grounded in fire physics.

---

## 📁 Project Structure

```
containment/
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py          # Multi-agent coordination + physics engine
│   │   └── historical_memory.py     # Gemini geographic matching
│   ├── data/                         # Fire perimeter, terrain, historical fires (JSON)
│   ├── main.py                       # FastAPI endpoints + WebSocket
│   └── notification_manager.py       # Stores agent outputs
├── frontend/
│   ├── src/
│   │   ├── components/               # FireMap (Leaflet), LayerControls
│   │   ├── services/                 # API client
│   │   ├── offline/                  # IndexedDB + Service Worker
│   │   └── App.jsx                   # Main UI
│   └── package.json
└── README.md
```

---

## 🔑 Environment Variables

Create `.env` in root:

```bash
# Required
OPENAI_API_KEY=your_key_here     # Multi-agent system (GPT-4o)
GEMINI_API_KEY=your_key_here     # Historical memory (Gemini 1.5 Pro)

# Optional
VITE_API_URL=http://localhost:8000  # Backend URL (default: localhost:8000)
```

---

## 📊 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Vite + Leaflet | UI + interactive maps |
| Backend | FastAPI + Uvicorn | API server |
| AI Agents | GPT-4o + Gemini 1.5 Pro | Multi-agent reasoning + historical memory |
| Validation | Pydantic + Physics Engine | Type safety + constraint checks |
| Real-time | WebSockets | Live agent status streaming |
| Offline | IndexedDB + Service Worker | Network-first caching |

---

## 🛠️ Development

**Backend** (http://localhost:8000)
```bash
cd backend && python main.py
# API docs: /docs | WebSocket: ws://localhost:8000/ws
```

**Frontend** (http://localhost:5173)
```bash
cd frontend && npm run dev
# Build: npm run build | Preview: npm run preview
```

**Testing**
```bash
# Health check
curl http://localhost:8000/health

# Process timestamped fire data (1-5)
curl -X POST http://localhost:8000/api/process-live-data/1

# Frontend: Verify map shows fire perimeter, notifications appear in sidebar
```

---

## 🌐 Offline-First Support

**Features:**
- Real-time connectivity detection with visual banner
- IndexedDB cache (network-first strategy with fallback)
- Service worker caches app shell + map tiles
- Write queue for offline requests (auto-replay on reconnect)

**Test offline mode:**
1. Load app online, navigate map to cache tiles
2. DevTools > Network > Enable "Offline"
3. Verify offline banner appears, cached tiles still render
4. Disable "Offline" → "Back online" toast appears

---

## 🤝 Contributing

Built for TreeHacks 2026. Open issues for questions or bugs.

**Resources:** [FastAPI](https://fastapi.tiangolo.com/) | [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) | [Gemini API](https://ai.google.dev/docs) | [Leaflet](https://leafletjs.com/) | [NWCG Fire Behavior](https://www.nwcg.gov/)