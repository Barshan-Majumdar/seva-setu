/**
 * shelterMockData.js
 * ------------------
 * Mock dataset for the Shelter Comparison feature.
 * 15 shelters with varied statuses, occupancies, and resource levels
 * so every UI state (OK / LOW / OUT, green / amber / red occupancy,
 * open / full / closing / closed pills) is exercised in the demo.
 *
 * When the real GET /api/shelters endpoint is built, swap MOCK_SHELTERS
 * for the API response — the shape is identical to the planned Prisma model.
 */

export const MOCK_SHELTERS = [
  {
    id: 'shl_001',
    name: 'Netaji High School',
    ward: 'Ward 7',
    district: 'South 24 Parganas',
    lat: 22.4707,
    lng: 88.3931,
    status: 'open',
    capacityTotal: 400,
    occupancyCurrent: 340,
    specialNeedsCount: 22,
    petsAllowed: true,
    petsCount: 8,
    resources: [
      { category: 'food', unit: 'meals', quantity: 600, dailyBurnRate: 340 },
      { category: 'water', unit: 'litres', quantity: 200, dailyBurnRate: 680 },
      { category: 'medical', unit: 'kits', quantity: 40, dailyBurnRate: 5 },
      { category: 'bedding', unit: 'mats', quantity: 340, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_01', type: 'sanitation', severity: 2, status: 'open' },
      { id: 'inc_02', type: 'medical_emergency', severity: 4, status: 'open' },
    ],
  },
  {
    id: 'shl_002',
    name: 'Rabindra Bhavan',
    ward: 'Ward 3',
    district: 'Kolkata',
    lat: 22.5726,
    lng: 88.3639,
    status: 'full',
    capacityTotal: 500,
    occupancyCurrent: 500,
    specialNeedsCount: 35,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 150, dailyBurnRate: 500 },
      { category: 'water', unit: 'litres', quantity: 0, dailyBurnRate: 1000 },
      { category: 'medical', unit: 'kits', quantity: 3, dailyBurnRate: 12 },
      { category: 'bedding', unit: 'mats', quantity: 500, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_03', type: 'overcrowding', severity: 5, status: 'open' },
    ],
  },
  {
    id: 'shl_003',
    name: 'Jadavpur Community Hall',
    ward: 'Ward 12',
    district: 'South 24 Parganas',
    lat: 22.4989,
    lng: 88.3697,
    status: 'open',
    capacityTotal: 250,
    occupancyCurrent: 60,
    specialNeedsCount: 4,
    petsAllowed: true,
    petsCount: 2,
    resources: [
      { category: 'food', unit: 'meals', quantity: 800, dailyBurnRate: 60 },
      { category: 'water', unit: 'litres', quantity: 500, dailyBurnRate: 120 },
      { category: 'medical', unit: 'kits', quantity: 30, dailyBurnRate: 2 },
      { category: 'bedding', unit: 'mats', quantity: 250, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_004',
    name: 'Salt Lake Stadium Annex',
    ward: 'Ward 1',
    district: 'North 24 Parganas',
    lat: 22.5645,
    lng: 88.4103,
    status: 'open',
    capacityTotal: 1000,
    occupancyCurrent: 870,
    specialNeedsCount: 65,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 400, dailyBurnRate: 870 },
      { category: 'water', unit: 'litres', quantity: 300, dailyBurnRate: 1740 },
      { category: 'medical', unit: 'kits', quantity: 80, dailyBurnRate: 15 },
      { category: 'bedding', unit: 'mats', quantity: 950, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_04', type: 'structural', severity: 3, status: 'open' },
      { id: 'inc_05', type: 'sanitation', severity: 2, status: 'open' },
      { id: 'inc_06', type: 'security', severity: 1, status: 'resolved' },
    ],
  },
  {
    id: 'shl_005',
    name: 'Behala Panchayat Bhavan',
    ward: 'Ward 18',
    district: 'South 24 Parganas',
    lat: 22.4591,
    lng: 88.3215,
    status: 'closing',
    capacityTotal: 150,
    occupancyCurrent: 30,
    specialNeedsCount: 5,
    petsAllowed: true,
    petsCount: 3,
    resources: [
      { category: 'food', unit: 'meals', quantity: 100, dailyBurnRate: 30 },
      { category: 'water', unit: 'litres', quantity: 80, dailyBurnRate: 60 },
      { category: 'medical', unit: 'kits', quantity: 10, dailyBurnRate: 1 },
      { category: 'bedding', unit: 'mats', quantity: 150, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_006',
    name: 'Barrackpore Cantonment Hall',
    ward: 'Ward 2',
    district: 'North 24 Parganas',
    lat: 22.7647,
    lng: 88.3784,
    status: 'open',
    capacityTotal: 300,
    occupancyCurrent: 290,
    specialNeedsCount: 18,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 50, dailyBurnRate: 290 },
      { category: 'water', unit: 'litres', quantity: 100, dailyBurnRate: 580 },
      { category: 'medical', unit: 'kits', quantity: 5, dailyBurnRate: 8 },
      { category: 'bedding', unit: 'mats', quantity: 300, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_07', type: 'medical_emergency', severity: 5, status: 'open' },
      { id: 'inc_08', type: 'overcrowding', severity: 3, status: 'open' },
    ],
  },
  {
    id: 'shl_007',
    name: 'Dum Dum Park Shelter',
    ward: 'Ward 5',
    district: 'North 24 Parganas',
    lat: 22.6232,
    lng: 88.4192,
    status: 'open',
    capacityTotal: 200,
    occupancyCurrent: 120,
    specialNeedsCount: 10,
    petsAllowed: true,
    petsCount: 5,
    resources: [
      { category: 'food', unit: 'meals', quantity: 400, dailyBurnRate: 120 },
      { category: 'water', unit: 'litres', quantity: 350, dailyBurnRate: 240 },
      { category: 'medical', unit: 'kits', quantity: 25, dailyBurnRate: 3 },
      { category: 'bedding', unit: 'mats', quantity: 200, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_008',
    name: 'Howrah Municipal School',
    ward: 'Ward 9',
    district: 'Howrah',
    lat: 22.5958,
    lng: 88.2636,
    status: 'open',
    capacityTotal: 350,
    occupancyCurrent: 280,
    specialNeedsCount: 20,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 250, dailyBurnRate: 280 },
      { category: 'water', unit: 'litres', quantity: 150, dailyBurnRate: 560 },
      { category: 'medical', unit: 'kits', quantity: 0, dailyBurnRate: 10 },
      { category: 'bedding', unit: 'mats', quantity: 320, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_09', type: 'medical_emergency', severity: 4, status: 'open' },
    ],
  },
  {
    id: 'shl_009',
    name: 'Tollygunge Club Grounds',
    ward: 'Ward 15',
    district: 'Kolkata',
    lat: 22.4983,
    lng: 88.3476,
    status: 'closed',
    capacityTotal: 180,
    occupancyCurrent: 0,
    specialNeedsCount: 0,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 0, dailyBurnRate: 0 },
      { category: 'water', unit: 'litres', quantity: 0, dailyBurnRate: 0 },
      { category: 'medical', unit: 'kits', quantity: 0, dailyBurnRate: 0 },
      { category: 'bedding', unit: 'mats', quantity: 80, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_010',
    name: 'New Town Eco Park Pavilion',
    ward: 'Ward 4',
    district: 'North 24 Parganas',
    lat: 22.6021,
    lng: 88.4621,
    status: 'open',
    capacityTotal: 600,
    occupancyCurrent: 410,
    specialNeedsCount: 30,
    petsAllowed: true,
    petsCount: 12,
    resources: [
      { category: 'food', unit: 'meals', quantity: 900, dailyBurnRate: 410 },
      { category: 'water', unit: 'litres', quantity: 800, dailyBurnRate: 820 },
      { category: 'medical', unit: 'kits', quantity: 60, dailyBurnRate: 8 },
      { category: 'bedding', unit: 'mats', quantity: 580, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_10', type: 'security', severity: 2, status: 'open' },
    ],
  },
  {
    id: 'shl_011',
    name: 'Baranagar Sanskrit College',
    ward: 'Ward 6',
    district: 'North 24 Parganas',
    lat: 22.6413,
    lng: 88.3765,
    status: 'open',
    capacityTotal: 120,
    occupancyCurrent: 115,
    specialNeedsCount: 8,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 30, dailyBurnRate: 115 },
      { category: 'water', unit: 'litres', quantity: 40, dailyBurnRate: 230 },
      { category: 'medical', unit: 'kits', quantity: 2, dailyBurnRate: 4 },
      { category: 'bedding', unit: 'mats', quantity: 120, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_11', type: 'sanitation', severity: 3, status: 'open' },
      { id: 'inc_12', type: 'overcrowding', severity: 4, status: 'open' },
    ],
  },
  {
    id: 'shl_012',
    name: 'Garia Sports Complex',
    ward: 'Ward 14',
    district: 'South 24 Parganas',
    lat: 22.4650,
    lng: 88.3842,
    status: 'open',
    capacityTotal: 450,
    occupancyCurrent: 200,
    specialNeedsCount: 12,
    petsAllowed: true,
    petsCount: 6,
    resources: [
      { category: 'food', unit: 'meals', quantity: 1200, dailyBurnRate: 200 },
      { category: 'water', unit: 'litres', quantity: 900, dailyBurnRate: 400 },
      { category: 'medical', unit: 'kits', quantity: 50, dailyBurnRate: 4 },
      { category: 'bedding', unit: 'mats', quantity: 430, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_013',
    name: 'Shibpur Engineering Hostel',
    ward: 'Ward 11',
    district: 'Howrah',
    lat: 22.5589,
    lng: 88.3103,
    status: 'open',
    capacityTotal: 280,
    occupancyCurrent: 275,
    specialNeedsCount: 14,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 100, dailyBurnRate: 275 },
      { category: 'water', unit: 'litres', quantity: 0, dailyBurnRate: 550 },
      { category: 'medical', unit: 'kits', quantity: 15, dailyBurnRate: 6 },
      { category: 'bedding', unit: 'mats', quantity: 280, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_13', type: 'structural', severity: 4, status: 'open' },
    ],
  },
  {
    id: 'shl_014',
    name: 'Dakshineswar Temple Grounds',
    ward: 'Ward 8',
    district: 'North 24 Parganas',
    lat: 22.6553,
    lng: 88.3575,
    status: 'closing',
    capacityTotal: 220,
    occupancyCurrent: 45,
    specialNeedsCount: 3,
    petsAllowed: true,
    petsCount: 1,
    resources: [
      { category: 'food', unit: 'meals', quantity: 200, dailyBurnRate: 45 },
      { category: 'water', unit: 'litres', quantity: 150, dailyBurnRate: 90 },
      { category: 'medical', unit: 'kits', quantity: 20, dailyBurnRate: 1 },
      { category: 'bedding', unit: 'mats', quantity: 220, dailyBurnRate: 0 },
    ],
    incidents: [],
  },
  {
    id: 'shl_015',
    name: 'Sealdah Relief Camp',
    ward: 'Ward 10',
    district: 'Kolkata',
    lat: 22.5653,
    lng: 88.3700,
    status: 'full',
    capacityTotal: 320,
    occupancyCurrent: 320,
    specialNeedsCount: 28,
    petsAllowed: false,
    petsCount: 0,
    resources: [
      { category: 'food', unit: 'meals', quantity: 0, dailyBurnRate: 320 },
      { category: 'water', unit: 'litres', quantity: 50, dailyBurnRate: 640 },
      { category: 'medical', unit: 'kits', quantity: 1, dailyBurnRate: 10 },
      { category: 'bedding', unit: 'mats', quantity: 310, dailyBurnRate: 0 },
    ],
    incidents: [
      { id: 'inc_14', type: 'medical_emergency', severity: 5, status: 'open' },
      { id: 'inc_15', type: 'overcrowding', severity: 5, status: 'open' },
      { id: 'inc_16', type: 'sanitation', severity: 3, status: 'open' },
    ],
  },
];

/**
 * Derives OK / LOW / OUT per resource category from quantity vs dailyBurnRate.
 * Mirrors the real backend logic already spec'd (daily_burn_rate low-stock projection)
 * so swapping mock data for a real API response is a drop-in replacement.
 *
 * Rules:
 *  - OUT  → quantity <= 0
 *  - LOW  → quantity / dailyBurnRate < 1 (less than 1 day runway)
 *           treat dailyBurnRate === 0 as never LOW/OUT (non-consumable, e.g. bedding)
 *  - OK   → otherwise
 *
 * @param {object} shelter — a shelter object from MOCK_SHELTERS
 * @returns {object[]} — array of { category, status, quantity, dailyBurnRate, hoursRemaining }
 */
export function getShelterNeeds(shelter) {
  return (shelter.resources || []).map((res) => {
    let status = 'ok';
    let hoursRemaining = null;

    if (res.quantity <= 0) {
      status = 'out';
      hoursRemaining = 0;
    } else if (res.dailyBurnRate > 0) {
      const daysRemaining = res.quantity / res.dailyBurnRate;
      hoursRemaining = Math.round(daysRemaining * 24);
      if (daysRemaining < 1) {
        status = 'low';
      }
    }

    return {
      category: res.category,
      status,
      quantity: res.quantity,
      dailyBurnRate: res.dailyBurnRate,
      hoursRemaining,
    };
  });
}

/** Emoji icons for resource categories */
export const RESOURCE_ICONS = {
  food: '🍚',
  water: '🚰',
  medical: '🩹',
  bedding: '🛏️',
};

/**
 * Returns the count of open incidents for a shelter.
 */
export function getOpenIncidentCount(shelter) {
  return (shelter.incidents || []).filter((i) => i.status === 'open').length;
}

/**
 * Returns the occupancy percentage (0–100+).
 */
export function getOccupancyPercent(shelter) {
  if (!shelter.capacityTotal || shelter.capacityTotal === 0) return 0;
  return Math.round((shelter.occupancyCurrent / shelter.capacityTotal) * 100);
}

/**
 * Returns a color key for occupancy: 'green' (<70%), 'amber' (70-95%), 'red' (>95%).
 */
export function getOccupancyColor(percent) {
  if (percent > 95) return 'red';
  if (percent >= 70) return 'amber';
  return 'green';
}
