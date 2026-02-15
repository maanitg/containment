import { useState, useCallback, useRef, useEffect } from "react";
import FireMap from "./components/FireMap";
import { useFireData } from "./hooks/useFireData";
import { dataService } from "./services/dataService";
import OfflineBanner from "./offline/OfflineBanner";
import "./App.css";

export default function App() {
  const { data, loading, error } = useFireData();
  const [aiInsights, setAiInsights] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [processingData, setProcessingData] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [dismissedRecommendation, setDismissedRecommendation] = useState(false);

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
  const hasProcessed = useRef(false); // Track if we've already processed data

  // Process timestamped data through agents on mount
  useEffect(() => {
    async function processAllTimestampedData() {
      if (processingData || hasProcessed.current) return;
      hasProcessed.current = true;

      setProcessingData(true);
      console.log("🔥 Processing timestamped data through agents...");

      try {
        // Process timestamped files (5 files = first 4 minutes of fire)
        const numFilesToProcess = 5; // Full dataset: T+0min through T+4min
        console.log(`Processing ${numFilesToProcess} timestamped data files (1-minute intervals)...`);

        for (let i = 1; i <= numFilesToProcess; i++) {
          console.log(`Processing time index ${i}...`);

          try {
            console.log(`Sending file ${i} to backend...`);
            await dataService.processLiveData(i);
            console.log(`✅ Backend processed file ${i}`);

            // Fetch and update notifications after EACH file completes
            console.log(`📥 Fetching notifications from backend...`);
            const notifResponse = await dataService.fetchNotifications(100, 0);
            console.log(`📥 Received response:`, notifResponse);

            if (notifResponse && notifResponse.notifications) {
              setNotifications(notifResponse.notifications);
              console.log(`✅ File ${i} complete: ${notifResponse.notifications.length} total notifications now visible`);
            } else {
              console.warn(`⚠️ No notifications in response:`, notifResponse);
            }

            // Fetch latest recommendation
            try {
              console.log(`📥 Fetching latest recommendation...`);
              const rec = await dataService.fetchLatestRecommendation();
              if (rec && !rec.error) {
                setRecommendation(rec);
                setDismissedRecommendation(false); // Show new recommendation
                console.log(`✅ Recommendation loaded:`, rec);
                console.log(`   - Action: ${rec.action || rec.consideration}`);
                console.log(`   - Rationale: ${rec.rationale || 'N/A'}`);
                console.log(`   - Confidence: ${rec.confidence_score}%`);
              }
            } catch (err) {
              console.log(`⚠️ No recommendation yet:`, err.message);
            }
          } catch (err) {
            console.error(`❌ Error processing file ${i}:`, err);
            console.error(`Full error details:`, err);
            // Continue to next file even if this one fails
          }

          // Add delay between processing to avoid rate limits (each file makes ~5 API calls)
          if (i < numFilesToProcess) {
            console.log(`Waiting 15s before processing next minute to avoid rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15s delay between minutes
          }
        }

        console.log(`✅ All files processed successfully!`);

        // Fetch final notification count
        const finalNotifResponse = await dataService.fetchNotifications(100, 0);
        console.log(`📊 Final notification count: ${finalNotifResponse?.notifications?.length || 0}`);
      } catch (err) {
        console.error("❌ Error processing timestamped data:", err);
        console.error("Error stack:", err.stack);
      } finally {
        setProcessingData(false);
      }
    }

    // Only process once data is loaded and we haven't processed yet
    if (data && !processingData && !hasProcessed.current) {
      processAllTimestampedData();
    }
  }, [data, processingData]);

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

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔥 Loading WildfireOS...</div>
          <div style={{ color: '#6b7280' }}>Fetching fire data from backend</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️ Error Loading Data</div>
          <div>{error}</div>
          <div style={{ marginTop: '20px', color: '#6b7280' }}>
            Make sure the backend is running on http://localhost:8000
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="app">
      <OfflineBanner />
      <div className="map-section">
        <FireMap layers={layers} mapRef={mapRef} data={data} onInsightsGenerated={setAiInsights} />
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
              Firebreak (holding)
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: "#dc2626" }} />
              Firebreak (at risk)
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: "#a855f7" }} />
              Power Line
            </div>
            <div className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: "#fbbf24", opacity: 0.4, border: "1px dashed #dc2626" }} />
              Downed Line Zone
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
              { key: "historical", label: "Past Fires (★ = Same Region)", color: "#f59e0b" },
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
          <span className="sidebar-count">{notifications.length}</span>
          Notifications
          {processingData && <span className="processing-pill">Processing...</span>}
        </div>

        <div className="sidebar-list">

          {(showAllNotifications ? notifications : notifications.slice(0, 3)).map((notification) => (
            <div
              key={notification.id}
              className={`notification-card notification-${notification.urgency}`}
            >
              <div className="notification-indicator" />
              <div className="notification-content">
                <div className="notification-text">
                  {notification.fact || notification.headline || 'No content'}
                </div>
                <div className="notification-time">
                  {notification.time_label}
                </div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && !processingData && (
            <div className="sidebar-empty">No notifications</div>
          )}
          {notifications.length > 3 && (
            <button
              className="show-more-btn"
              onClick={() => setShowAllNotifications(!showAllNotifications)}
            >
              {showAllNotifications ? '▲ Show Less' : `▼ Show ${notifications.length - 3} More`}
            </button>
          )}
        </div>
      </div>

      {recommendation && !dismissedRecommendation && (
        <div className="recommendation-card">
          <button
            className="recommendation-close"
            onClick={() => setDismissedRecommendation(true)}
            title="Dismiss recommendation"
          >
            ×
          </button>
          <div className="recommendation-header">
            <span className="recommendation-badge">RECOMMENDATION</span>
            <span className="recommendation-confidence">{recommendation.confidence_score}% confidence</span>
          </div>
          <div className="recommendation-action">
            {recommendation.action || recommendation.consideration || 'No action'}
          </div>
          {recommendation.rationale && (
            <div className="recommendation-rationale">
              {recommendation.rationale}
            </div>
          )}
          <div className="recommendation-time">
            {recommendation.time_label}
          </div>
        </div>
      )}
    </div>
  );
}
