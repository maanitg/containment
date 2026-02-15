"""
Notification Manager - Stores and manages agent-generated notifications
"""
from datetime import datetime
from typing import Any
import asyncio
from agents.orchestrator import execute_agent_graph
from agents.historical_memory import HistoricalMemory

class NotificationManager:
    def __init__(self):
        self.notifications = []
        self.recommendations = []
        self.notification_counter = 0
        self.historical_memory = HistoricalMemory()

    async def process_timestamped_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Process timestamped data through agents and generate notifications"""

        # Extract data from timestamped file
        live_graph = data.get("live_graph", {})
        wind_data = data.get("wind_data", {})
        environment_data = data.get("environment_data", {})
        infrastructure_data = data.get("infrastructure_data", {})
        timestamp = data.get("timestamp")
        time_label = data.get("time_label", "Unknown")

        # Get historical context
        current_conditions = {
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

        print(f"[Notification Manager] Stored {len(agent_notifications)} notifications. Total: {len(self.notifications)}")

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
