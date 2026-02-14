import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
  useMapEvents,
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

        // Arrow shaft
        const line = L.polyline(
          [
            [lat, lng],
            [endLat, endLng],
          ],
          {
            color: "#1a73e8",
            weight: 2,
            opacity: 0.5,
          }
        );

        // Arrowhead
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
          {
            color: "#1a73e8",
            weight: 2,
            opacity: 0.5,
          }
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

// Component to detect map movement and report visible features
function MapEventHandler({ onMapMove }) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onMapMove(bounds);
    },
    zoomend: () => {
      const bounds = map.getBounds();
      onMapMove(bounds);
    },
  });

  // Fire initial bounds
  useEffect(() => {
    const bounds = map.getBounds();
    onMapMove(bounds);
  }, [map, onMapMove]);

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

export default function FireMap({ onMapMove, layers, onLocationClick }) {
  const mapCenter = currentFire.center;

  const handleMapMove = useCallback(
    (bounds) => {
      if (onMapMove) onMapMove(bounds);
    },
    [onMapMove]
  );

  return (
    <MapContainer
      center={mapCenter}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      {/* Terrain base layer */}
      <TileLayer
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        maxZoom={17}
      />

      <MapEventHandler onMapMove={handleMapMove} />
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
            <Popup>
              <strong>{fuel.properties.label}</strong>
              <br />
              {fuel.properties.fireRate}
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
            <Popup>
              <strong>{fire.name} ({fire.year})</strong>
              <br />
              {fire.acres.toLocaleString()} acres
              <br />
              Contained in {fire.containedInDays} days
              <br />
              <em>{fire.keyLesson}</em>
            </Popup>
          </GeoJSON>
        ))}

      {/* Firebreaks */}
      {layers.firebreaks &&
        firebreaks.map((fb, i) => (
          <GeoJSON
            key={`fb-${i}`}
            data={fb.geometry}
            style={{
              color:
                fb.condition === "Good"
                  ? "#16a34a"
                  : fb.condition.includes("Degraded")
                  ? "#ca8a04"
                  : "#6b7280",
              weight: 4,
              opacity: 0.8,
              dashArray: fb.type.includes("Dozer") ? "8 6" : undefined,
            }}
          >
            <Popup>
              <strong>{fb.name}</strong>
              <br />
              Width: {fb.width}ft | {fb.type}
              <br />
              Last maintained: {fb.lastMaintained}
              <br />
              Condition: {fb.condition}
            </Popup>
          </GeoJSON>
        ))}

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
              <Popup>
                <strong>{water.name}</strong>
                <br />
                {water.type} - {water.flow}
              </Popup>
            </GeoJSON>
          ))}

      {/* Water resources - points */}
      {layers.water &&
        waterResources
          .filter((w) => w.lat)
          .map((water, i) => (
            <Marker
              key={`water-pt-${i}`}
              position={[water.lat, water.lng]}
              icon={waterIcon}
            >
              <Popup>
                <strong>{water.name}</strong>
                <br />
                {water.type}
                {water.capacity && (
                  <>
                    <br />
                    {water.capacity}
                  </>
                )}
                {water.dippable && (
                  <>
                    <br />
                    Helicopter dip-capable
                  </>
                )}
                {water.note && (
                  <>
                    <br />
                    {water.note}
                  </>
                )}
              </Popup>
            </Marker>
          ))}

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
            <Popup>
              <strong>{ridge.properties.name}</strong>
              <br />
              Elevation: {ridge.properties.elevation}ft
            </Popup>
          </GeoJSON>
        ))}

      {/* Communities */}
      {layers.communities &&
        communities.map((comm, i) => (
          <Marker
            key={`comm-${i}`}
            position={[comm.lat, comm.lng]}
            icon={communityIcon(comm.evacuationStatus)}
          >
            <Popup>
              <strong>{comm.name}</strong>
              <br />
              Population: {comm.population.toLocaleString()}
              <br />
              Evacuation: {comm.evacuationStatus}
              <br />
              Access: {comm.accessRoads.join(", ")}
              {comm.shelterCapacity > 0 && (
                <>
                  <br />
                  Shelter capacity: {comm.shelterCapacity}
                </>
              )}
            </Popup>
          </Marker>
        ))}

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
            ">${comm.name} (${comm.population.toLocaleString()})</div>`,
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

      {/* Current fire perimeter - rendered last to be on top */}
      <GeoJSON
        data={currentFire.perimeter}
        style={{
          fillColor: "#ef4444",
          fillOpacity: 0.3,
          color: "#dc2626",
          weight: 3,
        }}
      >
        <Popup>
          <strong>{currentFire.name}</strong>
          <br />
          {currentFire.acresBurned.toLocaleString()} acres
          <br />
          {currentFire.containment}% contained
          <br />
          Started: {currentFire.startDate}
          <br />
          Cause: {currentFire.cause}
        </Popup>
      </GeoJSON>
    </MapContainer>
  );
}
