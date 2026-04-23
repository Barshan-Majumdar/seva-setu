export const DASHBOARD_METRICS = [
  { label: 'Open Cases', value: '214', delta: '+12 today' },
  { label: 'Assigned Teams', value: '86', delta: '91% utilization' },
  { label: 'Avg. First Response', value: '7m', delta: '-2m from last week' },
  { label: 'Closures (24h)', value: '173', delta: '82% SLA compliant' },
];

export const PRIORITY_QUEUE = [
  {
    id: 'REQ-1182',
    location: 'Kolkata, Ward 64',
    type: 'Medical',
    urgency: 'Critical',
    eta: '3 min dispatch window',
  },
  {
    id: 'REQ-1171',
    location: 'Howrah, Block 8',
    type: 'Shelter',
    urgency: 'High',
    eta: '8 min dispatch window',
  },
  {
    id: 'REQ-1164',
    location: 'Asansol, Sector C',
    type: 'Food',
    urgency: 'Medium',
    eta: '12 min dispatch window',
  },
];

export const ACTIVE_TEAMS = [
  { name: 'Rapid Care Unit A3', zone: 'Kolkata North', status: 'On Route' },
  { name: 'Community Relief Cell B1', zone: 'Howrah Urban', status: 'Verifying' },
  { name: 'Medical Support Group K9', zone: 'South 24 Parganas', status: 'Resolving' },
];

