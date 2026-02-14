export default function LayerControls({ layers, onToggle }) {
  const layerDefs = [
    { key: "fuel", label: "Fuel Types", color: "#2d6a2e" },
    { key: "firebreaks", label: "Firebreaks", color: "#16a34a" },
    { key: "communities", label: "Communities", color: "#6b7280" },
    { key: "water", label: "Water", color: "#3b82f6" },
    { key: "terrain", label: "Ridgelines", color: "#78716c" },
    { key: "historical", label: "Historical Fires", color: "#9ca3af" },
  ];

  return (
    <div className="layer-controls">
      {layerDefs.map(({ key, label, color }) => (
        <button
          key={key}
          className={`layer-btn ${layers[key] ? "active" : ""}`}
          onClick={() => onToggle(key)}
          style={{
            "--layer-color": color,
          }}
        >
          <span
            className="layer-dot"
            style={{ backgroundColor: layers[key] ? color : "transparent", borderColor: color }}
          />
          {label}
        </button>
      ))}
    </div>
  );
}
