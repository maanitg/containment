def process_radio_transcript() -> dict:
    transcript = "Winds shifting east. Gusts increasing to 25 mph."
    return {
        "transcript": transcript,
        "wind_direction": "E",
        "wind_speed": 25,
    }
