// Historical fires within 5 miles of current fire
export const historicalFires = [
  {
    name: "Basin Fire",
    year: 2018,
    acres: 1250,
    cause: "Lightning",
    containedInDays: 4,
    suppressionTactics: [
      "Dozer line constructed along Miller Road",
      "Backfire from Timber Ridge",
      "Air tanker drops on northeast flank",
    ],
    keyLesson:
      "Miller Road dozer line was critical containment feature on west side",
    perimeter: {
      type: "Feature",
      properties: {
        name: "Basin Fire (2018)",
        acres: 1250,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-121.06, 39.52],
            [-121.05, 39.51],
            [-121.04, 39.51],
            [-121.03, 39.515],
            [-121.025, 39.525],
            [-121.02, 39.54],
            [-121.03, 39.545],
            [-121.04, 39.545],
            [-121.05, 39.54],
            [-121.06, 39.53],
            [-121.06, 39.52],
          ],
        ],
      },
    },
  },
  {
    name: "Pine Creek Fire",
    year: 2020,
    acres: 680,
    cause: "Equipment",
    containedInDays: 3,
    suppressionTactics: [
      "Anchor point at Cedar Reservoir",
      "Hand line along Johnson Creek",
      "Structure protection for Pinecrest",
    ],
    keyLesson:
      "Johnson Creek fuel break held effectively; Pinecrest evacuation took 4 hours via Hwy 89",
    perimeter: {
      type: "Feature",
      properties: {
        name: "Pine Creek Fire (2020)",
        acres: 680,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-121.02, 39.52],
            [-121.01, 39.515],
            [-121.00, 39.52],
            [-120.99, 39.535],
            [-121.00, 39.55],
            [-121.01, 39.545],
            [-121.02, 39.54],
            [-121.02, 39.52],
          ],
        ],
      },
    },
  },
  {
    name: "Eagle Complex",
    year: 2015,
    acres: 4200,
    cause: "Lightning (multiple starts)",
    containedInDays: 12,
    suppressionTactics: [
      "Burnout operations from Timber Ridge",
      "Evacuation of Ridgeview (8 hours - single road)",
      "Helicopter bucket drops from Summit Lake",
      "Mutual aid from 3 neighboring forests",
    ],
    keyLesson:
      "Ridgeview single-access road caused dangerous evacuation delays; dead timber zone produced extreme fire behavior with 1-mile spotting",
    perimeter: {
      type: "Feature",
      properties: {
        name: "Eagle Complex (2015)",
        acres: 4200,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-121.04, 39.54],
            [-121.02, 39.52],
            [-120.98, 39.52],
            [-120.94, 39.54],
            [-120.94, 39.58],
            [-120.96, 39.62],
            [-121.00, 39.62],
            [-121.04, 39.60],
            [-121.04, 39.54],
          ],
        ],
      },
    },
  },
];
