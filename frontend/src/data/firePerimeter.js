// Current active fire perimeter - "Cedar Ridge Fire"
// Located in mountainous terrain near Hwy 89, Northern California foothills
export const currentFire = {
  name: "Cedar Ridge Fire",
  startDate: "2024-08-12",
  cause: "Lightning",
  acresBurned: 2840,
  containment: 22,
  center: [39.52, -121.05],
  // Fire perimeter polygon (irregular shape moving northeast)
  perimeter: {
    type: "Feature",
    properties: {
      name: "Cedar Ridge Fire",
      acres: 2840,
      containment: 22,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.08, 39.50],
          [-121.07, 39.49],
          [-121.055, 39.485],
          [-121.04, 39.49],
          [-121.025, 39.50],
          [-121.02, 39.515],
          [-121.015, 39.535],
          [-121.02, 39.55],
          [-121.03, 39.555],
          [-121.045, 39.555],
          [-121.06, 39.55],
          [-121.075, 39.54],
          [-121.085, 39.525],
          [-121.085, 39.51],
          [-121.08, 39.50],
        ],
      ],
    },
  },
  // Active fire front (northeast edge, where it's spreading)
  activeFront: {
    type: "Feature",
    properties: { type: "active_front" },
    geometry: {
      type: "LineString",
      coordinates: [
        [-121.02, 39.515],
        [-121.015, 39.535],
        [-121.02, 39.55],
        [-121.03, 39.555],
      ],
    },
  },
};

// Wind data
export const wind = {
  direction: 225, // degrees (from southwest)
  directionLabel: "SW",
  speed: 18, // mph
  gusts: 28, // mph
  forecastChange: "Winds shifting to W at 15mph by 1800hrs",
};

// Wind forecast — upcoming conditions (next 12h windows)
export const windForecast = [
  {
    time: "1800h",
    direction: 270,
    directionLabel: "W",
    speed: 15,
    gusts: 22,
    change: "direction", // direction shift
  },
  {
    time: "0200h",
    direction: 315,
    directionLabel: "NW",
    speed: 32,
    gusts: 45,
    change: "surge", // major speed increase
  },
];
