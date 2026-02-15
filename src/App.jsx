import { useState, useCallback, useRef } from "react";
import FireMap, { aiInsights } from "./components/FireMap";
import "./App.css";

export default function App() {
  const [layers, setLayers] = useState({
    fuel: true,
    firebreaks: true,
    communities: true,
    water: true,
    terrain: true,
    powerlines: true,
    historical: true,
  });

  const [acknowledged, setAcknowledged] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const mapRef = useRef(null);

  const handleToggle = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAcknowledge = useCallback((e, insightId) => {
    e.stopPropagation();
    setAcknowledged((prev) => ({ ...prev, [insightId]: !prev[insightId] }));
  }, []);

  const handleFlyTo = useCallback((insight) => {
    if (mapRef.current) {
      mapRef.current.flyTo([insight.lat, insight.lng], 14, { duration: 1 });
    }
  }, []);

  const activeInsights = aiInsights.filter((i) => !acknowledged[i.id]);
  const acknowledgedInsights = aiInsights.filter((i) => acknowledged[i.id]);

  return (
    <div className="app">
      <div className="map-section">
        <FireMap layers={layers} mapRef={mapRef} />
        <div className="map-legend">
          <div className="legend-section">
            <div className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: "#ef4444", opacity: 0.6 }} />
              Active Fire
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: "#fbbf24" }} />
              Active Front
            </div>
            <div className="legend-item">
              <span className="legend-arrow" style={{ color: "#ef4444" }}>→</span>
              Fast Spread
            </div>
            <div className="legend-item">
              <span className="legend-arrow" style={{ color: "#f59e0b" }}>→</span>
              Moderate
            </div>
          </div>
          <div className="legend-divider" />
          <div className="legend-section">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#dc2626" }} />
              Evac Order
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#f59e0b" }} />
              Evac Warning
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: "#16a34a" }} />
              Firebreak
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: "#a855f7" }} />
              Power Line
            </div>
          </div>
          <div className="legend-divider" />
          <div className="legend-section">
            <div className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: "#b45309", opacity: 0.4 }} />
              Fire Scar
            </div>
            {[
              { key: "fuel", label: "Fuel Types", color: "#2d6a2e" },
              { key: "terrain", label: "Ridgelines", color: "#78716c" },
              { key: "historical", label: "Past Fires", color: "#9ca3af" },
              { key: "water", label: "Water", color: "#3b82f6" },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                className={`legend-toggle ${layers[key] ? "legend-toggle-on" : ""}`}
                onClick={() => handleToggle(key)}
              >
                <span
                  className="legend-dot"
                  style={{ backgroundColor: layers[key] ? color : "transparent", borderColor: color }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-count">{activeInsights.length}</span>
          ACTIVE ALERTS
        </div>

        <div className="sidebar-list">
          {activeInsights.map((insight) => (
            <div
              key={insight.id}
              className={`alert-card alert-${insight.urgency}`}
              onClick={() => handleFlyTo(insight)}
            >
              <div className="alert-status-bar" />
              <div className="alert-body">
                <div className="alert-title">{insight.title}</div>
                <div className="alert-summary">{insight.summary}</div>
              </div>
              <button
                className="alert-ack-btn"
                onClick={(e) => handleAcknowledge(e, insight.id)}
                title="Acknowledge"
              >
                ACK
              </button>
            </div>
          ))}
          {activeInsights.length === 0 && (
            <div className="sidebar-empty">All alerts acknowledged</div>
          )}
        </div>

        {acknowledgedInsights.length > 0 && (
          <div className="sidebar-history">
            <button
              className="history-toggle"
              onClick={() => setShowHistory((p) => !p)}
            >
              {showHistory ? "Hide" : "Show"} acknowledged ({acknowledgedInsights.length})
            </button>
            {showHistory && (
              <div className="history-list">
                {acknowledgedInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="alert-card alert-acknowledged"
                    onClick={() => handleFlyTo(insight)}
                  >
                    <div className="alert-status-bar alert-status-acked" />
                    <div className="alert-body">
                      <div className="alert-title">{insight.title}</div>
                      <div className="alert-summary">{insight.summary}</div>
                    </div>
                    <button
                      className="alert-unack-btn"
                      onClick={(e) => handleAcknowledge(e, insight.id)}
                      title="Reactivate"
                    >
                      ↩
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
