import os
import csv
import random
import numpy as np
import pandas as pd

SAMPLE_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ics209_sample.csv")

FUEL_TYPES = ["grass", "chaparral", "timber", "brush", "mixed_conifer"]

FUEL_TYPE_INDEX = {f: i for i, f in enumerate(FUEL_TYPES)}


def generate_sample_data():
    random.seed(42)
    rows = []
    fire_names = [
        "Cedar Creek", "Pine Ridge", "Elk Mountain", "Bear Valley", "Hawk Peak",
        "Canyon Bluff", "Silver Lake", "Iron Ridge", "Copper Basin", "Eagle Nest",
        "Storm King", "Granite Falls", "Shadow Creek", "Dusty Mesa", "Timber Gulch",
        "Red Rock", "Blue Ridge", "Wind River", "Crystal Peak", "Thunder Basin",
    ]
    for i, name in enumerate(fire_names):
        wind_speed = random.randint(5, 45)
        humidity = random.randint(5, 60)
        slope = random.randint(0, 40)
        fuel_type = FUEL_TYPES[i % len(FUEL_TYPES)]
        failure = 1 if (wind_speed > 25 and humidity < 20) or (slope > 30 and wind_speed > 20) else 0
        acres = random.randint(500, 15000) if failure else random.randint(50, 2000)
        rows.append({
            "fire_name": name,
            "fuel_type": fuel_type,
            "wind_speed": wind_speed,
            "humidity": humidity,
            "slope": slope,
            "containment_failure": failure,
            "acres_burned": acres,
        })

    os.makedirs(os.path.dirname(SAMPLE_DATA_PATH), exist_ok=True)
    with open(SAMPLE_DATA_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return pd.DataFrame(rows)


def _row_to_vector(row) -> np.ndarray:
    return np.array([
        float(row["wind_speed"]) / 45.0,
        float(row["humidity"]) / 60.0,
        float(row["slope"]) / 40.0,
        float(FUEL_TYPE_INDEX.get(row["fuel_type"], 0)) / 4.0,
    ], dtype="float32")


class HistoricalMemory:
    def __init__(self):
        if os.path.exists(SAMPLE_DATA_PATH):
            self.df = pd.read_csv(SAMPLE_DATA_PATH)
        else:
            self.df = generate_sample_data()

        self.vectors: np.ndarray | None = None

    def build_index(self):
        vecs = []
        for _, row in self.df.iterrows():
            vecs.append(_row_to_vector(row))
        self.vectors = np.array(vecs, dtype="float32")

    def query_similar(self, current_conditions: dict) -> dict:
        query = np.array([
            float(current_conditions.get("wind_speed", 10)) / 45.0,
            float(current_conditions.get("humidity", 30)) / 60.0,
            float(current_conditions.get("slope", 10)) / 40.0,
            float(FUEL_TYPE_INDEX.get(current_conditions.get("fuel_type", "chaparral"), 0)) / 4.0,
        ], dtype="float32")

        distances = np.linalg.norm(self.vectors - query, axis=1)
        top3_idx = np.argsort(distances)[:3]

        similar = self.df.iloc[top3_idx]
        names = similar["fire_name"].tolist()
        failure_prob = float(similar["containment_failure"].mean())
        avg_acres = float(similar["acres_burned"].mean())

        return {
            "similar_fires": names,
            "failure_probability": round(failure_prob, 2),
            "avg_acres_burned": round(avg_acres, 1),
        }
