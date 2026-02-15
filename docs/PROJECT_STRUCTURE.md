# Project Structure

## Overview
WildfireOS is organized as a monorepo with separate frontend and backend applications.

```
containment/
├── backend/              # Python/FastAPI backend
│   ├── agents/          # Multi-agent AI system
│   ├── data/            # Consolidated data files (JSON)
│   ├── main.py          # FastAPI application entry point
│   └── requirements.txt # Python dependencies
│
├── frontend/            # React/Vite frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API services
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # App entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
│
├── docs/                # Project documentation
│   ├── PROJECT_STRUCTURE.md        # This file
│   ├── DATA_CONSOLIDATION_README.md # Data architecture
│   └── SETUP.md                    # Setup instructions
│
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore rules
└── README.md           # Main project README
```

## Backend Structure

### `/backend/agents/`
Multi-agent AI system for fire analysis:
- `orchestrator.py` - Coordinates multi-agent workflow
- `historical_memory.py` - Analyzes historical fire data

### `/backend/data/`
All data consolidated in JSON format:
- `fire_perimeter.json` - Current fire, wind data, forecasts
- `infrastructure.json` - Communities, firebreaks, water resources
- `terrain.json` - Fuel types, elevations, power lines
- `frontend_historical_fires.json` - Historical fires with map data
- `historical_fires.json` - Historical fires for AI analysis

### Backend Entry Point
- `main.py` - FastAPI application with REST and WebSocket endpoints

## Frontend Structure

### `/frontend/src/components/`
React components:
- `FireMap.jsx` - Main map visualization with Leaflet
- `InsightsPanel.jsx` - Tactical intelligence panel (unused currently)
- `LayerControls.jsx` - Map layer toggles

### `/frontend/src/hooks/`
Custom React hooks:
- `useFireData.js` - Fetches data from backend API

### `/frontend/src/services/`
API integration:
- `dataService.js` - Backend API client

## Data Flow

```
Backend Data (JSON files)
    ↓
FastAPI Endpoints (/api/data/*)
    ↓
Frontend DataService
    ↓
useFireData Hook
    ↓
React Components
```

## Configuration Files

### Root Level
- `.env` - Environment variables (not in git)
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

### Backend
- `requirements.txt` - Python dependencies

### Frontend
- `package.json` - Node.js dependencies
- `vite.config.js` - Vite build configuration
- `eslint.config.js` - ESLint rules

## Documentation

All documentation lives in `/docs/`:
- `PROJECT_STRUCTURE.md` - Architecture overview (this file)
- `DATA_CONSOLIDATION_README.md` - Data consolidation details
- `SETUP.md` - Setup and installation guide

## Key Design Decisions

1. **Monorepo Structure**: Frontend and backend in one repo for easier development
2. **Data Consolidation**: All data in backend for single source of truth
3. **API-First**: Backend exposes REST API for data access
4. **React Hooks**: Custom hooks for data fetching and state management
5. **Component-Based UI**: Modular React components for maintainability

## Adding New Features

### New Data File
1. Add JSON file to `/backend/data/`
2. Create endpoint in `/backend/main.py`
3. Update `/frontend/src/services/dataService.js`
4. Use data in components via props

### New Backend Agent
1. Create agent file in `/backend/agents/`
2. Import and use in orchestrator
3. Update agent workflow as needed

### New Frontend Component
1. Create component in `/frontend/src/components/`
2. Use `useFireData` hook for data access
3. Import and use in App.jsx

## Environment Variables

### Backend (.env in root)
- `GEMINI_API_KEY` - For historical memory agent
- `OPENAI_API_KEY` - For multi-agent system

### Frontend (optional .env in /frontend)
- `VITE_API_URL` - Backend API URL (defaults to localhost:8000)

## Build and Deploy

### Development
```bash
# Backend
cd backend && python main.py

# Frontend
cd frontend && npm run dev
```

### Production
```bash
# Backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm run build
# Serve dist/ with your web server
```

## Testing

Currently no automated tests. Recommended additions:
- Backend: pytest for API endpoints
- Frontend: Vitest for components
- E2E: Playwright for integration tests

## Git Workflow

1. Feature branches from `main`
2. Commit with clear messages
3. PR for review
4. Merge to `main` after approval

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and update data files as needed
- Monitor API key usage
- Check backend logs for errors
- Update documentation for changes
