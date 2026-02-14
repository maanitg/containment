import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from agents.fire_simulation import FireSimulation
from agents.historical_memory import HistoricalMemory
from agents.audio_ingest import process_radio_transcript
from agents.orchestrator import run_orchestrator

load_dotenv()

fire_sim = FireSimulation(seed=42)
historical_memory = HistoricalMemory()

wind_state = {"direction": "N", "speed": 10}

tick_interval = {"seconds": 5.0}

connected_clients: list[WebSocket] = []

simulation_task = None


async def broadcast(data: dict):
    message = json.dumps(data)
    disconnected = []
    for ws in connected_clients:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        connected_clients.remove(ws)


async def simulation_loop():
    while True:
        fire_data = fire_sim.step_simulation()

        current_conditions = {
            "wind_speed": wind_state["speed"],
            "humidity": 25,
            "slope": 15,
            "fuel_type": "chaparral",
        }

        try:
            historical_data = historical_memory.query_similar(current_conditions)
        except Exception as e:
            historical_data = {
                "similar_fires": [],
                "failure_probability": 0.0,
                "avg_acres_burned": 0.0,
            }
            print(f"Historical memory error: {e}")

        try:
            analysis = run_orchestrator(
                fire_data=fire_data,
                wind_data=wind_state,
                historical_data=historical_data,
            )
        except Exception as e:
            analysis = {
                "escape_probability": 0.0,
                "time_to_impact_minutes": 0,
                "recommendation": f"Analysis unavailable: {e}",
                "confidence": 0.0,
                "reasoning": "Orchestrator error.",
            }
            print(f"Orchestrator error: {e}")

        payload = {
            "fire": {
                "burning_cells": fire_data["burning_cells"],
                "perimeter_polygon": fire_data["perimeter_polygon"],
                "total_burning": fire_data["total_burning"],
                "total_burned": fire_data["total_burned"],
                "step": fire_data["step"],
            },
            "wind": wind_state,
            "analysis": analysis,
            "historical": historical_data,
        }

        await broadcast(payload)
        await asyncio.sleep(tick_interval["seconds"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    global simulation_task
    print("Building historical memory index...")
    historical_memory.build_index()
    print("Historical memory index ready.")
    simulation_task = asyncio.create_task(simulation_loop())
    yield
    simulation_task.cancel()
    try:
        await simulation_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="FireMind", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(ws)


@app.post("/trigger-wind-shift")
async def trigger_wind_shift():
    result = process_radio_transcript()
    wind_state["direction"] = result["wind_direction"]
    wind_state["speed"] = result["wind_speed"]
    fire_sim.set_wind(result["wind_direction"], result["wind_speed"])
    return {
        "status": "Wind shift applied",
        "transcript": result["transcript"],
        "wind": wind_state,
    }


@app.post("/set-speed")
async def set_speed(body: dict):
    interval = body.get("interval", 5.0)
    tick_interval["seconds"] = max(0.2, min(10.0, float(interval)))
    return {"interval": tick_interval["seconds"]}


@app.get("/state")
async def get_state():
    return {
        "wind": wind_state,
        "grid_size": 50,
        "step": fire_sim.step_count,
        "interval": tick_interval["seconds"],
    }
