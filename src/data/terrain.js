// Fuel type zones around the fire area
export const fuelTypes = [
  {
    type: "Feature",
    properties: {
      fuelType: "grass",
      label: "Annual Grassland",
      color: "#c4d94e",
      fireRate: "Fast-moving, low intensity",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.12, 39.46],
          [-121.06, 39.46],
          [-121.04, 39.48],
          [-121.06, 39.50],
          [-121.10, 39.50],
          [-121.12, 39.48],
          [-121.12, 39.46],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      fuelType: "timber",
      label: "Mixed Conifer",
      color: "#2d6a2e",
      fireRate: "Moderate spread, high intensity",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.10, 39.50],
          [-121.06, 39.50],
          [-121.04, 39.52],
          [-121.02, 39.54],
          [-121.00, 39.56],
          [-121.04, 39.58],
          [-121.08, 39.58],
          [-121.10, 39.56],
          [-121.10, 39.50],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      fuelType: "dead_timber",
      label: "High Mortality Zone (60% dead)",
      color: "#8B4513",
      fireRate: "Extreme fire behavior, spotting risk",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.02, 39.54],
          [-120.98, 39.54],
          [-120.96, 39.56],
          [-120.96, 39.60],
          [-121.00, 39.62],
          [-121.04, 39.60],
          [-121.04, 39.58],
          [-121.02, 39.54],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      fuelType: "brush",
      label: "Manzanita/Chaparral",
      color: "#a07830",
      fireRate: "Fast-moving, very high intensity",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.04, 39.48],
          [-121.00, 39.48],
          [-120.98, 39.50],
          [-120.98, 39.54],
          [-121.02, 39.54],
          [-121.04, 39.52],
          [-121.06, 39.50],
          [-121.04, 39.48],
        ],
      ],
    },
  },
];

// Elevation reference points (for terrain context)
export const elevationPoints = [
  { lat: 39.48, lng: -121.08, elevation: 2200, label: "Valley Floor" },
  { lat: 39.52, lng: -121.05, elevation: 3400, label: "Fire Origin" },
  { lat: 39.56, lng: -121.00, elevation: 4800, label: "Timber Ridge" },
  { lat: 39.58, lng: -120.97, elevation: 5200, label: "Eagle Peak" },
  { lat: 39.54, lng: -121.03, elevation: 3900, label: "Saddle Point" },
];

// Ridge lines (important terrain features)
export const ridgeLines = [
  {
    type: "Feature",
    properties: { name: "Timber Ridge", elevation: 4800 },
    geometry: {
      type: "LineString",
      coordinates: [
        [-121.04, 39.56],
        [-121.02, 39.57],
        [-121.00, 39.58],
        [-120.98, 39.58],
      ],
    },
  },
  {
    type: "Feature",
    properties: { name: "South Ridge", elevation: 3600 },
    geometry: {
      type: "LineString",
      coordinates: [
        [-121.08, 39.49],
        [-121.06, 39.48],
        [-121.04, 39.48],
        [-121.02, 39.49],
      ],
    },
  },
];
