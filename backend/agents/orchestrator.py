import asyncio
import os
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

load_dotenv()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL_NAME = "gpt-4o-2024-08-06"
MAX_RETRIES = 2

# --- DATA CONTRACTS ---

class FireAnalysis(BaseModel):
    behavior_summary: str = Field(description="Analysis of wind, slope, vegetation, and spread.")
    spread_direction: str
    spread_velocity_assessment: str = Field(description="Reference 'effective_velocity_multiplier'.")

class RiskAnalysis(BaseModel):
    threat_level: str = Field(description="Strictly: LOW, ELEVATED, or CRITICAL.")
    vulnerable_targets: list[str] = Field(description="List specific towns or fire lines at risk.")

class NotificationItem(BaseModel):
    headline: str
    explanation: str = Field(description="Exactly two sentences explaining the alert.")

class AgentNotifications(BaseModel):
    alerts: list[NotificationItem] = Field(description="Exactly 3 notifications.")

class AgentRecommendation(BaseModel):
    consideration: str = Field(description="Top tactical consideration for command.")
    rationale: str = Field(description="Explanation citing explicit physical variables.")
    confidence_score: int = Field(description="0-100 score of plan viability.")

# --- DETERMINISTIC GRAPH LOGIC ---

def process_live_graph(
    live_graph: dict[str, Any],
    wind_data: dict[str, Any],
    environment_data: dict[str, Any],
    infrastructure_data: dict[str, Any]
) -> dict[str, Any]:
    print("[Graph Logic] Translating input graph into physics...")

    step = max(1, live_graph.get("step", 1))
    total_burning = live_graph.get("total_burning", 0)
    total_burned = live_graph.get("total_burned", 0)

    wind_speed = wind_data.get("speed", 0)
    slope = environment_data.get("slope", 0)
    vegetation = environment_data.get("terrain_vegetation", "unknown").lower()
    towns = infrastructure_data.get("nearby_towns", [])

    base_spread_velocity = round(total_burning / step, 2)

    velocity_multiplier = 1.0
    if slope > 20:
        velocity_multiplier += 0.5
    if vegetation in ["chaparral", "brush", "timber"]:
        velocity_multiplier += 0.3

    effective_spread_velocity = round(base_spread_velocity * velocity_multiplier, 2)

    baseline_threat = "LOW"
    critical_exposures = []

    for town in towns:
        distance = town.get("distance_km", 99)
        if distance < 5.0:
            critical_exposures.append(f"{town.get('name')} is {distance}km away.")
            baseline_threat = "CRITICAL"
        elif distance < 15.0 and baseline_threat != "CRITICAL":
            baseline_threat = "ELEVATED"

    if effective_spread_velocity > 15.0 or (wind_speed > 30 and slope > 15):
        baseline_threat = "CRITICAL"

    return {
        "raw_stats": {
            "step": step,
            "active_fire_cells": total_burning,
            "total_destroyed_cells": total_burned
        },
        "computed_physics": {
            "base_spread_velocity": base_spread_velocity,
            "effective_velocity_multiplier": velocity_multiplier,
            "effective_spread_velocity": effective_spread_velocity,
            "deterministic_baseline_threat": baseline_threat,
            "critical_exposures_identified": critical_exposures
        }
    }

# --- CLOSED-LOOP VALIDATOR ---

def validate_agent_reasoning(
    processed_graph: dict[str, Any],
    risk_data: RiskAnalysis,
    rec_data: AgentRecommendation
) -> list[str]:
    errors: list[str] = []
    physics = processed_graph["computed_physics"]

    if physics["deterministic_baseline_threat"] == "CRITICAL" and risk_data.threat_level != "CRITICAL":
        errors.append(
            f"Physics Violation: Deterministic math calculates a CRITICAL threat "
            f"but you output '{risk_data.threat_level}'. You MUST escalate."
        )

    # MINIMAL FIX: compare town names, not full "X is Ykm away." strings
    exposures = physics["critical_exposures_identified"]
    if exposures:
        exposure_names = []
        for e in exposures:
            name = e.split(" is ")[0].strip()
            if name:
                exposure_names.append(name)

        if exposure_names and not any(name in risk_data.vulnerable_targets for name in exposure_names):
            errors.append("Logic Violation: You failed to mention critical exposure town(s) in your vulnerable targets.")

    return errors

# --- AGENT FUNCTIONS ---

async def _run_fire_agent(processed_graph: dict[str, Any], history_summary: str) -> FireAnalysis:
    completion = await client.beta.chat.completions.parse(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are the Fire Behavior Agent. Rely strictly on the 'computed_physics' provided."},
            {"role": "user", "content": f"PROCESSED GRAPH: {processed_graph}\nHISTORY: {history_summary}"}
        ],
        response_format=FireAnalysis,
    )
    return completion.choices[0].message.parsed

# MINIMAL CHANGE: add feedback so RiskAgent can fix violations
async def _run_risk_agent(processed_graph: dict[str, Any], history_summary: str, feedback: str = "") -> RiskAnalysis:
    feedback_context = f"\nVALIDATOR FEEDBACK: {feedback}\nYou MUST fix this." if feedback else ""
    completion = await client.beta.chat.completions.parse(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You assess infrastructure threats. Do not contradict the 'deterministic_baseline_threat'."},
            {"role": "user", "content": f"PROCESSED GRAPH: {processed_graph}\nHISTORY: {history_summary}{feedback_context}"}
        ],
        response_format=RiskAnalysis,
    )
    return completion.choices[0].message.parsed

async def _run_notif_agent(fire_data: FireAnalysis, risk_data: RiskAnalysis) -> AgentNotifications:
    completion = await client.beta.chat.completions.parse(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "Generate 3 tactical alerts. Explanations MUST be exactly 2 sentences."},
            {"role": "user", "content": f"FIRE: {fire_data.model_dump_json()}\nRISK: {risk_data.model_dump_json()}"}
        ],
        response_format=AgentNotifications,
    )
    return completion.choices[0].message.parsed

async def _run_rec_agent(
    fire_data: FireAnalysis,
    risk_data: RiskAnalysis,
    previous_rec: dict[str, Any] | None,
    feedback: str
) -> AgentRecommendation:
    turn_context = f"PREVIOUS RECOMMENDATION: {previous_rec}. Update based on new data." if previous_rec else "Initial assessment."
    feedback_context = f"\nURGENT VALIDATOR FEEDBACK: {feedback}\nYou MUST correct these errors in this iteration." if feedback else ""

    completion = await client.beta.chat.completions.parse(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "Provide the top tactical consideration. You must strictly obey any validator feedback."},
            {"role": "user", "content": f"FIRE: {fire_data.model_dump_json()}\nRISK: {risk_data.model_dump_json()}\n\n{turn_context}{feedback_context}"}
        ],
        response_format=AgentRecommendation,
    )
    return completion.choices[0].message.parsed

# --- MAIN EXPORT FUNCTION ---

async def execute_agent_graph(
    live_graph: dict[str, Any],
    wind_data: dict[str, Any],
    environment_data: dict[str, Any],
    infrastructure_data: dict[str, Any],
    history_summary: str,
    previous_rec: dict[str, Any] | None,
    status_tracker: dict[str, str]
) -> dict[str, Any]:
    """
    The main entry point for the Multi-Agent engine.
    Other modules in the backend should call this function.
    """
    print("[Orchestrator] Executing Multi-Agent Graph...")

    status_tracker["graph_physics"] = "running"
    await asyncio.sleep(0.5)
    processed_graph = process_live_graph(live_graph, wind_data, environment_data, infrastructure_data)
    status_tracker["graph_physics"] = "complete"

    attempts = 0
    validator_feedback = ""
    current_previous_rec = previous_rec  # MINIMAL: update across retries

    # MINIMAL FIX: keep semantics "2 retries after first attempt"
    while attempts < (MAX_RETRIES + 1):
        status_tracker["level_1_agents"] = "running"
        fire_result, risk_result = await asyncio.gather(
            _run_fire_agent(processed_graph, history_summary),
            _run_risk_agent(processed_graph, history_summary, validator_feedback)  # pass feedback
        )
        status_tracker["level_1_agents"] = "complete"

        status_tracker["level_2_agents"] = "running"
        notif_result, rec_result = await asyncio.gather(
            _run_notif_agent(fire_result, risk_result),
            _run_rec_agent(fire_result, risk_result, current_previous_rec, validator_feedback)  # use updated prev
        )
        status_tracker["level_2_agents"] = "complete"

        status_tracker["validation"] = "running"
        await asyncio.sleep(0.5)
        print(f"[Validator] Checking AI output against physics (Attempt {attempts + 1})...")
        errors = validate_agent_reasoning(processed_graph, risk_result, rec_result)

        if not errors:
            status_tracker["validation"] = "complete"
            print("[Orchestrator] Plan validated. Execution Complete.")
            return {
                "notifications": notif_result.model_dump()["alerts"],
                "recommendation": rec_result.model_dump(),
                "computed_physics": processed_graph["computed_physics"]
            }

        print("[Validator] Logic violations found. Forcing replan...")
        status_tracker["validation"] = "error"
        status_tracker["level_1_agents"] = "idle"
        status_tracker["level_2_agents"] = "idle"

        validator_feedback = " | ".join(errors)
        current_previous_rec = rec_result.model_dump()  # MINIMAL: update for next attempt
        attempts += 1

    status_tracker["validation"] = "error"
    return {
        "notifications": [{"headline": "System Alert", "explanation": "Agent validation failed. Reverting to manual command."}],
        "recommendation": {"consideration": "Manual Override Required", "rationale": "Physics constraints violated.", "confidence_score": 0},
        "computed_physics": processed_graph["computed_physics"]
    }