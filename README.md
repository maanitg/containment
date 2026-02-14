# contAIment — AI Wildfire Incident Commander

Multi-agent AI assistant for the critical 0–3 hour initial attack window of wildfire response.

**Zero API keys required.** Runs fully offline with deterministic agents.

## Quick Start

You need **Python 3.11+** and **Node.js 18+**. That's it. No API keys.

**1. Start the backend** (Terminal 1):

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**2. Start the frontend** (Terminal 2):

```bash
cd frontend
npm install
npm run dev
```

**3. Open http://localhost:3000**

---

## Project Structure

```
containment/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket loop, endpoints
│   ├── requirements.txt
│   ├── data/
│   │   └── ics209_sample.csv
│   └── agents/
│       ├── orchestrator.py       # Rule-based incident commander
│       ├── historical_memory.py  # NumPy L2 similarity over ICS-209 data
│       ├── fire_simulation.py    # 50x50 cellular automata
│       └── audio_ingest.py       # Hardcoded radio transcript
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Main page
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── MapView.tsx       # Canvas fire grid renderer
│       │   └── ChatSidebar.tsx   # Stats, AI recs, controls
│       └── lib/
│           └── useWebSocket.ts   # Auto-reconnecting WS hook
└── README.md
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Next.js + Canvas     │  ChatSidebar            │
│  Fire grid rendering  │  AI recommendations     │
│  Real-time updates    │  Wind shift trigger      │
└──────────┬──────────────────────┬───────────────┘
           │ WebSocket            │ REST
┌──────────▼──────────────────────▼───────────────┐
│                FastAPI Backend                   │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Orchestrator  │  │ Fire Simulation (50x50)  │ │
│  │ (Rule-based)  │  │ Cellular Automata        │ │
│  └──────┬───────┘  └──────────────────────────┘ │
│         │                                        │
│  ┌──────▼───────┐  ┌──────────────────────────┐ │
│  │ Historical    │  │ Audio Ingest             │ │
│  │ Memory       │  │ (Radio Transcript)       │ │
│  │ (NumPy L2)   │  │                          │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Agents:**
- **Orchestrator** — Deterministic rule-based Incident Commander. Escalates as fire grows: initial attack → reinforce → escalate → evacuate.
- **Historical Memory** — NumPy L2 distance over ICS-209 wildfire records. Finds analog fires by wind speed, humidity, slope, and fuel type.
- **Fire Simulation** — 50x50 cellular automata with wind-weighted spread. Burns for 2 ticks per cell with directional wind influence.
- **Audio Ingest** — Processes radio transcripts (hardcoded for demo) to extract wind shift events.

## Demo Flow (3-Minute Pitch)

**[0:00–0:30] The Problem**
> "When a wildfire ignites, incident commanders have 3 hours to decide: contain or evacuate. They're making life-or-death decisions with incomplete data, radio chatter, and gut instinct. contAIment changes that."

**[0:30–1:00] Show the Map**
> Open the app. The fire is burning at center grid. Point out the real-time simulation — cells spreading, perimeter growing. "This is a cellular automata fire model running live, broadcasting over WebSocket every 5 seconds."

**[1:00–1:45] AI Assessment**
> Point to the sidebar. "Our orchestrator agent continuously assesses escape probability, time to community impact, and recommends operational action. It's informed by a vector similarity search over historical wildfire data from ICS-209 records."
>
> Highlight the historical analogs panel. "The system found similar fires with comparable wind, fuel, and terrain conditions. It uses their outcomes to estimate containment failure probability."

**[1:45–2:30] The Wind Shift**
> Click "Trigger Wind Shift." "A radio report just came in — winds shifting east, gusts to 25 mph."
>
> Watch the fire accelerate eastward. "The simulation reacts immediately. The AI escalates its recommendation — moving from 'maintain current lines' to 'initiate evacuation.'"
>
> Point to the updated escape probability and reasoning.

**[2:30–3:00] The Vision**
> "contAIment is a multi-agent system: fire simulation, historical memory, radio ingestion, and an AI commander working together in real time. This is the future of wildfire incident command — AI that helps humans make faster, better-informed decisions when every minute counts."
