# FireMind — AI Wildfire Incident Commander

Multi-agent AI assistant for the critical 0–3 hour initial attack window of wildfire response.

**Zero API keys required.** Runs fully offline with deterministic mock agents.

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
- **Orchestrator** — Deterministic rule-based Incident Commander. Escalates recommendations as fire grows: initial attack → reinforce → escalate → evacuate.
- **Historical Memory** — NumPy L2 distance over ICS-209 wildfire records. Finds analog fires by wind speed, humidity, slope, and fuel type.
- **Fire Simulation** — 50x50 cellular automata with wind-weighted spread. Produces burning cells and perimeter polygon.
- **Audio Ingest** — Processes radio transcripts (hardcoded for demo) to extract wind shift events.

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+

No API keys needed.

### Backend

```bash
cd firemind/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd firemind/frontend
npm install
npm run dev
```

Open http://localhost:3000

## Demo Flow (3-Minute Pitch)

**[0:00–0:30] The Problem**
> "When a wildfire ignites, incident commanders have 3 hours to decide: contain or evacuate. They're making life-or-death decisions with incomplete data, radio chatter, and gut instinct. FireMind changes that."

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
> "FireMind is a multi-agent system: fire simulation, historical memory, radio ingestion, and an AI commander working together in real time. This is the future of wildfire incident command — AI that helps humans make faster, better-informed decisions when every minute counts."
