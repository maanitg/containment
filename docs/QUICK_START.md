# Quick Start Guide

Get WildfireOS running in 5 minutes.

## Prerequisites

- Python 3.9+ installed
- Node.js 18+ and npm installed
- API keys for Gemini and OpenAI

## Step 1: Clone and Setup

```bash
cd /path/to/containment

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
# GEMINI_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
```

## Step 2: Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

The backend will start on **http://localhost:8000**

You should see:
```
🔥 WildfireOS Backend Starting...
📍 API: http://localhost:8000
📍 Docs: http://localhost:8000/docs
🔌 WebSocket: ws://localhost:8000/ws
```

## Step 3: Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on **http://localhost:5173**

## Step 4: Open in Browser

Open **http://localhost:5173** in your browser.

You should see:
1. Loading screen while data fetches
2. Fire map with active fire perimeter
3. Active alerts in the sidebar
4. Map legend at bottom

## Verify It's Working

### Backend Health Check
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### Data Endpoints
```bash
# Get all data
curl http://localhost:8000/api/data/all

# Get fire data only
curl http://localhost:8000/api/data/fire-perimeter
```

### Frontend
- Map should display with fire perimeter
- Alerts should appear in right sidebar
- Toggle map layers using legend controls
- Click on map features for popups

## Common Issues

### Backend won't start

**Error: "GEMINI_API_KEY not found"**
- Solution: Add API keys to `.env` file

**Error: "Port 8000 already in use"**
- Solution: Stop other services on port 8000 or change port in `main.py`

**Error: "Module not found"**
- Solution: Install dependencies: `pip install -r requirements.txt`

### Frontend won't start

**Error: "Cannot find module"**
- Solution: Run `npm install`

**Error: "EADDRINUSE: Port 5173 in use"**
- Solution: Stop other Vite servers or Vite will auto-increment port

### Frontend shows error

**"Error Loading Data"**
- Solution: Make sure backend is running on port 8000
- Check: `curl http://localhost:8000/health`

**Map not rendering**
- Solution: Check browser console for errors
- Ensure Leaflet CSS is loading

## Next Steps

1. **Explore the API**: Visit http://localhost:8000/docs for interactive API documentation
2. **Customize data**: Edit JSON files in `backend/data/`
3. **Read documentation**: See `docs/` folder for detailed guides
4. **Review architecture**: Check `docs/PROJECT_STRUCTURE.md`

## Development Workflow

```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Testing/Development
# Make your changes here
```

## Stop the Servers

- Backend: Press `Ctrl+C` in backend terminal
- Frontend: Press `Ctrl+C` in frontend terminal

## Environment Variables Reference

### Backend (.env in root)
```bash
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

### Frontend (optional .env.local in frontend/)
```bash
VITE_API_URL=http://localhost:8000
```

## Need Help?

- Check `docs/SETUP.md` for detailed setup
- Review `docs/PROJECT_STRUCTURE.md` for architecture
- See `docs/DATA_CONSOLIDATION_README.md` for data flow
- Check GitHub issues for known problems
