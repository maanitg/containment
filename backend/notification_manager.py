"""
Notification Manager - Stores and manages agent-generated notifications
"""
from datetime import datetime
from typing import Any
import asyncio
import json
import os
from agents.orchestrator import execute_agent_graph
from agents.historical_memory import HistoricalMemory

def get_fire_metadata() -> dict:
    """Get current fire name and location"""
    try:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        fire_perimeter_path = os.path.join(data_dir, "fire_perimeter.json")
        with open(fire_perimeter_path, 'r', encoding='utf-8') as f:
            fire_perimeter = json.load(f)
        if fire_perimeter and "currentFire" in fire_perimeter:
            current_fire = fire_perimeter["currentFire"]
            center = current_fire.get("center", [39.52, -121.05])
            # Determine region from coordinates (simplified - lat, lon)
            lat, lon = center[0], center[1]
            if 39.0 <= lat <= 40.5 and -122.0 <= lon <= -120.0:
                region = "Northern California"
            elif 38.0 <= lat <= 39.0:
                region = "Central California"
            else:
                region = "California"
            return {
                "name": current_fire.get("name", "Unknown Fire"),
                "location": region,
                "coordinates": center
            }
    except Exception as e:
        print(f"WARNING: Could not load fire metadata: {e}")

    # Default fallback
    return {
        "name": "Cedar Ridge Fire",
        "location": "Northern California",
        "coordinates": [39.52, -121.05]
    }

class NotificationManager:
    def __init__(self):
        self.notifications = []
        self.recommendations = []
        self.notification_counter = 0
        self.historical_memory = HistoricalMemory()
        self.fire_metadata = get_fire_metadata()

    async def process_timestamped_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Process timestamped data through agents and generate notifications"""

        # Extract data from timestamped file
        live_graph = data.get("live_graph", {})
        wind_data = data.get("wind_data", {})
        environment_data = data.get("environment_data", {})
        infrastructure_data = data.get("infrastructure_data", {})
        timestamp = data.get("timestamp")
        time_label = data.get("time_label", "Unknown")

        # Get historical context (include fire location for geographic matching)
        current_conditions = {
            "fire_name": self.fire_metadata["name"],
            "location": self.fire_metadata["location"],
            "wind": wind_data,
            "environment": environment_data,
            "infrastructure": infrastructure_data,
        }

        history_summary = await self.historical_memory.get_geographical_summary(current_conditions)

        # Get previous recommendation if available
        previous_rec = self.recommendations[-1] if self.recommendations else None

        # Status tracker for monitoring
        status_tracker = {
            "graph_physics": "idle",
            "level_1_agents": "idle",
            "level_2_agents": "idle",
            "validation": "idle"
        }

        # Execute agent graph
        result = await execute_agent_graph(
            live_graph=live_graph,
            wind_data=wind_data,
            environment_data=environment_data,
            infrastructure_data=infrastructure_data,
            history_summary=history_summary,
            previous_rec=previous_rec,
            status_tracker=status_tracker
        )

        # Store notifications with metadata
        agent_notifications = result.get("notifications", [])
        print(f"[Notification Manager] Processing {time_label}: received {len(agent_notifications)} notifications from agents")
        for notif in agent_notifications:
            self.notification_counter += 1
            fact_text = notif.get("fact", "")
            notification_obj = {
                "id": self.notification_counter,
                "timestamp": timestamp or datetime.utcnow().isoformat(),
                "time_label": time_label,
                "fact": fact_text,
                "urgency": self._infer_urgency(fact_text),
                "source": "agent",
                "data_step": live_graph.get("step", 0)
            }
            self.notifications.append(notification_obj)
            print(f"  → Notification #{self.notification_counter}: {fact_text[:50]}...")

        print(f"[Notification Manager] Total notifications stored: {len(self.notifications)}")

        # Store recommendation with metadata
        recommendation = result.get("recommendation", {})
        recommendation["timestamp"] = timestamp or datetime.utcnow().isoformat()
        recommendation["time_label"] = time_label
        recommendation["data_step"] = live_graph.get("step", 0)
        self.recommendations.append(recommendation)
        print(f"[Notification Manager] Stored recommendation for {time_label}")

        return {
            "notifications": agent_notifications,
            "recommendation": recommendation,
            "computed_physics": result.get("computed_physics", {})
        }

    def _infer_urgency(self, fact: str) -> str:
        """Infer urgency level from notification fact"""
        fact_lower = fact.lower()
        if any(word in fact_lower for word in ["critical", "immediate", "emergency", "evacuation", "approaching", "reaching"]):
            return "critical"
        elif any(word in fact_lower for word in ["warning", "caution", "elevated", "increasing", "ahead"]):
            return "warning"
        else:
            return "info"

    def get_notifications(self, limit: int = None, offset: int = 0) -> list[dict[str, Any]]:
        """Get notifications, newest first"""
        # Sort by ID descending (newest first)
        sorted_notifications = sorted(self.notifications, key=lambda x: x["id"], reverse=True)

        if limit:
            return sorted_notifications[offset:offset + limit]
        return sorted_notifications[offset:]

    def get_latest_recommendation(self) -> dict[str, Any] | None:
        """Get the most recent recommendation"""
        if self.recommendations:
            return self.recommendations[-1]
        return None

    def get_all_recommendations(self) -> list[dict[str, Any]]:
        """Get all recommendations"""
        return self.recommendations

    def clear_all(self):
        """Clear all stored notifications and recommendations"""
        self.notifications = []
        self.recommendations = []
        self.notification_counter = 0

# Global instance
notification_manager = NotificationManager()
