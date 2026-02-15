# WildfireOS Setup Guide

A multi-agent wildfire intelligence system with real-time fire behavior analysis.

## Architecture

- **Frontend**: React + Vite + Leaflet (interactive fire mapping)
- **Backend**: FastAPI + OpenAI + Google Gemini (multi-agent orchestration)

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

## Quick Start

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd containment/frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r ../requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

Add your keys:
```env
OPENAI_API_KEY=sk-your-actual-key-here
GEMINI_API_KEY=your-actual-key-here
```

### 3. Start the Backend

```bash
cd backend
python main.py
```

The backend will start on `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- WebSocket endpoint: `ws://localhost:8000/ws`

### 4. Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

## API Endpoints

### REST API

**POST** `/api/analyze`
```json
{
  "live_graph": {
    "step": 10,
    "total_burning": 450,
    "total_burned": 2300
  },
  "wind_data": {
    "speed": 25,
    "direction": 45
  },
  "environment_data": {
    "slope": 30,
    "terrain_vegetation": "chaparral"
  },
  "infrastructure_data": {
    "nearby_towns": [
      {"name": "Pine Grove", "distance_km": 4.5}
    ]
  }
}
```

**Response:**
```json
{
  "notifications": [
    {
      "headline": "Critical Spread Alert",
      "explanation": "Fire spreading rapidly uphill..."
    }
  ],
  "recommendation": {
    "consideration": "Deploy additional resources",
    "rationale": "Physics indicates critical threat level",
    "confidence_score": 85
  },
  "computed_physics": {
    "base_spread_velocity": 45.0,
    "effective_velocity_multiplier": 1.8,
    "deterministic_baseline_threat": "CRITICAL"
  },
  "history_summary": "Similar conditions in Canyon Creek Fire 2022..."
}
```

### WebSocket

Connect to `ws://localhost:8000/ws` for real-time streaming updates.

Send fire data and receive status updates as the multi-agent system processes:
```json
{
  "type": "status_update",
  "status": {
    "graph_physics": "complete",
    "level_1_agents": "running",
    "level_2_agents": "idle",
    "validation": "idle"
  }
}
```

## Multi-Agent System

The backend uses a coordinated multi-agent architecture:

1. **Graph Physics Engine** - Deterministic fire behavior calculations
2. **Fire Behavior Agent** (GPT-4o) - Analyzes spread patterns
3. **Risk Analysis Agent** (GPT-4o) - Assesses infrastructure threats
4. **Notification Agent** (GPT-4o) - Generates tactical alerts
5. **Recommendation Agent** (GPT-4o) - Provides command decisions
6. **Historical Memory Agent** (Gemini 1.5 Pro) - Contextualizes with past incidents
7. **Validator** - Ensures AI outputs obey physics constraints

## Project Structure

```
containment/
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py      # Multi-agent coordination
│   │   └── historical_memory.py # Gemini-based historical context
│   ├── data/
│   │   └── historical_fires.json
│   └── main.py                   # FastAPI server
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FireMap.jsx      # Main map visualization
│   │   │   ├── InsightsPanel.jsx
│   │   │   └── LayerControls.jsx
│   │   ├── data/                # Mock fire data
│   │   └── App.jsx
│   └── package.json
├── requirements.txt
├── .env.example
└── SETUP.md
```

## Troubleshooting

### Backend Issues

**Import errors:**
```bash
pip install --upgrade -r requirements.txt
```

**API key errors:**
- Verify your `.env` file exists in the `containment/` directory
- Check that API keys are valid and have sufficient credits

### Frontend Issues

**Port already in use:**
```bash
# Vite will automatically try the next available port (5174, 5175, etc.)
# Or specify a port:
npm run dev -- --port 3000
```

**CORS errors:**
- Ensure backend is running on `http://localhost:8000`
- Check that CORS middleware in `backend/main.py` includes your frontend port

## Development

### Adding New Agents

1. Create agent function in `backend/agents/orchestrator.py`
2. Add to execution graph in `execute_agent_graph()`
3. Update status tracker keys

### Customizing Fire Data

Edit frontend mock data:
- `frontend/src/data/firePerimeter.js` - Current fire state
- `frontend/src/data/terrain.js` - Fuel types, ridgelines
- `frontend/src/data/infrastructure.js` - Communities, firebreaks

## Production Deployment

For production use:

1. Use environment-specific `.env` files
2. Enable HTTPS/WSS for secure WebSocket connections
3. Add authentication/authorization middleware
4. Rate limit API endpoints
5. Use a production ASGI server (gunicorn + uvicorn workers)
6. Deploy frontend with `npm run build`

## License

TreeHacks 2025 Project
