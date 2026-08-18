import { v4 as uuidv4 } from 'uuid';

/**
 * MOCK VOLUNTEERS
 * Represents a subset of registered volunteers available for assignment.
 */
export const mockVolunteers = [
  { id: 'v1', name: 'Rahul Sharma', skills: ['medical', 'first_aid'] },
  { id: 'v2', name: 'Priya Patel', skills: ['logistics', 'coordination'] },
  { id: 'v3', name: 'Amit Kumar', skills: ['security', 'heavy_lifting'] },
  { id: 'v4', name: 'Neha Singh', skills: ['counseling', 'childcare'] },
  { id: 'v5', name: 'Vikram Malhotra', skills: ['medical', 'doctor'] },
  { id: 'v6', name: 'Anjali Desai', skills: ['food_service', 'logistics'] },
  { id: 'v7', name: 'Rohan Gupta', skills: ['technology', 'communications'] },
  { id: 'v8', name: 'Sneha Reddy', skills: ['first_aid', 'search_and_rescue'] },
];

/**
 * INITIAL SHELTERS
 * Represents the current state of shelters across the disaster zone.
 */
export const initialShelters = [
  {
    id: 'sh-1',
    name: 'Govt. Boys Senior Secondary School',
    state: 'Delhi',
    district: 'New Delhi',
    ward: 'Connaught Place',
    address: 'Main Bazar Road, Near Old Post Office',
    lat: 28.6139 + 0.01,
    lng: 77.2090 + 0.01,
    status: 'open',
    capacityTotal: 400,
    occupancyCurrent: 120,
    specialNeedsCount: 15,
    petsAllowed: false,
    petsCount: 0,
    managerName: 'Sanjay Verma',
    managerContact: '+91 9876543210',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-1-1', category: 'food', unit: 'meals', quantity: 800, dailyBurnRate: 360, lastRestockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'r-1-2', category: 'water', unit: 'litres', quantity: 1200, dailyBurnRate: 600, lastRestockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'r-1-3', category: 'medical', unit: 'kits', quantity: 50, dailyBurnRate: 5, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'r-1-4', category: 'bedding', unit: 'blankets', quantity: 450, dailyBurnRate: 0, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-1-1', count: 50, reportedBy: 'u-1', reportedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-1-2', count: 90, reportedBy: 'u-1', reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-1-3', count: 120, reportedBy: 'u-2', reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [
      { id: 'inc-1-1', type: 'medical_emergency', description: 'Elderly patient required immediate asthma nebulization', severity: 3, status: 'resolved', createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString() }
    ],
    staffing: [
      { volunteerId: 'v2', role: 'Shelter Manager' },
      { volunteerId: 'v1', role: 'Medical Lead' }
    ]
  },
  {
    id: 'sh-2',
    name: 'Community Center, Sector 14',
    state: 'Haryana',
    district: 'Gurugram',
    ward: 'Sector 14',
    address: 'Park Avenue, Near Lake',
    lat: 28.4595,
    lng: 77.0266,
    status: 'full',
    capacityTotal: 250,
    occupancyCurrent: 255,
    specialNeedsCount: 30,
    petsAllowed: true,
    petsCount: 12,
    managerName: 'Kavita Joshi',
    managerContact: '+91 9876543211',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-2-1', category: 'food', unit: 'meals', quantity: 150, dailyBurnRate: 750, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'r-2-2', category: 'water', unit: 'litres', quantity: 300, dailyBurnRate: 1250, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'r-2-3', category: 'sanitation', unit: 'kits', quantity: 20, dailyBurnRate: 15, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-2-1', count: 100, reportedBy: 'u-3', reportedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-2-2', count: 200, reportedBy: 'u-3', reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-2-3', count: 255, reportedBy: 'u-4', reportedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [
      { id: 'inc-2-1', type: 'resource_shortage', description: 'Running critically low on drinking water for tonight', severity: 4, status: 'open', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
      { id: 'inc-2-2', type: 'sanitation', description: 'Two portable toilets are blocked', severity: 2, status: 'open', createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() }
    ],
    staffing: [
      { volunteerId: 'v4', role: 'Counselor' }
    ]
  },
  {
    id: 'sh-3',
    name: 'City Sports Stadium',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    ward: 'Andheri West',
    address: 'Stadium Road',
    lat: 19.1136,
    lng: 72.8697,
    status: 'open',
    capacityTotal: 1200,
    occupancyCurrent: 350,
    specialNeedsCount: 40,
    petsAllowed: true,
    petsCount: 45,
    managerName: 'Ramesh Singh',
    managerContact: '+91 9876543212',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-3-1', category: 'food', unit: 'meals', quantity: 5000, dailyBurnRate: 1050, lastRestockedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
      { id: 'r-3-2', category: 'water', unit: 'litres', quantity: 10000, dailyBurnRate: 1750, lastRestockedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
      { id: 'r-3-3', category: 'medical', unit: 'kits', quantity: 200, dailyBurnRate: 20, lastRestockedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
      { id: 'r-3-4', category: 'clothing', unit: 'sets', quantity: 500, dailyBurnRate: 50, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-3-1', count: 150, reportedBy: 'u-5', reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-3-2', count: 350, reportedBy: 'u-5', reportedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [],
    staffing: [
      { volunteerId: 'v3', role: 'Security Head' },
      { volunteerId: 'v5', role: 'Chief Medical Officer' }
    ]
  },
  {
    id: 'sh-4',
    name: 'St. Mary\'s Convent School',
    state: 'Maharashtra',
    district: 'Pune',
    ward: 'Camp',
    address: 'Hill Cart Road',
    lat: 18.5204,
    lng: 73.8567,
    status: 'open',
    capacityTotal: 600,
    occupancyCurrent: 510,
    specialNeedsCount: 80,
    petsAllowed: false,
    petsCount: 0,
    managerName: 'Sister Agatha',
    managerContact: '+91 9876543213',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-4-1', category: 'food', unit: 'meals', quantity: 1200, dailyBurnRate: 1530, lastRestockedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { id: 'r-4-2', category: 'water', unit: 'litres', quantity: 4000, dailyBurnRate: 2550, lastRestockedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { id: 'r-4-3', category: 'medical', unit: 'kits', quantity: 15, dailyBurnRate: 30, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'r-4-4', category: 'bedding', unit: 'blankets', quantity: 600, dailyBurnRate: 0, lastRestockedAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-4-1', count: 200, reportedBy: 'u-6', reportedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-4-2', count: 350, reportedBy: 'u-6', reportedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-4-3', count: 450, reportedBy: 'u-7', reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-4-4', count: 510, reportedBy: 'u-6', reportedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [
      { id: 'inc-4-1', type: 'medical_emergency', description: 'Outbreak of mild fever among children', severity: 4, status: 'open', createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }
    ],
    staffing: [
      { volunteerId: 'v8', role: 'First Responder' }
    ]
  },
  {
    id: 'sh-5',
    name: 'Railway Institute',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    ward: 'Yeshwanthpur',
    address: 'Loco Colony',
    lat: 13.0285,
    lng: 77.5409,
    status: 'closing',
    capacityTotal: 150,
    occupancyCurrent: 35,
    specialNeedsCount: 2,
    petsAllowed: false,
    petsCount: 0,
    managerName: 'Arun Das',
    managerContact: '+91 9876543214',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-5-1', category: 'food', unit: 'meals', quantity: 200, dailyBurnRate: 105, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'r-5-2', category: 'water', unit: 'litres', quantity: 500, dailyBurnRate: 175, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-5-1', count: 140, reportedBy: 'u-8', reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-5-2', count: 90, reportedBy: 'u-8', reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-5-3', count: 35, reportedBy: 'u-8', reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [],
    staffing: []
  },
  {
    id: 'sh-6',
    name: 'Town Hall',
    state: 'Delhi',
    district: 'Central Delhi',
    ward: 'Chandni Chowk',
    address: 'Heritage Square',
    lat: 28.6562,
    lng: 77.2315,
    status: 'closed',
    capacityTotal: 300,
    occupancyCurrent: 0,
    specialNeedsCount: 0,
    petsAllowed: false,
    petsCount: 0,
    managerName: 'Deepak Chopra',
    managerContact: '+91 9876543215',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [],
    occupancyLogs: [
      { id: 'ol-6-1', count: 280, reportedBy: 'u-9', reportedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-6-2', count: 0, reportedBy: 'u-9', reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [],
    staffing: []
  },
  {
    id: 'sh-7',
    name: 'Gurudwara Singh Sabha',
    state: 'Punjab',
    district: 'Amritsar',
    ward: 'Golden Temple Road',
    address: 'Market Road',
    lat: 31.6200,
    lng: 74.8765,
    status: 'open',
    capacityTotal: 800,
    occupancyCurrent: 650,
    specialNeedsCount: 120,
    petsAllowed: false,
    petsCount: 0,
    managerName: 'Harjit Singh',
    managerContact: '+91 9876543216',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-7-1', category: 'food', unit: 'meals', quantity: 15000, dailyBurnRate: 1950, lastRestockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'r-7-2', category: 'water', unit: 'litres', quantity: 8000, dailyBurnRate: 3250, lastRestockedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'r-7-3', category: 'bedding', unit: 'blankets', quantity: 800, dailyBurnRate: 0, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
    ],
    occupancyLogs: [
      { id: 'ol-7-1', count: 400, reportedBy: 'u-10', reportedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-7-2', count: 650, reportedBy: 'u-10', reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [
      { id: 'inc-7-1', type: 'security', description: 'Minor altercation at food distribution line', severity: 1, status: 'resolved', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    ],
    staffing: [
      { volunteerId: 'v6', role: 'Kitchen Coordinator' }
    ]
  },
  {
    id: 'sh-8',
    name: 'National College Campus',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    ward: 'Koramangala',
    address: 'University Boulevard',
    lat: 12.9279,
    lng: 77.6271,
    status: 'open',
    capacityTotal: 1500,
    occupancyCurrent: 400,
    specialNeedsCount: 20,
    petsAllowed: true,
    petsCount: 85,
    managerName: 'Dr. Anita Roy',
    managerContact: '+91 9876543217',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    resources: [
      { id: 'r-8-1', category: 'food', unit: 'meals', quantity: 4000, dailyBurnRate: 1200, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'r-8-2', category: 'water', unit: 'litres', quantity: 5000, dailyBurnRate: 2000, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'r-8-3', category: 'sanitation', unit: 'kits', quantity: 150, dailyBurnRate: 50, lastRestockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'r-8-4', category: 'fuel', unit: 'litres', quantity: 100, dailyBurnRate: 80, lastRestockedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }, // Critical
    ],
    occupancyLogs: [
      { id: 'ol-8-1', count: 100, reportedBy: 'u-11', reportedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
      { id: 'ol-8-2', count: 400, reportedBy: 'u-11', reportedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ],
    incidents: [],
    staffing: [
      { volunteerId: 'v7', role: 'IT Setup' }
    ]
  }
];
