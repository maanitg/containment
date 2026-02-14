// Communities in the area
export const communities = [
  {
    name: "Pinecrest",
    population: 450,
    lat: 39.56,
    lng: -120.98,
    evacuationStatus: "Warning",
    accessRoads: ["Hwy 89", "Pine Creek Rd"],
    shelterCapacity: 200,
  },
  {
    name: "Cedar Flat",
    population: 1200,
    lat: 39.48,
    lng: -121.10,
    evacuationStatus: "None",
    accessRoads: ["Hwy 89", "Cedar Flat Rd"],
    shelterCapacity: 500,
  },
  {
    name: "Ridgeview",
    population: 180,
    lat: 39.54,
    lng: -120.94,
    evacuationStatus: "Order",
    accessRoads: ["Ridge Rd (single access)"],
    shelterCapacity: 0,
  },
  {
    name: "Mill Creek",
    population: 320,
    lat: 39.50,
    lng: -120.92,
    evacuationStatus: "None",
    accessRoads: ["Mill Creek Rd", "County Rd 42"],
    shelterCapacity: 150,
  },
  {
    name: "Summit Meadows",
    population: 85,
    lat: 39.60,
    lng: -121.02,
    evacuationStatus: "None",
    accessRoads: ["Summit Rd"],
    shelterCapacity: 0,
  },
  {
    name: "Oakdale Junction",
    population: 2100,
    lat: 39.44,
    lng: -121.08,
    evacuationStatus: "None",
    accessRoads: ["Hwy 89", "Hwy 70", "Oakdale Blvd"],
    shelterCapacity: 800,
  },
];

// Firebreaks
export const firebreaks = [
  {
    name: "Johnson Creek Fuel Break",
    width: 200, // feet
    type: "Maintained shaded fuel break",
    lastMaintained: 2023,
    condition: "Good",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.01, 39.53],
          [-121.00, 39.54],
          [-120.99, 39.555],
          [-120.98, 39.56],
        ],
      },
    },
  },
  {
    name: "Miller Road Dozer Line",
    width: 30, // feet
    type: "Dozer line (from 2018 Basin Fire)",
    lastMaintained: 2018,
    condition: "Degraded - partial regrowth",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.06, 39.52],
          [-121.04, 39.53],
          [-121.03, 39.545],
          [-121.02, 39.55],
        ],
      },
    },
  },
  {
    name: "Hwy 89 Corridor",
    width: 120, // feet
    type: "Road corridor with cleared shoulders",
    lastMaintained: 2024,
    condition: "Good",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.12, 39.46],
          [-121.10, 39.48],
          [-121.08, 39.50],
          [-121.06, 39.52],
          [-121.04, 39.54],
          [-121.02, 39.56],
          [-121.00, 39.58],
        ],
      },
    },
  },
  {
    name: "Timber Ridge Fuel Reduction Project",
    width: 300, // feet
    type: "Prescribed burn + mechanical thinning",
    lastMaintained: 2022,
    condition: "Good - reduced fuel load",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.04, 39.56],
          [-121.02, 39.57],
          [-121.00, 39.575],
          [-120.98, 39.58],
        ],
      },
    },
  },
];

// Water resources
export const waterResources = [
  {
    name: "Johnson Creek",
    type: "creek",
    flow: "Seasonal - low flow",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.08, 39.53],
          [-121.06, 39.535],
          [-121.04, 39.54],
          [-121.02, 39.545],
          [-121.00, 39.55],
          [-120.98, 39.555],
        ],
      },
    },
  },
  {
    name: "Mill Creek",
    type: "river",
    flow: "Year-round, moderate flow",
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.00, 39.44],
          [-120.98, 39.46],
          [-120.96, 39.48],
          [-120.94, 39.50],
          [-120.92, 39.50],
        ],
      },
    },
  },
  {
    name: "Cedar Reservoir",
    type: "pond",
    capacity: "50,000 gallons",
    lat: 39.49,
    lng: -121.07,
    dippable: true,
  },
  {
    name: "Summit Lake",
    type: "lake",
    capacity: "Helicopter accessible",
    lat: 39.59,
    lng: -121.01,
    dippable: true,
  },
  {
    name: "Pine Creek Hydrant System",
    type: "hydrant",
    lat: 39.555,
    lng: -120.985,
    note: "Municipal hydrant system - 5 hydrants along Pine Creek Rd",
  },
];
