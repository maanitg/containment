import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { currentFire, wind } from "../data/firePerimeter";
import { fuelTypes, ridgeLines } from "../data/terrain";
import {
  communities,
  firebreaks,
  waterResources,
} from "../data/infrastructure";
import { historicalFires } from "../data/historicalFires";

// Calculate distance between two lat/lng points in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
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

const fireFront = getFireFront();

// Estimate hours until fire reaches a point based on wind/fuel
function estimateArrivalHours(distMiles) {
  // Rough: fire spread rate ~1-3 mph in these conditions
  const spreadRate = wind.speed > 20 ? 2.5 : wind.speed > 10 ? 1.5 : 0.8;
  return distMiles / spreadRate;
}

// Wind arrow component that renders on the map
function WindArrows() {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const arrowLayer = L.layerGroup();
    const bounds = map.getBounds();
    const latStep = (bounds.getNorth() - bounds.getSouth()) / 5;
    const lngStep = (bounds.getEast() - bounds.getWest()) / 5;

    for (let i = 1; i < 5; i++) {
      for (let j = 1; j < 5; j++) {
        const lat = bounds.getSouth() + latStep * i;
        const lng = bounds.getWest() + lngStep * j;
        const rad = (wind.direction * Math.PI) / 180;
        const len = 0.008;
        const endLat = lat + Math.cos(rad) * len;
        const endLng = lng + Math.sin(rad) * len;

        const line = L.polyline(
          [
            [lat, lng],
            [endLat, endLng],
          ],
          { color: "#1a73e8", weight: 2, opacity: 0.5 }
        );

        const headLen = 0.003;
        const angle1 = rad + Math.PI + Math.PI / 6;
        const angle2 = rad + Math.PI - Math.PI / 6;
        const head = L.polyline(
          [
            [
              endLat + Math.cos(angle1) * headLen,
              endLng + Math.sin(angle1) * headLen,
            ],
            [endLat, endLng],
            [
              endLat + Math.cos(angle2) * headLen,
              endLng + Math.sin(angle2) * headLen,
            ],
          ],
          { color: "#1a73e8", weight: 2, opacity: 0.5 }
        );

        arrowLayer.addLayer(line);
        arrowLayer.addLayer(head);
      }
    }

    arrowLayer.addTo(map);
    layerRef.current = arrowLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map]);

  return null;
}

// Custom marker icons
const communityIcon = (status) => {
  const colors = {
    Order: "#dc2626",
    Warning: "#f59e0b",
    None: "#6b7280",
  };
  return L.divIcon({
    className: "community-marker",
    html: `<div style="
      background: ${colors[status] || "#6b7280"};
      width: 12px; height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const waterIcon = L.divIcon({
  className: "water-marker",
  html: `<div style="
    background: #3b82f6;
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Generate the single most critical recommendation from all data
function getCriticalRecommendation() {
  const commDistances = communities
    .map((c) => ({
      ...c,
      distance: distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng),
      hours: estimateArrivalHours(
        distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng)
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Priority 1: Community under evac order with single access road
  const singleAccessEvac = commDistances.find(
    (c) => c.evacuationStatus === "Order" && c.accessRoads.length === 1
  );
  if (singleAccessEvac) {
    return `Verify Ridgeview evacuation complete now — single access via Ridge Rd, fire front ${singleAccessEvac.distance.toFixed(1)} mi away (~${singleAccessEvac.hours.toFixed(0)}h). Eagle Complex 2015 evacuation here took 8 hours; current window is closing.`;
  }

  // Priority 2: Community under evac warning with wind shift incoming
  const warnedComm = commDistances.find(
    (c) => c.evacuationStatus === "Warning"
  );
  if (warnedComm && wind.forecastChange) {
    return `Stage structure protection at ${warnedComm.name} (pop. ${warnedComm.population.toLocaleString()}) immediately — wind shifting W at 1800h will push fire directly toward town. Fire front is ${warnedComm.distance.toFixed(1)} mi away.`;
  }

  // Priority 3: Nearest threatened community
  const nearest = commDistances[0];
  return `Monitor ${nearest.name} — fire front is ${nearest.distance.toFixed(1)} mi away, estimated arrival in ~${nearest.hours.toFixed(0)}h at current ${wind.speed}mph ${wind.directionLabel} winds.`;
}

export const criticalRecommendation = getCriticalRecommendation();

// Find relevant historical fire for a community
function getHistoricalContext(commName) {
  for (const fire of historicalFires) {
    if (fire.keyLesson.toLowerCase().includes(commName.toLowerCase())) {
      return fire;
    }
  }
  return null;
}

// Find nearest firebreak to a community
function getNearestFirebreak(lat, lng) {
  let nearest = null;
  let minDist = Infinity;
  for (const fb of firebreaks) {
    for (const c of fb.geometry.geometry.coordinates) {
      const d = distanceMiles(lat, lng, c[1], c[0]);
      if (d < minDist) {
        minDist = d;
        nearest = fb;
      }
    }
  }
  return nearest ? { ...nearest, distance: minDist } : null;
}

export default function FireMap({ layers }) {
  const mapCenter = currentFire.center;

  return (
    <>
      {/* Fire info overlay */}
      <div className="fire-overlay">
        <div className="fire-overlay-name">{currentFire.name}</div>
        <div className="fire-overlay-stats">
          {currentFire.acresBurned.toLocaleString()} ac · {currentFire.containment}% · Wind {wind.directionLabel} {wind.speed}mph (G{wind.gusts})
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          maxZoom={17}
        />

        <WindArrows />

        {/* Fuel type zones */}
        {layers.fuel &&
          fuelTypes.map((fuel, i) => (
            <GeoJSON
              key={`fuel-${i}`}
              data={fuel}
              style={{
                fillColor: fuel.properties.color,
                fillOpacity: 0.25,
                color: fuel.properties.color,
                weight: 1,
                dashArray: "4 4",
              }}
            >
              <Popup className="popup-actionable">
                <div className="popup-header">{fuel.properties.label}</div>
                <div className="popup-stat">{fuel.properties.fireRate}</div>
                {fuel.properties.fuelType === "dead_timber" && (
                  <div className="popup-action popup-action-critical">
                    ACTION: Pre-position resources — 60% mortality produces extreme spotting up to 1 mi (Eagle Complex 2015)
                  </div>
                )}
                {fuel.properties.fuelType === "brush" && (
                  <div className="popup-action popup-action-warning">
                    ACTION: Monitor spread rate — chaparral burns fast with high intensity
                  </div>
                )}
              </Popup>
            </GeoJSON>
          ))}

        {/* Historical fire perimeters */}
        {layers.historical &&
          historicalFires.map((fire, i) => (
            <GeoJSON
              key={`hist-${i}`}
              data={fire.perimeter}
              style={{
                fillColor: "#9ca3af",
                fillOpacity: 0.1,
                color: "#6b7280",
                weight: 1.5,
                dashArray: "6 3",
              }}
            >
              <Popup className="popup-actionable">
                <div className="popup-header">{fire.name} ({fire.year})</div>
                <div className="popup-stat">{fire.acres.toLocaleString()} ac · {fire.containedInDays} days to contain</div>
                <div className="popup-data">
                  <div className="popup-data-label">Tactics Used</div>
                  <ul className="popup-tactics">
                    {fire.suppressionTactics.map((t, j) => (
                      <li key={j}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="popup-action popup-action-info">
                  LESSON: {fire.keyLesson}
                </div>
              </Popup>
            </GeoJSON>
          ))}

        {/* Firebreaks */}
        {layers.firebreaks &&
          firebreaks.map((fb, i) => {
            const fbCoords = fb.geometry.geometry.coordinates;
            let minDist = Infinity;
            for (const c of fbCoords) {
              const d = distanceMiles(fireFront.lat, fireFront.lng, c[1], c[0]);
              if (d < minDist) minDist = d;
            }
            const hours = estimateArrivalHours(minDist);
            const isGood = fb.condition === "Good" || fb.condition.includes("reduced");
            return (
              <GeoJSON
                key={`fb-${i}`}
                data={fb.geometry}
                style={{
                  color: isGood ? "#16a34a" : "#ca8a04",
                  weight: 4,
                  opacity: 0.8,
                  dashArray: fb.type.includes("Dozer") ? "8 6" : undefined,
                }}
              >
                <Popup className="popup-actionable">
                  <div className="popup-header">{fb.name}</div>
                  <div className="popup-stat">{fb.width}ft wide · {fb.type}</div>
                  <div className="popup-stat">Maintained {fb.lastMaintained} · {fb.condition}</div>
                  <div className="popup-stat">Fire front {minDist.toFixed(1)} mi away · ~{hours.toFixed(0)}h at current rate</div>
                  {!isGood ? (
                    <div className="popup-action popup-action-warning">
                      ACTION: Needs reconstruction — dozer access via Hwy 89
                    </div>
                  ) : (
                    <div className="popup-action popup-action-info">
                      ACTION: Reinforce with hand crews before fire arrival
                    </div>
                  )}
                </Popup>
              </GeoJSON>
            );
          })}

        {/* Water resources - lines */}
        {layers.water &&
          waterResources
            .filter((w) => w.geometry)
            .map((water, i) => (
              <GeoJSON
                key={`water-line-${i}`}
                data={water.geometry}
                style={{
                  color: "#3b82f6",
                  weight: 3,
                  opacity: 0.7,
                }}
              >
                <Popup className="popup-actionable">
                  <div className="popup-header">{water.name}</div>
                  <div className="popup-stat">{water.type} · {water.flow}</div>
                  <div className="popup-action popup-action-info">
                    ACTION: Viable for hand-line water support
                  </div>
                </Popup>
              </GeoJSON>
            ))}

        {/* Water resources - points */}
        {layers.water &&
          waterResources
            .filter((w) => w.lat)
            .map((water, i) => {
              const dist = distanceMiles(fireFront.lat, fireFront.lng, water.lat, water.lng);
              return (
                <Marker
                  key={`water-pt-${i}`}
                  position={[water.lat, water.lng]}
                  icon={waterIcon}
                >
                  <Popup className="popup-actionable">
                    <div className="popup-header">{water.name}</div>
                    <div className="popup-stat">{water.type}{water.capacity ? ` · ${water.capacity}` : ""}</div>
                    <div className="popup-stat">{dist.toFixed(1)} mi from fire front</div>
                    {water.dippable && (
                      <div className="popup-action popup-action-info">
                        ACTION: Helicopter dip-capable — stage bucket ops here
                      </div>
                    )}
                    {water.note && (
                      <div className="popup-action popup-action-info">
                        {water.note}
                      </div>
                    )}
                  </Popup>
                </Marker>
              );
            })}

        {/* Ridge lines */}
        {layers.terrain &&
          ridgeLines.map((ridge, i) => (
            <GeoJSON
              key={`ridge-${i}`}
              data={ridge}
              style={{
                color: "#78716c",
                weight: 2,
                opacity: 0.6,
                dashArray: "2 4",
              }}
            >
              <Popup className="popup-actionable">
                <div className="popup-header">{ridge.properties.name}</div>
                <div className="popup-stat">{ridge.properties.elevation}ft elevation</div>
                {ridge.properties.name === "Timber Ridge" && (
                  <div className="popup-action popup-action-info">
                    ACTION: Strong anchor point — 300ft fuel reduction project (2022). Used in Basin Fire + Pine Creek Fire containment ops.
                  </div>
                )}
              </Popup>
            </GeoJSON>
          ))}

        {/* Communities */}
        {layers.communities &&
          communities.map((comm, i) => {
            const dist = distanceMiles(fireFront.lat, fireFront.lng, comm.lat, comm.lng);
            const hours = estimateArrivalHours(dist);
            const historical = getHistoricalContext(comm.name);
            const nearFb = getNearestFirebreak(comm.lat, comm.lng);
            const statusColor = comm.evacuationStatus === "Order" ? "critical" : comm.evacuationStatus === "Warning" ? "warning" : "info";
            return (
              <Marker
                key={`comm-${i}`}
                position={[comm.lat, comm.lng]}
                icon={communityIcon(comm.evacuationStatus)}
              >
                <Popup className="popup-actionable">
                  <div className="popup-header">{comm.name}</div>
                  <div className="popup-stat">Pop. {comm.population.toLocaleString()} · Evac: {comm.evacuationStatus}</div>
                  <div className="popup-stat">{dist.toFixed(1)} mi from fire front · ~{hours.toFixed(0)}h at current rate</div>
                  <div className="popup-stat">Access: {comm.accessRoads.join(", ")}</div>
                  {comm.shelterCapacity > 0 && (
                    <div className="popup-stat">Shelter: {comm.shelterCapacity} capacity</div>
                  )}
                  {comm.accessRoads.length === 1 && (
                    <div className={`popup-action popup-action-critical`}>
                      RISK: Single access road — evacuation delays likely
                    </div>
                  )}
                  {historical && (
                    <div className="popup-action popup-action-warning">
                      HISTORICAL: {historical.name} ({historical.year}) — evac took {historical.containedInDays > 5 ? "8+ hours" : "4 hours"} here
                    </div>
                  )}
                  {nearFb && (
                    <div className="popup-action popup-action-info">
                      DEFENSE: {nearFb.name} ({nearFb.width}ft) is {nearFb.distance.toFixed(1)} mi away — {nearFb.condition.includes("Good") || nearFb.condition.includes("reduced") ? "in good condition" : "degraded, needs work"}
                    </div>
                  )}
                  {comm.evacuationStatus === "Warning" && (
                    <div className="popup-action popup-action-warning">
                      ACTION: Stage structure protection now — wind shift to W forecast at 1800h would push fire directly toward {comm.name}
                    </div>
                  )}
                  {comm.evacuationStatus === "Order" && (
                    <div className="popup-action popup-action-critical">
                      ACTION: Verify evacuation complete — confirm all {comm.population} residents out
                    </div>
                  )}
                </Popup>
              </Marker>
            );
          })}

        {/* Community labels */}
        {layers.communities &&
          communities.map((comm, i) => {
            const labelIcon = L.divIcon({
              className: "community-label",
              html: `<div style="
                font-size: 11px;
                font-weight: 600;
                color: #1f2937;
                text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white;
                white-space: nowrap;
                pointer-events: none;
              ">${comm.name}</div>`,
              iconSize: [0, 0],
              iconAnchor: [-10, 5],
            });
            return (
              <Marker
                key={`label-${i}`}
                position={[comm.lat, comm.lng]}
                icon={labelIcon}
                interactive={false}
              />
            );
          })}

        {/* Active fire front */}
        <GeoJSON
          data={currentFire.activeFront}
          style={{
            color: "#fbbf24",
            weight: 5,
            opacity: 0.9,
          }}
        />

        {/* Current fire perimeter */}
        <GeoJSON
          data={currentFire.perimeter}
          style={{
            fillColor: "#ef4444",
            fillOpacity: 0.3,
            color: "#dc2626",
            weight: 3,
          }}
        >
          <Popup className="popup-actionable">
            <div className="popup-header">{currentFire.name}</div>
            <div className="popup-stat">{currentFire.acresBurned.toLocaleString()} ac · {currentFire.containment}% contained</div>
            <div className="popup-stat">Started {currentFire.startDate} · {currentFire.cause}</div>
            <div className="popup-stat">Wind {wind.directionLabel} {wind.speed}mph, gusts {wind.gusts}mph</div>
            <div className="popup-action popup-action-warning">
              FORECAST: {wind.forecastChange}
            </div>
          </Popup>
        </GeoJSON>
      </MapContainer>
    </>
  );
}
