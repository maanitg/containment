from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
import asyncio

from agents.orchestrator import execute_agent_graph
from agents.historical_memory import HistoricalMemory

app = FastAPI(title="WildfireOS Backend")

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize historical memory agent
historical_memory = HistoricalMemory()

# --- Request/Response Models ---

class FireAnalysisRequest(BaseModel):
    live_graph: dict[str, Any]
    wind_data: dict[str, Any]
    environment_data: dict[str, Any]
    infrastructure_data: dict[str, Any]
    previous_recommendation: dict[str, Any] | None = None

class FireAnalysisResponse(BaseModel):
    notifications: list[dict[str, Any]]
    recommendation: dict[str, Any]
    computed_physics: dict[str, Any]
    history_summary: str

# --- REST Endpoints ---

@app.get("/")
async def root():
    return {
        "service": "WildfireOS Backend",
        "status": "online",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/analyze", response_model=FireAnalysisResponse)
async def analyze_fire(request: FireAnalysisRequest):
    """
    Main analysis endpoint.
    Accepts current fire conditions and returns AI-generated insights.
    """
    # Get historical context
    current_conditions = {
        "wind": request.wind_data,
        "environment": request.environment_data,
        "infrastructure": request.infrastructure_data,
    }

    history_summary = await historical_memory.get_geographical_summary(current_conditions)

    # Status tracker for monitoring agent progress
    status_tracker = {
        "graph_physics": "idle",
        "level_1_agents": "idle",
        "level_2_agents": "idle",
        "validation": "idle"
    }

    # Execute multi-agent analysis
    result = await execute_agent_graph(
        live_graph=request.live_graph,
        wind_data=request.wind_data,
        environment_data=request.environment_data,
        infrastructure_data=request.infrastructure_data,
        history_summary=history_summary,
        previous_rec=request.previous_recommendation,
        status_tracker=status_tracker
    )

    return FireAnalysisResponse(
        notifications=result["notifications"],
        recommendation=result["recommendation"],
        computed_physics=result["computed_physics"],
        history_summary=history_summary
    )

# --- WebSocket for Real-Time Updates ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for streaming real-time fire analysis.
    Frontend can connect here to receive live updates as agents process data.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Receive fire data from frontend
            data = await websocket.receive_json()

            # Get historical context
            current_conditions = {
                "wind": data.get("wind_data", {}),
                "environment": data.get("environment_data", {}),
                "infrastructure": data.get("infrastructure_data", {}),
            }

            history_summary = await historical_memory.get_geographical_summary(current_conditions)

            # Status tracker for real-time updates
            status_tracker = {
                "graph_physics": "idle",
                "level_1_agents": "idle",
                "level_2_agents": "idle",
                "validation": "idle"
            }

            # Send status updates as agents work
            async def send_status_updates():
                last_status = {}
                while True:
                    if status_tracker != last_status:
                        await websocket.send_json({
                            "type": "status_update",
                            "status": status_tracker.copy()
                        })
                        last_status = status_tracker.copy()
                    await asyncio.sleep(0.1)

                    # Stop when validation is complete
                    if status_tracker.get("validation") in ["complete", "error"]:
                        break

            # Run status updates in background
            status_task = asyncio.create_task(send_status_updates())

            # Execute analysis
            result = await execute_agent_graph(
                live_graph=data.get("live_graph", {}),
                wind_data=data.get("wind_data", {}),
                environment_data=data.get("environment_data", {}),
                infrastructure_data=data.get("infrastructure_data", {}),
                history_summary=history_summary,
                previous_rec=data.get("previous_recommendation"),
                status_tracker=status_tracker
            )

            # Wait for status task to finish
            await status_task

            # Send final results
            await websocket.send_json({
                "type": "analysis_complete",
                "data": {
                    "notifications": result["notifications"],
                    "recommendation": result["recommendation"],
                    "computed_physics": result["computed_physics"],
                    "history_summary": history_summary
                }
            })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        manager.disconnect(websocket)

# --- Run Server ---

if __name__ == "__main__":
    import uvicorn
    print("🔥 WildfireOS Backend Starting...")
    print("📍 API: http://localhost:8000")
    print("📍 Docs: http://localhost:8000/docs")
    print("🔌 WebSocket: ws://localhost:8000/ws")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
