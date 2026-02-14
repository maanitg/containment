import { useState, useCallback } from "react";
import FireMap from "./components/FireMap";
import InsightsPanel from "./components/InsightsPanel";
import LayerControls from "./components/LayerControls";
import "./App.css";

export default function App() {
  const [layers, setLayers] = useState({
    fuel: true,
    firebreaks: true,
    communities: true,
    water: true,
    terrain: true,
    historical: true,
  });

  const [mapBounds, setMapBounds] = useState(null);

  const handleToggle = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleMapMove = useCallback((bounds) => {
    setMapBounds(bounds);
  }, []);

  return (
    <div className="app">
      <div className="map-section">
        <FireMap onMapMove={handleMapMove} layers={layers} />
        <LayerControls layers={layers} onToggle={handleToggle} />
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: "#ef4444", opacity: 0.6 }} />
            Active Fire
          </div>
          <div className="legend-item">
            <span className="legend-line" style={{ backgroundColor: "#fbbf24" }} />
            Active Front
          </div>
          <div className="legend-item">
            <span className="legend-line" style={{ backgroundColor: "#16a34a" }} />
            Firebreak (Good)
          </div>
          <div className="legend-item">
            <span className="legend-line dashed" style={{ backgroundColor: "#ca8a04" }} />
            Firebreak (Degraded)
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "#dc2626" }} />
            Evac Order
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "#f59e0b" }} />
            Evac Warning
          </div>
        </div>
      </div>

      <div className="insights-section">
        <InsightsPanel mapBounds={mapBounds} />
      </div>
    </div>
  );
}
