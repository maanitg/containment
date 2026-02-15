import { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

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

function getFireFront(currentFire, wind) {
  const coords = currentFire.perimeter.geometry.coordinates[0];
  // wind.direction is the "from" bearing (225 = from SW).
  // Fire spreads in the opposite direction (toward NE), so add 180°.
  const spreadRad = ((wind.direction + 180) * Math.PI) / 180;
  let maxProj = -Infinity;
  let frontPoint = coords[0];
  for (const c of coords) {
    const proj = c[1] * Math.cos(spreadRad) + c[0] * Math.sin(spreadRad);
    if (proj > maxProj) { maxProj = proj; frontPoint = c; }
  }
  return { lat: frontPoint[1], lng: frontPoint[0] };
}

function estimateArrivalHours(distMiles) {
  const spreadRate = 0.5; // mph estimate
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
  const dirRad = ((windDir + 180) * Math.PI) / 180;
  for (const c of coords) {
    const dLat = c[1] - fireFrontPt.lat;
    const dLng = c[0] - fireFrontPt.lng;
    const angle = Math.atan2(dLng, dLat);
    const angleDiff = Math.abs(angle - dirRad);
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
  const dirRad = ((windDir + 180) * Math.PI) / 180;
  const cent = polygonCentroid(polyCoords);
  const dLat = cent.lat - fireFrontPt.lat;
  const dLng = cent.lng - fireFrontPt.lng;
  const angle = Math.atan2(dLng, dLat);
  const angleDiff = Math.abs(angle - dirRad);
  const dist = distanceMiles(fireFrontPt.lat, fireFrontPt.lng, cent.lat, cent.lng);
  return angleDiff < Math.PI / 2.5 && dist < 10;
}

// Check if a historical fire is geographically relevant (same region as current fire)
function isGeographicallyRelevant(historicalFireCoords, currentFireCenter) {
  const histCentroid = polygonCentroid(historicalFireCoords);
  const distance = distanceMiles(currentFireCenter[0], currentFireCenter[1], histCentroid.lat, histCentroid.lng);
  // Consider fires within 30 miles as "same region" (increased for better visibility)
  return distance < 30;
}

function getUphillAlert(fireFront, wind, elevationPoints) {
  const spreadRad = ((wind.direction + 180) * Math.PI) / 180;
  const pointsAhead = elevationPoints.filter((pt) => {
    const dLat = pt.lat - fireFront.lat;
    const dLng = pt.lng - fireFront.lng;
    const angle = Math.atan2(dLng, dLat);
    const angleDiff = Math.abs(angle - spreadRad);
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

function getWindChangeAlerts(wind, windForecast) {
  const alerts = [];
  for (const fc of windForecast) {
    const dirShift = Math.abs(fc.direction - wind.direction);
    const speedDelta = fc.speed - wind.speed;

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

function getFireScarAlerts(historicalFires, fireFront, wind) {
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

// ─── Spread rate calculation per perimeter segment ───

function getSpreadSegments(currentFire, wind, elevationPoints) {
  const spreadRad = ((wind.direction + 180) * Math.PI) / 180;
  const coords = currentFire.activeFront.geometry.coordinates;
  const segments = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const midLat = (coords[i][1] + coords[i + 1][1]) / 2;
    const midLng = (coords[i][0] + coords[i + 1][0]) / 2;

    const dLat = coords[i + 1][1] - coords[i][1];
    const dLng = coords[i + 1][0] - coords[i][0];
    const normalAngle = Math.atan2(dLat, -dLng);

    const alignment = Math.cos(normalAngle - spreadRad);
    const rate = Math.max(0, alignment);

    const nearestElev = elevationPoints.reduce((best, pt) => {
      const d = distanceMiles(midLat, midLng, pt.lat, pt.lng);
      return d < best.d ? { d, pt } : best;
    }, { d: Infinity, pt: null });

    const originElev = elevationPoints.find((p) => p.label === "Fire Origin") || { elevation: 3400 };
    let slopeFactor = 1;
    if (nearestElev.pt && nearestElev.d < 3) {
      const gain = nearestElev.pt.elevation - originElev.elevation;
      if (gain > 0) slopeFactor = 1 + (gain / 2000);
    }

    const finalRate = rate * slopeFactor;

    if (finalRate > 0.15) {
      const arrowLen = 0.008 + finalRate * 0.016;
      const endLat = midLat + Math.cos(spreadRad) * arrowLen;
      const endLng = midLng + Math.sin(spreadRad) * arrowLen;

      segments.push({
        start: [midLat, midLng],
        end: [endLat, endLng],
        rate: finalRate,
        category: finalRate > 0.7 ? "fast" : finalRate > 0.4 ? "moderate" : "slow",
      });
    }
  }
  return segments;
}

function getHistoricalEvacData(commName, historicalFires) {
  const results = [];
  for (const fire of historicalFires) {
    const lesson = fire.keyLesson.toLowerCase();
    const tactics = fire.suppressionTactics.join(" ").toLowerCase();
    if (lesson.includes(commName.toLowerCase()) || tactics.includes(commName.toLowerCase())) results.push(fire);
  }
  return results;
}

// ─── Firebreak engagement analysis ───

function isPointInsidePerimeter(lat, lng, currentFire) {
  const poly = currentFire.perimeter.geometry.coordinates[0];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getFirebreakAnalysis(firebreaks, fireFront, wind, currentFire) {
  const analysis = [];
  for (const fb of firebreaks) {
    const coords = fb.geometry.geometry.coordinates;
    const nearest = getNearestPointOnLine(coords, fireFront.lat, fireFront.lng);
    const inPath = isInFirePath(coords, fireFront, wind.direction);

    let engagedCount = 0;
    for (const c of coords) {
      if (isPointInsidePerimeter(c[1], c[0], currentFire)) engagedCount++;
    }
    const engagedRatio = engagedCount / coords.length;

    let status;
    if (engagedRatio > 0.3) {
      status = "engaged";
    } else if (inPath && nearest.distance < 3) {
      status = "threatened";
    } else {
      status = "safe";
    }

    const isGoodCondition = fb.condition === "Good" || fb.condition.includes("reduced");
    const isWide = fb.width >= 100;
    let holdLikelihood;
    if (isGoodCondition && isWide) holdLikelihood = "high";
    else if (isGoodCondition || isWide) holdLikelihood = "moderate";
    else holdLikelihood = "low";

    const midIdx = Math.floor(coords.length / 2);
    const mid = coords[midIdx];

    analysis.push({
      ...fb,
      status,
      engagedRatio,
      holdLikelihood,
      nearestDist: nearest.distance,
      hours: estimateArrivalHours(nearest.distance),
      isGoodCondition,
      badgeLat: mid[1],
      badgeLng: mid[0],
    });
  }
  return analysis;
}

// ─── Downed powerline risk analysis ───

function getDownedLineRisks(powerLines, fireFront, wind, currentFire) {
  const risks = [];
  for (const pl of powerLines) {
    const coords = pl.geometry.geometry.coordinates;
    const inPath = isInFirePath(coords, fireFront, wind.direction);
    if (!inPath) continue;

    const downedSegments = [];
    for (let i = 0; i < coords.length; i++) {
      if (isPointInsidePerimeter(coords[i][1], coords[i][0], currentFire)) {
        downedSegments.push(coords[i]);
      }
    }
    const isLikelyDowned = downedSegments.length > 0;

    const isHighVoltage = pl.voltage.includes("115") || pl.voltage.includes("230") || pl.voltage.includes("500");
    const nearest = getNearestPointOnLine(coords, fireFront.lat, fireFront.lng);
    const midIdx = Math.floor(coords.length / 2);
    const mid = coords[midIdx];

    risks.push({
      ...pl,
      isLikelyDowned,
      downedSegments,
      isHighVoltage,
      nearestDist: nearest.distance,
      hours: estimateArrivalHours(nearest.distance),
      riskLat: mid[1],
      riskLng: mid[0],
      dangerRadiusMiles: isHighVoltage ? 0.15 : 0.05,
    });
  }
  return risks;
}

function generateInsights(communities, fireFront, wind, windChangeAlerts, fireScarAlerts, powerLines, elevationPoints, firebreakAnalysis, downedLineRisks) {
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

  // 1b. Single-access community at risk
  const singleAccessAtRisk = commDistances.find((c) => c.accessRoads.length === 1 && c.distance < 8 && c !== evacOrder);
  if (singleAccessAtRisk) {
    insights.push({ id: "single-access-risk", urgency: "critical", title: `${singleAccessAtRisk.name} — single road out`, summary: `Only exit: ${singleAccessAtRisk.accessRoads[0]}. ${singleAccessAtRisk.distance.toFixed(1)} mi from fire (~${singleAccessAtRisk.hours.toFixed(0)}h). Upgrade to evac order early.`, lat: singleAccessAtRisk.lat, lng: singleAccessAtRisk.lng });
  }

  // 2. Wind surge alert
  const windSurge = windChangeAlerts.find((a) => a.type === "surge");
  if (windSurge) {
    insights.push({ id: windSurge.id, urgency: "critical", title: `Wind surge at ${windSurge.time}`, summary: windSurge.summary, lat: fireFront.lat, lng: fireFront.lng });
  }

  // 3. Fire scar with resource escalation
  const scarWithEscalation = fireScarAlerts.find((s) => s.hasEscalation);
  if (scarWithEscalation) {
    insights.push({ id: scarWithEscalation.id, urgency: "warning", title: `Fire trending into ${scarWithEscalation.fire.name} scar`, summary: `${scarWithEscalation.distance.toFixed(1)} mi. In ${scarWithEscalation.fire.year}: ${scarWithEscalation.resourceNote}`, lat: scarWithEscalation.centroid.lat, lng: scarWithEscalation.centroid.lng });
  }

  // 4. Firebreak engagement
  const engagedBreaks = firebreakAnalysis.filter((fb) => fb.status === "engaged");
  for (const fb of engagedBreaks) {
    if (insights.length >= 6) break;
    if (fb.holdLikelihood === "low") {
      insights.push({ id: `fb-failing-${fb.name}`, urgency: "critical", title: `${fb.name} — may not hold`, summary: `${fb.width}ft wide, ${fb.condition.toLowerCase()}. Fire is testing this line. Reinforce or establish fallback.`, lat: fb.badgeLat, lng: fb.badgeLng });
    } else {
      insights.push({ id: `fb-holding-${fb.name}`, urgency: "warning", title: `${fb.name} — fire engaged`, summary: `${fb.width}ft wide, condition ${fb.condition.toLowerCase()}. ${fb.holdLikelihood === "high" ? "Strong hold expected" : "Monitor closely"}.`, lat: fb.badgeLat, lng: fb.badgeLng });
    }
  }

  // 4b. Threatened firebreaks
  const threatenedBreaks = firebreakAnalysis.filter((fb) => fb.status === "threatened");
  for (const fb of threatenedBreaks) {
    if (insights.length >= 6) break;
    insights.push({ id: `fb-threatened-${fb.name}`, urgency: "warning", title: `${fb.name} — fire approaching`, summary: `${fb.nearestDist.toFixed(1)} mi away (~${fb.hours.toFixed(0)}h). ${fb.width}ft wide, ${fb.condition.toLowerCase()}. Pre-position crews.`, lat: fb.badgeLat, lng: fb.badgeLng });
  }

  // 5. Downed powerline risk
  for (const risk of downedLineRisks) {
    if (insights.length >= 6) break;
    if (risk.isLikelyDowned) {
      insights.push({ id: `downed-${risk.name}`, urgency: "critical", title: `${risk.voltage} line likely downed`, summary: `${risk.downedSegments.length} segment(s) inside fire perimeter. Electrocution & re-ignition hazard. Keep crews ${risk.isHighVoltage ? "100+" : "35+"}ft clear. Contact ${risk.operator}.`, lat: risk.riskLat, lng: risk.riskLng });
    } else {
      const nearest = getNearestPointOnLine(risk.geometry.geometry.coordinates, fireFront.lat, fireFront.lng);
      insights.push({ id: `powerline-${risk.name}`, urgency: "critical", title: `${risk.voltage} line in fire path`, summary: `${nearest.distance.toFixed(1)} mi from front (~${estimateArrivalHours(nearest.distance).toFixed(0)}h). Risk of downed lines & re-ignition. Contact ${risk.operator} to de-energize.`, lat: risk.riskLat, lng: risk.riskLng });
    }
  }

  // 6. Uphill slope
  if (insights.length < 6) {
    const uphill = getUphillAlert(fireFront, wind, elevationPoints);
    if (uphill) {
      insights.push({ id: "uphill-slope", urgency: "warning", title: "Uphill slope ahead", summary: `+${uphill.gain}ft toward ${uphill.label} (${uphill.elevation}ft), ${uphill.distance.toFixed(1)} mi. Fire will accelerate.`, lat: uphill.lat, lng: uphill.lng });
    }
  }

  // 7. Wind direction shift
  if (insights.length < 6) {
    const windShift = windChangeAlerts.find((a) => a.type === "shift");
    if (windShift) {
      insights.push({ id: windShift.id, urgency: "warning", title: `Wind shift at ${windShift.time}`, summary: windShift.summary, lat: fireFront.lat, lng: fireFront.lng });
    }
  }

  return insights.slice(0, 6);
}

// ─── Sub-components ───

function SpreadArrows({ spreadSegments }) {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    const group = L.layerGroup();

    for (const seg of spreadSegments) {
      const color = seg.category === "fast" ? "#ef4444" : seg.category === "moderate" ? "#f59e0b" : "#60a5fa";
      const weight = seg.category === "fast" ? 4 : seg.category === "moderate" ? 3 : 2;
      const opacity = seg.category === "fast" ? 0.9 : 0.7;

      group.addLayer(L.polyline([seg.start, seg.end], { color, weight, opacity }));

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
  }, [map, spreadSegments]);
  return null;
}

function WindArrows({ wind }) {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    const spreadRad = ((wind.direction + 180) * Math.PI) / 180;
    const arrowLayer = L.layerGroup();
    const bounds = map.getBounds();
    const latStep = (bounds.getNorth() - bounds.getSouth()) / 5;
    const lngStep = (bounds.getEast() - bounds.getWest()) / 5;
    for (let i = 1; i < 5; i++) {
      for (let j = 1; j < 5; j++) {
        const lat = bounds.getSouth() + latStep * i;
        const lng = bounds.getWest() + lngStep * j;
        const len = 0.008;
        const endLat = lat + Math.cos(spreadRad) * len;
        const endLng = lng + Math.sin(spreadRad) * len;
        arrowLayer.addLayer(L.polyline([[lat, lng], [endLat, endLng]], { color: "#1a73e8", weight: 2, opacity: 0.4 }));
        const headLen = 0.003;
        const a1 = spreadRad + Math.PI + Math.PI / 6, a2 = spreadRad + Math.PI - Math.PI / 6;
        arrowLayer.addLayer(L.polyline([[endLat + Math.cos(a1) * headLen, endLng + Math.sin(a1) * headLen], [endLat, endLng], [endLat + Math.cos(a2) * headLen, endLng + Math.sin(a2) * headLen]], { color: "#1a73e8", weight: 2, opacity: 0.4 }));
      }
    }
    arrowLayer.addTo(map);
    layerRef.current = arrowLayer;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map, wind]);
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

export default function FireMap({ layers, mapRef, data, onInsightsGenerated }) {
  if (!data || !data.firePerimeter || !data.infrastructure || !data.terrain || !data.historicalFires) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>Loading map data...</div>;
  }

  const currentFire = data.firePerimeter.currentFire;
  const wind = data.firePerimeter.wind;
  const windForecast = data.firePerimeter.windForecast;
  const fuelTypes = data.terrain.fuelTypes;
  const ridgeLines = data.terrain.ridgeLines;
  const elevationPoints = data.terrain.elevationPoints;
  const powerLines = data.terrain.powerLines;
  const communities = data.infrastructure.communities;
  const firebreaks = data.infrastructure.firebreaks;
  const waterResources = data.infrastructure.waterResources;
  const historicalFires = data.historicalFires;

  // Log historical fires for debugging
  if (historicalFires && historicalFires.length > 0) {
    console.log(`📍 Displaying ${historicalFires.length} historical fires on map`);
  }

  const fireFront = useMemo(() => getFireFront(currentFire, wind), [currentFire, wind]);

  const windChangeAlerts = useMemo(() => getWindChangeAlerts(wind, windForecast), [wind, windForecast]);

  // Optimize: Only calculate if historical fires layer is visible
  const fireScarAlerts = useMemo(() => {
    if (!layers.historical) return [];
    return getFireScarAlerts(historicalFires, fireFront, wind);
  }, [historicalFires, fireFront, wind, layers.historical]);

  // Optimize: Reduce calculations by checking if data exists
  const spreadSegments = useMemo(() => {
    if (!currentFire?.activeFront?.geometry?.coordinates) return [];
    return getSpreadSegments(currentFire, wind, elevationPoints);
  }, [currentFire, wind, elevationPoints]);

  // Optimize: Avoid double distance calculation
  const cityAlerts = useMemo(() =>
    communities
      .map((c) => {
        const distance = distanceMiles(fireFront.lat, fireFront.lng, c.lat, c.lng);
        return {
          ...c,
          distance,
          hours: estimateArrivalHours(distance),
          histFires: getHistoricalEvacData(c.name, historicalFires)
        };
      })
      .filter((c) => c.distance < 8)
      .sort((a, b) => a.distance - b.distance),
    [communities, fireFront, historicalFires]
  );

  // Optimize: Only calculate if powerlines layer is visible
  const powerLineAlerts = useMemo(() => {
    if (!layers.powerlines || powerLines.length === 0) return [];
    return powerLines
      .filter((pl) => isInFirePath(pl.geometry.geometry.coordinates, fireFront, wind.direction))
      .map((pl) => {
        const nearest = getNearestPointOnLine(pl.geometry.geometry.coordinates, fireFront.lat, fireFront.lng);
        const midIdx = Math.floor(pl.geometry.geometry.coordinates.length / 2);
        const mid = pl.geometry.geometry.coordinates[midIdx];
        return { ...pl, nearestDist: nearest.distance, hours: estimateArrivalHours(nearest.distance), alertLat: mid[1], alertLng: mid[0] };
      });
  }, [powerLines, fireFront, wind, layers.powerlines]);

  // Optimize: Only calculate if terrain layer is visible
  const uphillData = useMemo(() => {
    if (!layers.terrain) return null;
    return getUphillAlert(fireFront, wind, elevationPoints);
  }, [fireFront, wind, elevationPoints, layers.terrain]);

  // Optimize: Only calculate if firebreaks layer is visible
  const firebreakData = useMemo(() => {
    if (!layers.firebreaks || firebreaks.length === 0) return [];
    return getFirebreakAnalysis(firebreaks, fireFront, wind, currentFire);
  }, [firebreaks, fireFront, wind, currentFire, layers.firebreaks]);

  // Optimize: Only calculate if powerlines layer is visible
  const downedLineData = useMemo(() => {
    if (!layers.powerlines || powerLines.length === 0) return [];
    return getDownedLineRisks(powerLines, fireFront, wind, currentFire);
  }, [powerLines, fireFront, wind, currentFire, layers.powerlines]);

  const aiInsights = useMemo(() => generateInsights(
    communities, fireFront, wind, windChangeAlerts, fireScarAlerts, powerLines, elevationPoints, firebreakData, downedLineData
  ), [communities, fireFront, wind, windChangeAlerts, fireScarAlerts, powerLines, elevationPoints, firebreakData, downedLineData]);

  useEffect(() => {
    if (onInsightsGenerated && aiInsights) {
      onInsightsGenerated(aiInsights);
    }
  }, [aiInsights, onInsightsGenerated]);

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
        <WindArrows wind={wind} />

        {/* Fuel type zones */}
        {layers.fuel && fuelTypes.map((fuel, i) => (
          <GeoJSON key={`fuel-${i}`} data={fuel} style={{ fillColor: fuel.properties.color, fillOpacity: 0.25, color: fuel.properties.color, weight: 1, dashArray: "4 4" }}>
            <Popup><div className="popup-header">{fuel.properties.label}</div><div className="popup-stat">{fuel.properties.fireRate}</div></Popup>
          </GeoJSON>
        ))}

        {/* Historical fire scars */}
        {layers.historical && historicalFires.map((fire, i) => {
          const coords = fire.perimeter.geometry.coordinates[0];
          const inPath = isPolygonInFirePath(coords, fireFront, wind.direction);
          const isRelevant = isGeographicallyRelevant(coords, currentFire.center);

          // Styling priority: relevant + in path > relevant > in path > default
          let fillColor, fillOpacity, color, weight, dashArray;
          if (isRelevant && inPath) {
            // Most relevant: same region AND in fire path - VERY PROMINENT
            fillColor = "#dc2626";
            fillOpacity = 0.45; // Increased opacity
            color = "#ef4444";
            weight = 4; // Thicker border
            dashArray = undefined;
          } else if (isRelevant) {
            // Relevant: same region - PROMINENT
            fillColor = "#f59e0b";
            fillOpacity = 0.35; // Increased opacity
            color = "#fbbf24";
            weight = 3;
            dashArray = "4 4";
          } else if (inPath) {
            // In path but different region
            fillColor = "#b45309";
            fillOpacity = 0.2;
            color = "#d97706";
            weight = 2;
            dashArray = undefined;
          } else {
            // Not relevant - more subdued
            fillColor = "#78716c";
            fillOpacity = 0.08; // Reduced to be less distracting
            color = "#9ca3af";
            weight = 1;
            dashArray = "8 4";
          }

          return (
            <GeoJSON key={`hist-${i}`} data={fire.perimeter} style={{
              fillColor,
              fillOpacity,
              color,
              weight,
              dashArray,
            }}>
              <Popup>
                <div className="popup-header">
                  {fire.name} ({fire.year})
                  {isRelevant && <span style={{marginLeft:6,fontSize:11,fontWeight:600,color:"#f59e0b"}}>★ Same Region</span>}
                </div>
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

        {/* Fire scar labels */}
        {layers.historical && historicalFires.map((fire, i) => {
          const coords = fire.perimeter.geometry.coordinates[0];
          const cent = polygonCentroid(coords);
          const inPath = isPolygonInFirePath(coords, fireFront, wind.direction);
          const isRelevant = isGeographicallyRelevant(coords, currentFire.center);

          // Different styling based on relevance
          let labelClass = "";
          let labelSuffix = "";
          if (isRelevant && inPath) {
            labelClass = "scar-label-relevant-active";
            labelSuffix = " ★";
          } else if (isRelevant) {
            labelClass = "scar-label-relevant";
            labelSuffix = " ★";
          } else if (inPath) {
            labelClass = "scar-label-active";
          }

          const labelIcon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="scar-label ${labelClass}">${fire.name} (${fire.year})${labelSuffix}<br/>${fire.acres.toLocaleString()} ac</div>`,
            iconSize: [0, 0], iconAnchor: [50, 10],
          });
          return <Marker key={`scar-label-${i}`} position={[cent.lat, cent.lng]} icon={labelIcon} interactive={false} />;
        })}

        {/* Fire scar resource alert badges */}
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

        {/* Firebreaks — styled by engagement status */}
        {layers.firebreaks && firebreakData.map((fb, i) => {
          let color, weight, dashArray;
          if (fb.status === "engaged") {
            color = fb.holdLikelihood === "low" ? "#dc2626" : fb.holdLikelihood === "moderate" ? "#f59e0b" : "#16a34a";
            weight = 6;
            dashArray = undefined;
          } else if (fb.status === "threatened") {
            color = "#f59e0b";
            weight = 5;
            dashArray = "4 4";
          } else {
            color = fb.isGoodCondition ? "#16a34a" : "#ca8a04";
            weight = 4;
            dashArray = fb.type.includes("Dozer") ? "8 6" : undefined;
          }
          return (
            <GeoJSON key={`fb-${i}`} data={fb.geometry} style={{ color, weight, opacity: 0.9, dashArray }}>
              <Popup>
                <div className="popup-header">{fb.name}</div>
                <div className="popup-stat">{fb.width}ft · {fb.condition}</div>
                {fb.status === "engaged" && <div className="popup-stat" style={{marginTop:4,fontWeight:700,color: fb.holdLikelihood === "low" ? "#dc2626" : "#16a34a"}}>{fb.holdLikelihood === "high" ? "HOLDING — strong containment line" : fb.holdLikelihood === "moderate" ? "ENGAGED — monitor closely" : "AT RISK — may not hold, reinforce"}</div>}
                {fb.status === "threatened" && <div className="popup-stat" style={{marginTop:4,color:"#d97706"}}>Fire approaching in ~{fb.hours.toFixed(0)}h</div>}
              </Popup>
            </GeoJSON>
          );
        })}

        {/* Firebreak engagement badges */}
        {layers.firebreaks && firebreakData.filter((fb) => fb.status !== "safe").map((fb, i) => {
          const isEngaged = fb.status === "engaged";
          const badgeClass = fb.holdLikelihood === "low" ? "critical" : isEngaged ? "warning" : "monitor";
          const label = isEngaged
            ? (fb.holdLikelihood === "low" ? `⚠ ${fb.name} — MAY NOT HOLD` : fb.holdLikelihood === "high" ? `✓ ${fb.name} HOLDING` : `${fb.name} ENGAGED`)
            : `${fb.name} — FIRE ${fb.nearestDist.toFixed(1)}mi`;
          const icon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="map-badge-block map-badge-${badgeClass}">${label}</div>`,
            iconSize: [0, 0], iconAnchor: [0, 20],
          });
          return <Marker key={`fb-badge-${i}`} position={[fb.badgeLat, fb.badgeLng]} icon={icon} />;
        })}

        {/* Water resources */}
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
            type: "Feature", properties: {},
            geometry: { type: "Polygon", coordinates: [[
              [uphillData.lng - 0.03, uphillData.lat - 0.015],
              [uphillData.lng + 0.03, uphillData.lat - 0.015],
              [uphillData.lng + 0.03, uphillData.lat + 0.015],
              [uphillData.lng - 0.03, uphillData.lat + 0.015],
              [uphillData.lng - 0.03, uphillData.lat - 0.015],
            ]] },
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

        {/* Downed line danger zones */}
        {layers.powerlines && downedLineData.filter((r) => r.isLikelyDowned).map((risk, i) => {
          const buf = risk.isHighVoltage ? 0.002 : 0.0008;
          return risk.downedSegments.map((seg, j) => {
            const dangerZone = {
              type: "Feature", properties: {},
              geometry: { type: "Polygon", coordinates: [[
                [seg[0] - buf, seg[1] - buf],
                [seg[0] + buf, seg[1] - buf],
                [seg[0] + buf, seg[1] + buf],
                [seg[0] - buf, seg[1] + buf],
                [seg[0] - buf, seg[1] - buf],
              ]] },
            };
            return <GeoJSON key={`downed-zone-${i}-${j}`} data={dangerZone} style={{ fillColor: "#fbbf24", fillOpacity: 0.25, color: "#dc2626", weight: 2, dashArray: "4 3" }} />;
          });
        })}

        {/* Power line alert badges — enhanced with downed-line info */}
        {layers.powerlines && downedLineData.map((risk, i) => {
          const isDowned = risk.isLikelyDowned;
          const label = isDowned
            ? `⚡ ${risk.voltage} DOWNED — DANGER ZONE`
            : `⚡ ${risk.voltage} LINE IN PATH — ${risk.nearestDist.toFixed(1)}mi`;
          const icon = L.divIcon({
            className: "map-alert-icon",
            html: `<div class="map-badge-block map-badge-critical">${label}</div>`,
            iconSize: [0, 0], iconAnchor: [0, 30],
          });
          return <Marker key={`pl-alert-${i}`} position={[risk.riskLat, risk.riskLng]} icon={icon}>
            <Popup>
              <div className="popup-header">{risk.name}</div>
              {isDowned ? (
                <div>
                  <div className="popup-stat" style={{fontWeight:700,color:"#dc2626"}}>LIKELY DOWNED — {risk.downedSegments.length} segment(s) inside fire</div>
                  <div className="popup-stat" style={{marginTop:4}}>⚠ Electrocution hazard — keep all personnel {risk.isHighVoltage ? "100+" : "35+"}ft clear</div>
                  <div className="popup-stat" style={{marginTop:2}}>⚠ Downed lines can arc and ignite new spot fires</div>
                  <div className="popup-stat" style={{marginTop:4,fontWeight:600}}>Contact {risk.operator} to de-energize immediately</div>
                </div>
              ) : (
                <div>
                  <div className="popup-stat">~{risk.hours.toFixed(0)}h to fire contact</div>
                  <div className="popup-stat" style={{marginTop:4}}>Risk: lines may fall, causing re-ignition & electrocution hazard</div>
                  <div className="popup-stat" style={{marginTop:2,fontWeight:600}}>Contact {risk.operator} to de-energize before fire arrival</div>
                </div>
              )}
            </Popup>
          </Marker>;
        })}

        {/* Original power line badges for lines NOT in downedLineData */}
        {layers.powerlines && powerLineAlerts
          .filter((pl) => !downedLineData.some((r) => r.name === pl.name))
          .map((pl, i) => {
            const icon = L.divIcon({
              className: "map-alert-icon",
              html: `<div class="map-badge-block map-badge-critical">&#9889; ${pl.voltage} LINE IN PATH — ${pl.nearestDist.toFixed(1)}mi</div>`,
              iconSize: [0, 0], iconAnchor: [0, 30],
            });
            return <Marker key={`pl-orig-alert-${i}`} position={[pl.alertLat, pl.alertLng]} icon={icon}>
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

        {/* Spread direction arrows */}
        <SpreadArrows spreadSegments={spreadSegments} />

        <GeoJSON data={currentFire.activeFront} style={{ color: "#fbbf24", weight: 5, opacity: 0.9 }} />
        <GeoJSON data={currentFire.perimeter} style={{ fillColor: "#ef4444", fillOpacity: 0.3, color: "#dc2626", weight: 3 }}>
          <Popup><div className="popup-header">{currentFire.name}</div><div className="popup-stat">{currentFire.acresBurned.toLocaleString()} ac · {currentFire.containment}%</div></Popup>
        </GeoJSON>
      </MapContainer>
    </>
  );
}
