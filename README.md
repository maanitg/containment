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

WildfireOS is a command-and-control platform designed for wildfire incident commanders. It integrates:

- **Real-time fire behavior physics** - Deterministic calculations for spread velocity, threat levels
- **Multi-agent AI orchestration** - 6 specialized agents (GPT-4o + Gemini) coordinating analysis
- **Closed-loop validation** - AI outputs must pass physics constraints or trigger automatic replanning
- **Interactive mapping** - Leaflet-based visualization with fire perimeters, terrain, infrastructure
- **Historical memory** - Context-aware recommendations based on similar past incidents

### Key Features

✅ **Physics-grounded AI** - Agents cannot contradict deterministic fire behavior calculations
✅ **Automatic error correction** - Failed validation triggers agent replanning (max 2 retries)
✅ **Real-time streaming** - WebSocket support for live status updates as agents work
✅ **Historical context** - Gemini 1.5 Pro analyzes past fires with similar conditions
✅ **Tactical alerts** - Concise factual notifications (max 10 words each)
✅ **Offline-first support** - Works without network connectivity using cached data

---

## 🏗️ Architecture

### Multi-Agent Pipeline

```
Live Fire Data → Graph Physics Engine → Deterministic Calculations
                                              ↓
                    ┌────────────────────────┴────────────────────────┐
                    ↓                                                  ↓
            Fire Behavior Agent                              Risk Analysis Agent
              (GPT-4o)                                           (GPT-4o)
                    ↓                                                  ↓
                    └────────────────┬───────────────────────────────┘
                                     ↓
                    ┌────────────────┴────────────────┐
                    ↓                                  ↓
          Notification Agent                  Recommendation Agent
            (GPT-4o)                               (GPT-4o)
         Generates 3 facts                     Provides 1 action
                    ↓                                  ↓
                    └────────────────┬────────────────┘
                                     ↓
                                 Validator
                          (Physics constraint check)
                                     ↓
                              Output to Frontend
```

**Agents:**

1. **Graph Physics Engine** - Computes base spread velocity, slope/vegetation multipliers, baseline threat
2. **Fire Behavior Agent** (GPT-4o) - Analyzes wind, slope, vegetation effects on spread
3. **Risk Analysis Agent** (GPT-4o) - Identifies threatened infrastructure, assigns threat levels
4. **Notification Agent** (GPT-4o) - Generates 3 concise factual alerts (max 10 words each)
5. **Recommendation Agent** (GPT-4o) - Provides single tactical action (max 12 words) with brief rationale
6. **Historical Memory Agent** (Gemini 1.5 Pro) - Finds analogous past fires, contextualizes behavior
7. **Validator** - Ensures AI outputs obey physics (critical threats must match deterministic baseline)

---

## 📡 API Reference

### Main Processing Endpoint

**POST** `/api/process-live-data/{time_index}`

Processes timestamped fire data through the agent pipeline (time_index: 1-5)

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "fact": "Fire approaching Ridgeview - 2.8km away",
      "urgency": "critical",
      "time_label": "T+0h (08:00)"
    }
  ],
  "recommendation": {
    "action": "Deploy crews to Johnson Creek firebreak immediately",
    "rationale": "Fire will reach location in 3 hours, last defensible position",
    "confidence_score": 85,
    "time_label": "T+0h (08:00)"
  }
}
```

### Other Endpoints

- **GET** `/api/data/all` - Get all static map data (fire perimeter, terrain, infrastructure)
- **GET** `/api/notifications?limit=20&offset=0` - Get agent-generated notifications
- **GET** `/api/recommendations/latest` - Get most recent recommendation
- **GET** `/health` - Health check
- **WebSocket** `ws://localhost:8000/ws` - Real-time streaming updates

Full API documentation: http://localhost:8000/docs

---

## 🧪 How It Works: Closed-Loop Validation

WildfireOS uses a **deterministic physics engine** to establish ground truth, then validates all AI outputs against it:

```python
# Deterministic baseline
if slope > 20: threat = "CRITICAL"
if town_distance < 5km: threat = "CRITICAL"

# AI Risk Agent outputs: "ELEVATED"
# ❌ Validator catches contradiction

# System forces replan with feedback:
# "Physics violation: deterministic calculates CRITICAL but you output ELEVATED. You MUST escalate."

# AI tries again with corrective feedback → outputs "CRITICAL"
# ✅ Validator approves
```

This prevents AI hallucination and ensures recommendations are grounded in fire behavior physics.

---

## 📁 Project Structure

```
containment/
├── backend/              # Python/FastAPI backend
│   ├── agents/
│   │   ├── orchestrator.py          # Multi-agent coordination
│   │   └── historical_memory.py     # Gemini historical context
│   ├── data/                         # JSON data files
│   ├── main.py                       # API endpoints
│   ├── notification_manager.py       # Notification storage
│   └── requirements.txt
├── frontend/            # React/Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── FireMap.jsx          # Leaflet map
│   │   │   └── LayerControls.jsx    # Map controls
│   │   ├── services/
│   │   │   └── dataService.js       # API client
│   │   ├── offline/                 # Offline-first support
│   │   ├── App.jsx                  # Main app
│   │   └── App.css                  # Styles
│   └── package.json
├── docs/                # Additional documentation
└── README.md           # This file
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```bash
# Required
OPENAI_API_KEY=your_openai_key      # For multi-agent system
GEMINI_API_KEY=your_gemini_key      # For historical memory

# Optional Frontend
VITE_API_URL=http://localhost:8000  # Backend API URL (defaults to localhost:8000)
```

---

## 📊 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19 + Vite | UI framework |
| Mapping | Leaflet + react-leaflet | Interactive fire maps |
| Backend | FastAPI + Uvicorn | API server |
| AI Orchestration | OpenAI GPT-4o | Multi-agent reasoning |
| Historical Memory | Google Gemini 1.5 Pro | Context window for past fires |
| Validation | Pydantic + Custom Logic | Type safety + physics checks |
| Real-time | WebSockets | Streaming updates |
| Offline | IndexedDB + Service Worker | Offline-first support |

---

## 🛠️ Development

### Running the Backend

```bash
cd backend
python main.py
```
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- WebSocket: ws://localhost:8000/ws

### Running the Frontend

```bash
cd frontend
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
```
- App: http://localhost:5173

### Testing

```bash
# Backend health check
curl http://localhost:8000/health

# Get all static data
curl http://localhost:8000/api/data/all

# Process timestamped data
curl -X POST http://localhost:8000/api/process-live-data/1

# Frontend: Open http://localhost:5173
# - Map should show fire perimeter
# - Notifications should appear in sidebar after processing
# - Recommendation appears in bottom-right card
```

---

## 🌐 Offline-First Support

The app includes a complete offline-first system:

- **Connectivity detection** - Real-time network status monitoring
- **Offline banner** - Visual indicator when offline
- **IndexedDB cache** - Network-first strategy with fallback to cached data
- **Service worker** - Caches app shell and map tiles
- **Write queue** - Queues requests made while offline for replay on reconnect

### Testing Offline Mode

1. Load the app online and navigate the map to cache tiles
2. Open DevTools > Network > check "Offline"
3. Verify offline banner appears at top
4. Navigate the map - cached tiles display
5. Uncheck "Offline" - banner disappears, "Back online" toast shows

---

## 🤝 Contributing

Built for TreeHacks 2026. For issues or questions, please open an issue in the repository.

---

## 🔗 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Leaflet Maps](https://leafletjs.com/)
- [Wildfire Behavior Fundamentals](https://www.nwcg.gov/)

---

**Built with ❤️ for wildfire incident commanders**

TreeHacks 2026 Project
