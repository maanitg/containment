import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { currentFire, wind, windForecast } from "../data/firePerimeter";
import { fuelTypes, ridgeLines, elevationPoints, powerLines } from "../data/terrain";
import {
  communities,
  firebreaks,
  waterResources,
} from "../data/infrastructure";
import { historicalFires } from "../data/historicalFires";

// ─── Utilities ───

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

function getFireFront() {
  const coords = currentFire.perimeter.geometry.coordinates[0];
  const windRad = (wind.direction * Math.PI) / 180;
  let maxProj = -Infinity;
  let frontPoint = coords[0];
  for (const c of coords) {
    const proj = c[1] * Math.cos(windRad) + c[0] * Math.sin(windRad);
    if (proj > maxProj) { maxProj = proj; frontPoint = c; }
  }
  return { lat: frontPoint[1], lng: frontPoint[0] };
}

const fireFront = getFireFront();

function estimateArrivalHours(distMiles) {
  const spreadRate = wind.speed > 20 ? 2.5 : wind.speed > 10 ? 1.5 : 0.8;
  return distMiles / spreadRate;
}

function getNearestPointOnLine(coords, lat, lng) {
  let minDist = Infinity;
  let nearest = coords[0];
  for (const c of coords) {
    const d = distanceMiles(lat, lng, c[1], c[0]);
    if (d < minDist) { minDist = d; nearest = c; }
  }
  return { lat: nearest[1], lng: nearest[0], distance: minDist };
}

function isInFirePath(coords, fireFrontPt, windDir) {
  const windRad = (windDir * Math.PI) / 180;
  for (const c of coords) {
    const dLat = c[1] - fireFrontPt.lat;
    const dLng = c[0] - fireFrontPt.lng;
    const angle = Math.atan2(dLng, dLat);
    const angleDiff = Math.abs(angle - windRad);
    const dist = distanceMiles(fireFrontPt.lat, fireFrontPt.lng, c[1], c[0]);
    if (angleDiff < Math.PI / 3 && dist < 8) return true;
  }
  return false;
}

// Check if a polygon centroid is in the fire's projected path
function polygonCentroid(coords) {
  let latSum = 0, lngSum = 0;
  for (const c of coords) { latSum += c[1]; lngSum += c[0]; }
  return { lat: latSum / coords.length, lng: lngSum / coords.length };
}

function isPolygonInFirePath(polyCoords, fireFrontPt, windDir) {
  const windRad = (windDir * Math.PI) / 180;
  const cent = polygonCentroid(polyCoords);
  const dLat = cent.lat - fireFrontPt.lat;
  const dLng = cent.lng - fireFrontPt.lng;
  const angle = Math.atan2(dLng, dLat);
  const angleDiff = Math.abs(angle - windRad);
  const dist = distanceMiles(fireFrontPt.lat, fireFrontPt.lng, cent.lat, cent.lng);
  return angleDiff < Math.PI / 2.5 && dist < 10;
}

function getUphillAlert() {
  const windRad = (wind.direction * Math.PI) / 180;
  const pointsAhead = elevationPoints.filter((pt) => {
    const dLat = pt.lat - fireFront.lat;
    const dLng = pt.lng - fireFront.lng;
    const angle = Math.atan2(dLng, dLat);
    const angleDiff = Math.abs(angle - windRad);
    const dist = distanceMiles(fireFront.lat, fireFront.lng, pt.lat, pt.lng);
    return angleDiff < Math.PI / 3 && dist < 5;
  });
  const originElev = elevationPoints.find((p) => p.label === "Fire Origin");
  if (!originElev) return null;
  const uphillPoints = pointsAhead
    .filter((p) => p.elevation > originElev.elevation + 500)
    .sort((a, b) => distanceMiles(fireFront.lat, fireFront.lng, a.lat, a.lng) - distanceMiles(fireFront.lat, fireFront.lng, b.lat, b.lng));
  if (uphillPoints.length > 0) {
    const pt = uphillPoints[0];
    const dist = distanceMiles(fireFront.lat, fireFront.lng, pt.lat, pt.lng);
    return { label: pt.label, elevation: pt.elevation, gain: pt.elevation - originElev.elevation, distance: dist, lat: pt.lat, lng: pt.lng };
  }
  return null;
}

// ─── Wind change detection ───

function getWindChangeAlerts() {
  const alerts = [];
  for (const fc of windForecast) {
    const dirShift = Math.abs(fc.direction - wind.direction);
    const speedDelta = fc.speed - wind.speed;

    // Major speed increase (>10mph jump)
    if (speedDelta >= 10) {
      alerts.push({
        id: `wind-surge-${fc.time}`,
        type: "surge",
        time: fc.time,
        from: `${wind.directionLabel} ${wind.speed}mph`,
        to: `${fc.directionLabel} ${fc.speed}mph (G${fc.gusts})`,
        speedDelta,
        summary: `Wind surge at ${fc.time}: ${wind.speed}→${fc.speed}mph (G${fc.gusts}). Fire spread rate will increase dramatically.`,
      });
    }
    // Significant direction shift (>30°)
    if (dirShift > 30) {
      alerts.push({
        id: `wind-shift-${fc.time}`,
        type: "shift",
        time: fc.time,
        from: `${wind.directionLabel} ${wind.speed}mph`,
        to: `${fc.directionLabel} ${fc.speed}mph`,
        dirShift,
        newDirection: fc.direction,
        summary: `Wind shift at ${fc.time}: ${wind.directionLabel}→${fc.directionLabel}. New flanks will become active.`,
      });
    }
  }
  return alerts;
}

export const windChangeAlerts = getWindChangeAlerts();

// ─── Fire scar analysis ───

function getFireScarAlerts() {
  const scarAlerts = [];
  for (const fire of historicalFires) {
    const coords = fire.perimeter.geometry.coordinates[0];
    const inPath = isPolygonInFirePath(coords, fireFront, wind.direction);
    if (!inPath) continue;

    const cent = polygonCentroid(coords);
    const dist = distanceMiles(fireFront.lat, fireFront.lng, cent.lat, cent.lng);
    const hours = estimateArrivalHours(dist);
    const hasEscalation = fire.resources && fire.resources.peakEngines > fire.resources.initialEngines * 2;

    scarAlerts.push({
      id: `scar-${fire.name}`,
      fire,
      centroid: cent,
      distance: dist,
      hours,
      hasEscalation,
      resourceNote: fire.resources ? fire.resources.escalationNote : null,
      peakEngines: fire.resources ? fire.resources.peakEngines : null,
      peakCrews: fire.resources ? fire.resources.peakCrews : null,
    });
  }
  return scarAlerts.sort((a, b) => a.distance - b.distance);
}

export const fireScarAlerts = getFireScarAlerts();

// ─── Spread rate calculation per perimeter segment ───

function getSpreadSegments() {
  const coords = currentFire.activeFront.geometry.coordinates;
  const windRad = (wind.direction * Math.PI) / 180;
  const segments = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const midLat = (coords[i][1] + coords[i + 1][1]) / 2;
    const midLng = (coords[i][0] + coords[i + 1][0]) / 2;

    // Direction this segment faces (outward normal)
    const dLat = coords[i + 1][1] - coords[i][1];
    const dLng = coords[i + 1][0] - coords[i][0];
    // Normal pointing outward (perpendicular, right-hand)
    const normalAngle = Math.atan2(dLat, -dLng);

    // How aligned is this normal with wind direction
    const alignment = Math.cos(normalAngle - windRad);
    // Spread rate relative to wind alignment (0-1)
    const rate = Math.max(0, alignment);

    // Also factor in terrain slope
    const nearestElev = elevationPoints.reduce((best, pt) => {
      const d = distanceMiles(midLat, midLng, pt.lat, pt.lng);
      return d < best.d ? { d, pt } : best;
    }, { d: Infinity, pt: null });

    const originElev = elevationPoints.find((p) => p.label === "Fire Origin") || { elevation: 3400 };
    let slopeFactor = 1;
    if (nearestElev.pt && nearestElev.d < 3) {
      const gain = nearestElev.pt.elevation - originElev.elevation;
      if (gain > 0) slopeFactor = 1 + (gain / 2000); // uphill = faster
    }

    const finalRate = rate * slopeFactor;

    if (finalRate > 0.15) {
      // Arrow length proportional to spread rate
      const arrowLen = 0.008 + finalRate * 0.016;
      const endLat = midLat + Math.cos(windRad) * arrowLen;
      const endLng = midLng + Math.sin(windRad) * arrowLen;

      segments.push({
        start: [midLat, midLng],
        end: [endLat, endLng],
        rate: finalRate,
        // Categorize
        category: finalRate > 0.7 ? "fast" : finalRate > 0.4 ? "moderate" : "slow",
      });
    }
  }
  return segments;
}

export const spreadSegments = getSpreadSegments();

// ─── Generate AI Insights ───

function getHistoricalEvacData(commName) {
  const results = [];
  for (const fire of historicalFires) {
    const lesson = fire.keyLesson.toLowerCase();
    const tactics = fire.suppressionTactics.join(" ").toLowerCase();
    if (lesson.includes(commName.toLowerCase()) || tactics.includes(commName.toLowerCase())) results.push(fire);
  }
  return results;
}

function generateInsights() {
  const insights = [];
  const commDistances = communities
    .map((c) => ({ ...c, distance: distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng), hours: estimateArrivalHours(distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng)) }))
    .sort((a, b) => a.distance - b.distance);

  // 1. Nearest community under evac order
  const evacOrder = commDistances.find((c) => c.evacuationStatus === "Order");
  if (evacOrder) {
    const singleAccess = evacOrder.accessRoads.length === 1;
    const accessNote = singleAccess ? "Single access road — " : "";
    insights.push({ id: "evac-critical", urgency: "critical", title: `Verify ${evacOrder.name} evacuation`, summary: `${accessNote}${evacOrder.distance.toFixed(1)} mi from fire (~${evacOrder.hours.toFixed(0)}h). Pop. ${evacOrder.population.toLocaleString()}.`, lat: evacOrder.lat, lng: evacOrder.lng });
  }

  // 1b. Single-access community at risk (even if only Warning)
  const singleAccessAtRisk = commDistances.find((c) => c.accessRoads.length === 1 && c.distance < 8 && c !== evacOrder);
  if (singleAccessAtRisk) {
    insights.push({ id: "single-access-risk", urgency: "critical", title: `${singleAccessAtRisk.name} — single road out`, summary: `Only exit: ${singleAccessAtRisk.accessRoads[0]}. ${singleAccessAtRisk.distance.toFixed(1)} mi from fire (~${singleAccessAtRisk.hours.toFixed(0)}h). Upgrade to evac order early.`, lat: singleAccessAtRisk.lat, lng: singleAccessAtRisk.lng });
  }

  // 2. Wind surge alert (highest priority weather event)
  const windSurge = windChangeAlerts.find((a) => a.type === "surge");
  if (windSurge) {
    insights.push({ id: windSurge.id, urgency: "critical", title: `Wind surge at ${windSurge.time}`, summary: windSurge.summary, lat: fireFront.lat, lng: fireFront.lng });
  }

  // 3. Fire scar with resource escalation
  const scarWithEscalation = fireScarAlerts.find((s) => s.hasEscalation);
  if (scarWithEscalation) {
    insights.push({ id: scarWithEscalation.id, urgency: "warning", title: `Fire trending into ${scarWithEscalation.fire.name} scar`, summary: `${scarWithEscalation.distance.toFixed(1)} mi. In ${scarWithEscalation.fire.year}: ${scarWithEscalation.resourceNote}`, lat: scarWithEscalation.centroid.lat, lng: scarWithEscalation.centroid.lng });
  }

  // 4. Power line in fire path
  for (const pl of powerLines) {
    if (insights.length >= 4) break;
    if (isInFirePath(pl.geometry.geometry.coordinates, fireFront, wind.direction)) {
      const nearest = getNearestPointOnLine(pl.geometry.geometry.coordinates, fireFront.lat, fireFront.lng);
      const midIdx = Math.floor(pl.geometry.geometry.coordinates.length / 2);
      const mid = pl.geometry.geometry.coordinates[midIdx];
      insights.push({ id: `powerline-${pl.name}`, urgency: "critical", title: `${pl.voltage} line in fire path`, summary: `${nearest.distance.toFixed(1)} mi from front (~${estimateArrivalHours(nearest.distance).toFixed(0)}h). Contact ${pl.operator} to de-energize.`, lat: mid[1], lng: mid[0] });
      break;
    }
  }

  // 5. Uphill slope
  if (insights.length < 4) {
    const uphill = getUphillAlert();
    if (uphill) {
      insights.push({ id: "uphill-slope", urgency: "warning", title: "Uphill slope ahead", summary: `+${uphill.gain}ft toward ${uphill.label} (${uphill.elevation}ft), ${uphill.distance.toFixed(1)} mi. Fire will accelerate.`, lat: uphill.lat, lng: uphill.lng });
    }
  }

  // 6. Wind direction shift
  if (insights.length < 4) {
    const windShift = windChangeAlerts.find((a) => a.type === "shift");
    if (windShift) {
      insights.push({ id: windShift.id, urgency: "warning", title: `Wind shift at ${windShift.time}`, summary: windShift.summary, lat: fireFront.lat, lng: fireFront.lng });
    }
  }

  return insights.slice(0, 4);
}

export const aiInsights = generateInsights();

// ─── Precomputed data ───

export const cityAlerts = communities
  .map((c) => ({ ...c, distance: distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng), hours: estimateArrivalHours(distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng)), histFires: getHistoricalEvacData(c.name) }))
  .filter((c) => c.distance < 8)
  .sort((a, b) => a.distance - b.distance);

export const powerLineAlerts = powerLines
  .filter((pl) => isInFirePath(pl.geometry.geometry.coordinates, fireFront, wind.direction))
  .map((pl) => {
    const nearest = getNearestPointOnLine(pl.geometry.geometry.coordinates, fireFront.lat, fireFront.lng);
    const midIdx = Math.floor(pl.geometry.geometry.coordinates.length / 2);
    const mid = pl.geometry.geometry.coordinates[midIdx];
    return { ...pl, nearestDist: nearest.distance, hours: estimateArrivalHours(nearest.distance), alertLat: mid[1], alertLng: mid[0] };
  });

export const uphillData = getUphillAlert();

// ─── Sub-components ───

function SpreadArrows() {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    const group = L.layerGroup();

    for (const seg of spreadSegments) {
      const color = seg.category === "fast" ? "#ef4444" : seg.category === "moderate" ? "#f59e0b" : "#60a5fa";
      const weight = seg.category === "fast" ? 4 : seg.category === "moderate" ? 3 : 2;
      const opacity = seg.category === "fast" ? 0.9 : 0.7;

      // Main arrow line
      group.addLayer(L.polyline([seg.start, seg.end], { color, weight, opacity }));

      // Arrowhead
      const dLat = seg.end[0] - seg.start[0];
      const dLng = seg.end[1] - seg.start[1];
      const angle = Math.atan2(dLng, dLat);
      const headLen = 0.004;
      const a1 = angle + Math.PI + Math.PI / 5;
      const a2 = angle + Math.PI - Math.PI / 5;
      group.addLayer(L.polyline([
        [seg.end[0] + Math.cos(a1) * headLen, seg.end[1] + Math.sin(a1) * headLen],
        seg.end,
        [seg.end[0] + Math.cos(a2) * headLen, seg.end[1] + Math.sin(a2) * headLen],
      ], { color, weight: weight + 1, opacity }));

      // Label on fast segments
      if (seg.category === "fast") {
        const labelIcon = L.divIcon({
          className: "map-alert-icon",
          html: `<div class="spread-label spread-fast">FAST</div>`,
          iconSize: [0, 0], iconAnchor: [-4, 8],
        });
        group.addLayer(L.marker(seg.end, { icon: labelIcon, interactive: false }));
      }
    }

    group.addTo(map);
    layerRef.current = group;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map]);
  return null;
}

function WindArrows() {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
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
        arrowLayer.addLayer(L.polyline([[lat, lng], [endLat, endLng]], { color: "#1a73e8", weight: 2, opacity: 0.4 }));
        const headLen = 0.003;
        const a1 = rad + Math.PI + Math.PI / 6, a2 = rad + Math.PI - Math.PI / 6;
        arrowLayer.addLayer(L.polyline([[endLat + Math.cos(a1) * headLen, endLng + Math.sin(a1) * headLen], [endLat, endLng], [endLat + Math.cos(a2) * headLen, endLng + Math.sin(a2) * headLen]], { color: "#1a73e8", weight: 2, opacity: 0.4 }));
      }
    }
    arrowLayer.addTo(map);
    layerRef.current = arrowLayer;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map]);
  return null;
}

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

const communityIcon = (status) => {
  const colors = { Order: "#dc2626", Warning: "#f59e0b", None: "#6b7280" };
  return L.divIcon({
    className: "community-marker",
    html: `<div style="background:${colors[status] || "#6b7280"};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.6);"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
};

const waterIcon = L.divIcon({
  className: "water-marker",
  html: `<div style="background:#3b82f6;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

// ─── Main Component ───

export default function FireMap({ layers, mapRef }) {
  return (
    <>
      <div className="fire-overlay">
        <div className="fire-overlay-name">{currentFire.name}</div>
        <div className="fire-overlay-stats">
          {currentFire.acresBurned.toLocaleString()} ac · {currentFire.containment}% · Wind {wind.directionLabel} {wind.speed}mph (G{wind.gusts})
        </div>
      </div>

      <MapContainer center={currentFire.center} zoom={12} style={{ width: "100%", height: "100%" }} zoomControl={false}>
        <MapController mapRef={mapRef} />
        <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' maxZoom={17} />
        <WindArrows />

        {/* Fuel type zones */}
        {layers.fuel && fuelTypes.map((fuel, i) => (
          <GeoJSON key={`fuel-${i}`} data={fuel} style={{ fillColor: fuel.properties.color, fillOpacity: 0.25, color: fuel.properties.color, weight: 1, dashArray: "4 4" }}>
            <Popup><div className="popup-header">{fuel.properties.label}</div><div className="popup-stat">{fuel.properties.fireRate}</div></Popup>
          </GeoJSON>
        ))}

        {/* Historical fire scars — clearly visible burn areas */}
        {layers.historical && historicalFires.map((fire, i) => {
          const coords = fire.perimeter.geometry.coordinates[0];
          const inPath = isPolygonInFirePath(coords, fireFront, wind.direction);
          return (
            <GeoJSON key={`hist-${i}`} data={fire.perimeter} style={{
              fillColor: inPath ? "#b45309" : "#78716c",
              fillOpacity: inPath ? 0.3 : 0.15,
              color: inPath ? "#d97706" : "#6b7280",
              weight: inPath ? 3 : 2,
              dashArray: inPath ? undefined : "6 3",
            }}>
              <Popup>
                <div className="popup-header">{fire.name} ({fire.year})</div>
                <div className="popup-stat">{fire.acres.toLocaleString()} ac · {fire.containedInDays}d · {fire.cause}</div>
                <div className="popup-stat" style={{marginTop:4,fontStyle:"italic"}}>{fire.keyLesson}</div>
                {fire.resources && (
                  <div style={{marginTop:6}}>
                    <div className="popup-hist-label">Resource deployment</div>
                    <div className="popup-hist-item">Engines: {fire.resources.initialEngines} → {fire.resources.peakEngines} peak</div>
                    <div className="popup-hist-item">Crews: {fire.resources.initialCrews} → {fire.resources.peakCrews} peak</div>
                    {fire.resources.airSupport && <div className="popup-hist-item">Air support deployed</div>}
                    <div className="popup-stat" style={{marginTop:3,fontWeight:600,color:"#92400e"}}>{fire.resources.escalationNote}</div>
                  </div>
                )}
              </Popup>
            </GeoJSON>
          );
        })}

        {/* Fire scar labels on map */}
        {layers.historical && historicalFires.map((fire, i) => {
          const coords = fire.perimeter.geometry.coordinates[0];
          const cent = polygonCentroid(coords);
          const inPath = isPolygonInFirePath(coords, fireFront, wind.direction);
          const labelIcon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="scar-label ${inPath ? "scar-label-active" : ""}">${fire.name} (${fire.year})<br/>${fire.acres.toLocaleString()} ac</div>`,
            iconSize: [0, 0], iconAnchor: [50, 10],
          });
          return <Marker key={`scar-label-${i}`} position={[cent.lat, cent.lng]} icon={labelIcon} interactive={false} />;
        })}

        {/* Fire scar resource alert badges — when fire trends toward a scar */}
        {layers.historical && fireScarAlerts.filter((s) => s.hasEscalation).map((scar, i) => {
          const icon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="map-badge-block map-badge-warning">⚠ ${scar.fire.name} SCAR — ${scar.peakEngines} engines needed last time</div>`,
            iconSize: [0, 0], iconAnchor: [0, -20],
          });
          return <Marker key={`scar-alert-${i}`} position={[scar.centroid.lat, scar.centroid.lng]} icon={icon}>
            <Popup>
              <div className="popup-header">{scar.fire.name} ({scar.fire.year}) — Resource History</div>
              <div className="popup-stat">{scar.distance.toFixed(1)} mi from fire front · ~{scar.hours.toFixed(0)}h</div>
              <div style={{marginTop:6}}>
                <div className="popup-hist-label">What happened last time</div>
                <div className="popup-hist-item">Engines: {scar.fire.resources.initialEngines} → {scar.fire.resources.peakEngines}</div>
                <div className="popup-hist-item">Crews: {scar.fire.resources.initialCrews} → {scar.fire.resources.peakCrews}</div>
                <div className="popup-stat" style={{marginTop:3,fontWeight:600,color:"#92400e"}}>{scar.resourceNote}</div>
              </div>
            </Popup>
          </Marker>;
        })}

        {/* Firebreaks */}
        {layers.firebreaks && firebreaks.map((fb, i) => {
          const isGood = fb.condition === "Good" || fb.condition.includes("reduced");
          return (
            <GeoJSON key={`fb-${i}`} data={fb.geometry} style={{ color: isGood ? "#16a34a" : "#ca8a04", weight: 4, opacity: 0.8, dashArray: fb.type.includes("Dozer") ? "8 6" : undefined }}>
              <Popup><div className="popup-header">{fb.name}</div><div className="popup-stat">{fb.width}ft · {fb.condition}</div></Popup>
            </GeoJSON>
          );
        })}

        {/* Water resources - points only */}
        {layers.water && waterResources.filter((w) => w.lat).map((water, i) => (
          <Marker key={`water-pt-${i}`} position={[water.lat, water.lng]} icon={waterIcon}>
            <Popup><div className="popup-header">{water.name}</div><div className="popup-stat">{water.type}{water.capacity ? ` · ${water.capacity}` : ""}</div>{water.dippable && <div className="popup-stat" style={{fontWeight:600}}>Helicopter dip-capable</div>}</Popup>
          </Marker>
        ))}

        {/* Ridge lines */}
        {layers.terrain && ridgeLines.map((ridge, i) => (
          <GeoJSON key={`ridge-${i}`} data={ridge} style={{ color: "#78716c", weight: 2, opacity: 0.6, dashArray: "2 4" }}>
            <Popup><div className="popup-header">{ridge.properties.name}</div><div className="popup-stat">{ridge.properties.elevation}ft</div></Popup>
          </GeoJSON>
        ))}

        {/* Uphill slope highlight */}
        {uphillData && layers.terrain && (() => {
          const slopeZone = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[
                [uphillData.lng - 0.03, uphillData.lat - 0.015],
                [uphillData.lng + 0.03, uphillData.lat - 0.015],
                [uphillData.lng + 0.03, uphillData.lat + 0.015],
                [uphillData.lng - 0.03, uphillData.lat + 0.015],
                [uphillData.lng - 0.03, uphillData.lat - 0.015],
              ]],
            },
          };
          const slopeIcon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="slope-badge">▲ UPHILL +${uphillData.gain}ft — FIRE WILL ACCELERATE</div>`,
            iconSize: [0, 0], iconAnchor: [0, 0],
          });
          return (
            <>
              <GeoJSON data={slopeZone} style={{ fillColor: "#f97316", fillOpacity: 0.15, color: "#f97316", weight: 2, dashArray: "6 4" }} />
              <Marker position={[uphillData.lat, uphillData.lng]} icon={slopeIcon} interactive={false} />
            </>
          );
        })()}

        {/* Power Lines */}
        {layers.powerlines && powerLines.map((pl, i) => {
          const inPath = isInFirePath(pl.geometry.geometry.coordinates, fireFront, wind.direction);
          return (
            <GeoJSON key={`pl-${i}`} data={pl.geometry} style={{ color: inPath ? "#dc2626" : "#a855f7", weight: inPath ? 4 : 2.5, opacity: 0.8, dashArray: "10 6" }}>
              <Popup><div className="popup-header">{pl.name}</div><div className="popup-stat">{pl.voltage} · {pl.operator}</div></Popup>
            </GeoJSON>
          );
        })}

        {/* Power line alert badges */}
        {layers.powerlines && powerLineAlerts.map((pl, i) => {
          const icon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="map-badge-block map-badge-critical">&#9889; ${pl.voltage} LINE IN PATH — ${pl.nearestDist.toFixed(1)}mi</div>`,
            iconSize: [0, 0], iconAnchor: [0, 30],
          });
          return <Marker key={`pl-alert-${i}`} position={[pl.alertLat, pl.alertLng]} icon={icon}>
            <Popup><div className="popup-header">{pl.name}</div><div className="popup-stat">~{pl.hours.toFixed(0)}h to fire contact. Contact {pl.operator}.</div></Popup>
          </Marker>;
        })}

        {/* City alert badges */}
        {layers.communities && cityAlerts.map((comm, i) => {
          const isOrder = comm.evacuationStatus === "Order";
          const isWarning = comm.evacuationStatus === "Warning";
          const cls = isOrder ? "critical" : isWarning ? "warning" : "monitor";
          const label = isOrder ? "EVAC ORDER" : isWarning ? "EVAC WARNING" : "MONITOR";
          const icon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="map-badge-block map-badge-${cls}">${label} · ${comm.population.toLocaleString()} · ${comm.distance.toFixed(1)}mi</div>`,
            iconSize: [0, 0], iconAnchor: [0, -14],
          });
          return (
            <Marker key={`city-alert-${i}`} position={[comm.lat, comm.lng]} icon={icon}>
              <Popup offset={[0, 28]} className="popup-below">
                <div className="popup-header">{comm.name}</div>
                <div className="popup-stat">Pop. {comm.population.toLocaleString()} · ~{comm.hours.toFixed(0)}h</div>
                <div className="popup-stat">Access: {comm.accessRoads.join(", ")}</div>
                {comm.histFires.length > 0 && (
                  <div style={{marginTop:6}}>
                    <div className="popup-hist-label">Past evacuations here</div>
                    {comm.histFires.map((f, j) => (
                      <div key={j} className="popup-hist-item">{f.name} ({f.year}) — {f.containedInDays}d, {f.acres.toLocaleString()}ac</div>
                    ))}
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}

        {/* Community dots */}
        {layers.communities && communities.map((comm, i) => (
          <Marker key={`comm-${i}`} position={[comm.lat, comm.lng]} icon={communityIcon(comm.evacuationStatus)} />
        ))}

        {/* Community labels */}
        {layers.communities && communities.map((comm, i) => {
          const labelIcon = L.divIcon({
            className: "community-label",
            html: `<div style="font-size:11px;font-weight:700;color:#1f2937;text-shadow:0 0 4px white,0 0 4px white,0 0 4px white;white-space:nowrap;pointer-events:none;">${comm.name}</div>`,
            iconSize: [0, 0], iconAnchor: [-12, 5],
          });
          return <Marker key={`label-${i}`} position={[comm.lat, comm.lng]} icon={labelIcon} interactive={false} />;
        })}

        {/* Spread direction arrows — shows WHERE fire is expanding fastest */}
        <SpreadArrows />

        <GeoJSON data={currentFire.activeFront} style={{ color: "#fbbf24", weight: 5, opacity: 0.9 }} />
        <GeoJSON data={currentFire.perimeter} style={{ fillColor: "#ef4444", fillOpacity: 0.3, color: "#dc2626", weight: 3 }}>
          <Popup><div className="popup-header">{currentFire.name}</div><div className="popup-stat">{currentFire.acresBurned.toLocaleString()} ac · {currentFire.containment}%</div></Popup>
        </GeoJSON>
      </MapContainer>
    </>
  );
}
