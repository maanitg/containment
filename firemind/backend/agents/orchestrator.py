def run_orchestrator(
    fire_data: dict,
    wind_data: dict,
    historical_data: dict,
) -> dict:
    burning = fire_data.get("total_burning", 0)
    burned = fire_data.get("total_burned", 0)
    step = fire_data.get("step", 0)
    wind_speed = wind_data.get("speed", 10)
    failure_prob = historical_data.get("failure_probability", 0.0)

    spread_velocity = burning / max(step, 1)

    if burned > 800 or (wind_speed >= 25 and burning > 30):
        escape_probability = min(0.95, 0.7 + failure_prob * 0.3)
        time_to_impact = max(10, 45 - step)
        confidence = 0.9
        recommendation = (
            "IMMEDIATE EVACUATION. Fire has exceeded containment capacity. "
            "Deploy all available air resources to protect structures. "
            "Establish evacuation corridors on north and west flanks."
        )
        reasoning = (
            f"Fire has burned {burned} cells with {burning} actively burning. "
            f"Spread velocity of {spread_velocity:.1f} cells/step exceeds safe thresholds. "
            f"Wind speed at {wind_speed} mph is driving rapid eastward expansion. "
            f"Historical analogs show {failure_prob*100:.0f}% containment failure rate under similar conditions. "
            "Probability of escape is critical. Recommend full evacuation posture."
        )
    elif burned > 300 or wind_speed >= 20:
        escape_probability = min(0.8, 0.4 + failure_prob * 0.3 + (wind_speed / 50.0) * 0.2)
        time_to_impact = max(20, 90 - step * 2)
        confidence = 0.75
        recommendation = (
            "ESCALATE to Type 1 incident. Request additional strike teams. "
            "Pre-position evacuation assets. Establish safety zones on south flank. "
            "Consider tactical firing operations on northeast perimeter."
        )
        reasoning = (
            f"Fire is growing aggressively with {burning} active cells and {burned} total burned. "
            f"Spread velocity at {spread_velocity:.1f} cells/step indicates acceleration. "
            f"Wind conditions ({wind_data.get('direction', 'N')} at {wind_speed} mph) "
            f"are unfavorable for containment. "
            f"Analog fires averaged {historical_data.get('avg_acres_burned', 0):.0f} acres. "
            "Situation trending toward loss of containment."
        )
    elif burned > 100 or burning > 15:
        escape_probability = 0.3 + failure_prob * 0.2
        time_to_impact = max(40, 120 - step * 2)
        confidence = 0.65
        recommendation = (
            "Reinforce containment lines on downwind flank. "
            "Deploy additional hand crews to construct fireline. "
            "Monitor for spot fires beyond perimeter. Maintain current suppression posture."
        )
        reasoning = (
            f"Fire perimeter expanding with {burning} burning cells. "
            f"Total area affected: {burned} cells. "
            f"Current wind ({wind_data.get('direction', 'N')} at {wind_speed} mph) "
            f"is pushing fire but within manageable parameters. "
            f"Historical failure probability at {failure_prob*100:.0f}%. "
            "Containment is achievable if resources are applied promptly."
        )
    else:
        escape_probability = max(0.05, 0.1 + failure_prob * 0.1)
        time_to_impact = 180
        confidence = 0.8
        recommendation = (
            "Maintain initial attack posture. Continue direct attack on head of fire. "
            "Monitor wind conditions for potential shift. "
            "Keep one engine company in reserve for spot fire response."
        )
        reasoning = (
            f"Fire is in early stages with {burning} active cells and {burned} burned. "
            f"Spread velocity of {spread_velocity:.1f} cells/step is within initial attack capability. "
            f"Wind conditions are moderate ({wind_data.get('direction', 'N')} at {wind_speed} mph). "
            "No immediate threat to structures. Standard initial attack protocol is appropriate."
        )

    return {
        "escape_probability": round(escape_probability, 2),
        "time_to_impact_minutes": time_to_impact,
        "recommendation": recommendation,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
    }
