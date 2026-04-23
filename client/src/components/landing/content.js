export const LANDING_STATS = [
  { value: '3.3M+', label: 'Civil Organizations Reach' },
  { value: '< 5 min', label: 'Average Dispatch Time' },
  { value: '98%', label: 'Match Confidence' },
  { value: '24/7', label: 'Operational Readiness' },
];

export const FEATURE_GROUPS = [
  {
    title: 'Signal Intake',
    description:
      'Reports from field teams are ingested with location, severity, and context so coordinators can act with full visibility.',
    points: ['Geo-lock validation', 'Auto-priority scoring', 'Duplicate detection'],
  },
  {
    title: 'Smart Routing',
    description:
      'A weighted dispatch engine maps needs to the closest capable responders based on skills, load, and travel constraints.',
    points: ['Radius-based matching', 'Responder confidence score', 'Live reassignment'],
  },
  {
    title: 'Execution Layer',
    description:
      'Command teams track status transitions, SLA clocks, and proof-of-resolution in one synchronized command surface.',
    points: ['SLA guardrails', 'Team handoff timeline', 'Verified completion log'],
  },
];

export const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Capture need from the field',
    detail:
      'A field worker submits a structured request with location and urgency context in under a minute.',
  },
  {
    step: '02',
    title: 'Rank and broadcast',
    detail:
      'The system computes severity and immediately alerts the most relevant NGO and volunteer clusters.',
  },
  {
    step: '03',
    title: 'Deploy and coordinate',
    detail:
      'Responders accept assignments, receive movement guidance, and update operations in real time.',
  },
  {
    step: '04',
    title: 'Verify and learn',
    detail:
      'Resolution evidence is confirmed and fed back to improve future routing confidence.',
  },
];

