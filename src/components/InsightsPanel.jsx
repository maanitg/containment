import { useState, useEffect, useRef } from "react";
import { currentFire, wind } from "../data/firePerimeter";
import { fuelTypes } from "../data/terrain";
import {
  communities,
  firebreaks,
  waterResources,
} from "../data/infrastructure";
import { historicalFires } from "../data/historicalFires";

// Calculate distance between two lat/lng points in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get the "leading edge" of the fire in wind direction
function getFireFront() {
  const coords = currentFire.perimeter.geometry.coordinates[0];
  const windRad = (wind.direction * Math.PI) / 180;
  let maxProj = -Infinity;
  let frontPoint = coords[0];
  for (const c of coords) {
    const proj = c[1] * Math.cos(windRad) + c[0] * Math.sin(windRad);
    if (proj > maxProj) {
      maxProj = proj;
      frontPoint = c;
    }
  }
  return { lat: frontPoint[1], lng: frontPoint[0] };
}

// Generate insights from data
function generateLocalInsights() {
  const fireFront = getFireFront();
  const insights = [];

  // Critical proximities - communities
  const commDistances = communities
    .map((c) => ({
      ...c,
      distance: distanceMiles(
        fireFront.lat,
        fireFront.lng,
        c.lat,
        c.lng
      ),
      directionFromFire: getCardinalDirection(
        fireFront.lat,
        fireFront.lng,
        c.lat,
        c.lng
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  for (const comm of commDistances.slice(0, 3)) {
    const urgency = comm.distance < 2 ? "critical" : comm.distance < 5 ? "warning" : "info";
    let text = `${comm.name} (pop. ${comm.population.toLocaleString()}) is ${comm.distance.toFixed(1)} mi ${comm.directionFromFire}`;
    if (comm.evacuationStatus === "Order") {
      text += " - EVACUATION ORDER ACTIVE";
    } else if (comm.evacuationStatus === "Warning") {
      text += " - evacuation warning issued";
    }
    if (comm.accessRoads.length === 1) {
      text += ` (single access: ${comm.accessRoads[0]})`;
    }
    insights.push({ category: "proximity", urgency, text });
  }

  // Firebreak proximities
  for (const fb of firebreaks) {
    const fbCoords = fb.geometry.geometry.coordinates;
    let minDist = Infinity;
    for (const c of fbCoords) {
      const d = distanceMiles(fireFront.lat, fireFront.lng, c[1], c[0]);
      if (d < minDist) minDist = d;
    }
    if (minDist < 3) {
      const urgency = minDist < 1 ? "critical" : "warning";
      insights.push({
        category: "firebreak",
        urgency,
        text: `Fire is ${minDist.toFixed(1)} mi from ${fb.name} (${fb.width}ft wide, ${fb.type.toLowerCase()}, maintained ${fb.lastMaintained}) - ${fb.condition}`,
      });
    }
  }

  // Terrain ahead analysis
  const windRad = (wind.direction * Math.PI) / 180;
  for (const fuel of fuelTypes) {
    const centroid = getCentroid(fuel.geometry.coordinates[0]);
    const dist = distanceMiles(fireFront.lat, fireFront.lng, centroid[1], centroid[0]);
    // Check if fuel zone is ahead (in wind direction)
    const dLat = centroid[1] - fireFront.lat;
    const dLng = centroid[0] - fireFront.lng;
    const angle = Math.atan2(dLng, dLat);
    const angleDiff = Math.abs(angle - windRad);
    if (angleDiff < Math.PI / 3 && dist < 4) {
      const urgency = fuel.properties.fuelType === "dead_timber" ? "critical" : "warning";
      insights.push({
        category: "terrain",
        urgency,
        text: `${fuel.properties.label} zone ${dist.toFixed(1)} mi ahead in fire's path - ${fuel.properties.fireRate.toLowerCase()}`,
      });
    }
  }

  // Water resources
  const nearbyWater = waterResources
    .filter((w) => w.lat)
    .map((w) => ({
      ...w,
      distance: distanceMiles(fireFront.lat, fireFront.lng, w.lat, w.lng),
    }))
    .filter((w) => w.distance < 5)
    .sort((a, b) => a.distance - b.distance);

  for (const water of nearbyWater.slice(0, 2)) {
    insights.push({
      category: "resource",
      urgency: "info",
      text: `${water.name} (${water.type}) ${water.distance.toFixed(1)} mi away${water.dippable ? " - helicopter dip-capable" : ""}`,
    });
  }

  // Historical analogues
  for (const fire of historicalFires) {
    const centroid = getCentroid(fire.perimeter.geometry.coordinates[0]);
    const dist = distanceMiles(
      currentFire.center[0],
      currentFire.center[1],
      centroid[1],
      centroid[0]
    );
    insights.push({
      category: "historical",
      urgency: "info",
      text: `${fire.name} (${fire.year}) - ${fire.acres.toLocaleString()} acres, contained in ${fire.containedInDays} days. ${fire.keyLesson}`,
    });
  }

  return insights;
}

function getCentroid(coords) {
  let latSum = 0,
    lngSum = 0;
  for (const c of coords) {
    lngSum += c[0];
    latSum += c[1];
  }
  return [lngSum / coords.length, latSum / coords.length];
}

function getCardinalDirection(fromLat, fromLng, toLat, toLng) {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((angle + 360) % 360) / 45) % 8;
  return dirs[idx];
}

// Generate LLM-style insights (mock Claude API response)
function generateLLMInsights(localInsights) {
  // In production, this would call Claude API with the context
  // For now, we synthesize tactical intelligence from the data
  const llmInsights = [
    {
      urgency: "critical",
      text: "IMMEDIATE CONCERN: Fire's active front is advancing NE toward the dead timber zone (60% mortality). The 2015 Eagle Complex fire showed this zone produces extreme fire behavior with spotting distances up to 1 mile. Recommend pre-positioning resources on Timber Ridge fuel break.",
    },
    {
      urgency: "critical",
      text: `Ridgeview (pop. 180) has SINGLE ACCESS via Ridge Rd and is under evacuation order. In the 2015 Eagle Complex, evacuation took 8 hours. With current wind from ${wind.directionLabel} at ${wind.speed}mph (gusts ${wind.gusts}mph), fire could reach Ridgeview in 3-5 hours.`,
    },
    {
      urgency: "warning",
      text: "Johnson Creek fuel break (200ft, maintained 2023) is the strongest containment option on the NE flank. The 2020 Pine Creek Fire was held here. Recommend reinforcing with hand crews before fire arrival.",
    },
    {
      urgency: "warning",
      text: `Wind shift forecast: ${wind.forecastChange}. A westerly shift would push fire directly toward Pinecrest (pop. 450, evacuation warning). Recommend staging structure protection now.`,
    },
    {
      urgency: "info",
      text: "Miller Road dozer line (from 2018 Basin Fire) is degraded with partial regrowth. It held the Basin Fire's west flank but would need reconstruction to be effective. Dozer access via Hwy 89 is open.",
    },
    {
      urgency: "info",
      text: "Summit Lake and Cedar Reservoir are both helicopter-accessible for bucket operations. Summit Lake offers better approach for drops on the northeast flank near Timber Ridge.",
    },
    {
      urgency: "info",
      text: "Timber Ridge fuel reduction project (2022, 300ft wide, prescribed burn + thinning) above Pinecrest provides a strong anchor point. Basin Fire and Pine Creek Fire both leveraged this ridge for containment operations.",
    },
  ];
  return llmInsights;
}

const urgencyStyles = {
  critical: {
    border: "#dc2626",
    bg: "#fef2f2",
    icon: "!!",
    iconBg: "#dc2626",
  },
  warning: {
    border: "#f59e0b",
    bg: "#fffbeb",
    icon: "!",
    iconBg: "#f59e0b",
  },
  info: {
    border: "#6b7280",
    bg: "#f9fafb",
    icon: "i",
    iconBg: "#6b7280",
  },
};

const categoryLabels = {
  proximity: "Community Proximity",
  firebreak: "Firebreak Status",
  terrain: "Terrain Ahead",
  resource: "Water Resources",
  historical: "Historical Fire",
};

export default function InsightsPanel() {
  const [llmInsights, setLlmInsights] = useState([]);
  const [localInsights, setLocalInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Simulate loading
    setLoading(true);
    const local = generateLocalInsights();
    setLocalInsights(local);

    const timer = setTimeout(() => {
      const llm = generateLLMInsights(local);
      setLlmInsights(llm);
      setLoading(false);
      setLastUpdate(new Date());
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="insights-panel">
      {/* Header */}
      <div className="insights-header">
        <div className="insights-title">
          <div className="fire-icon">&#x1F525;</div>
          <div>
            <h1>{currentFire.name}</h1>
            <div className="fire-meta">
              {currentFire.acresBurned.toLocaleString()} acres &bull;{" "}
              {currentFire.containment}% contained
            </div>
          </div>
        </div>
        <div className="wind-badge">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 2v20M5 9l7-7 7 7" />
          </svg>
          <span style={{ transform: `rotate(${wind.direction}deg)`, display: "inline-block" }}>
            &#8593;
          </span>
          Wind {wind.directionLabel} {wind.speed}mph (G{wind.gusts})
        </div>
      </div>

      {/* Scrollable content */}
      <div className="insights-scroll">
        {/* Tactical Intelligence Section */}
        <div className="insights-group">
          <h2 className="section-title">
            <span className="section-icon">&#9888;</span>
            Tactical Intelligence
          </h2>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Analyzing situation...</span>
            </div>
          ) : (
            <div className="insights-list">
              {llmInsights.map((insight, i) => {
                const style = urgencyStyles[insight.urgency];
                return (
                  <div
                    key={i}
                    className="insight-card"
                    style={{
                      borderLeftColor: style.border,
                      backgroundColor: style.bg,
                    }}
                  >
                    <div
                      className="insight-badge"
                      style={{ backgroundColor: style.iconBg }}
                    >
                      {style.icon}
                    </div>
                    <p>{insight.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Situational Data Section */}
        <div className="insights-group">
          <h2 className="section-title">
            <span className="section-icon">&#128205;</span>
            Situational Data
          </h2>
          <div className="insights-list">
            {localInsights.map((insight, i) => {
              const style = urgencyStyles[insight.urgency];
              return (
                <div
                  key={i}
                  className="insight-card compact"
                  style={{
                    borderLeftColor: style.border,
                    backgroundColor: style.bg,
                  }}
                >
                  <span className="category-tag">
                    {categoryLabels[insight.category] || insight.category}
                  </span>
                  <p>{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="insights-footer">
        {lastUpdate && (
          <span>
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
        <span className="footer-note">
          Intelligence auto-updates with map view
        </span>
      </div>
    </div>
  );
}
