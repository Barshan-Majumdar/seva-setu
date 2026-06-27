export const LANDING_STATS = [
  { value: '3', label: 'Workspaces Connected', detail: 'Field, coordination, and volunteer teams work from one shared record.' },
  { value: 'Top 3', label: 'Volunteer Matches', detail: 'Dispatch shortlists responders by distance, skills, availability, and reliability.' },
  { value: 'Offline', label: 'Field Reporting', detail: 'Reports can queue locally and sync when connectivity comes back.' },
  { value: 'GPS + AI', label: 'Trust Layer', detail: 'Location, timestamp, and image signals reduce fake or duplicate work.' },
];

export const PROBLEM_POINTS = [
  'WhatsApp threads bury the newest need under dozens of updates.',
  'Coordinators cannot tell which request is urgent, verified, or already assigned.',
  'Volunteers waste time asking where to go and what proof is needed.',
];

export const FEATURE_GROUPS = [
  {
    title: 'Verified Intake',
    description:
      'Field teams submit structured needs with location, category, people affected, and context even from low-connectivity areas.',
    points: ['GPS capture', 'Offline queue', 'Urgency preview'],
  },
  {
    title: 'Priority Intelligence',
    description:
      'Every need is scored so coordinators can triage medical, food, shelter, and disaster-zone cases without guesswork.',
    points: ['Weighted urgency score', 'Disaster-mode boost', 'Live status pipeline'],
  },
  {
    title: 'Smart Dispatch',
    description:
      'SevaSetu ranks nearby volunteers using geospatial distance, skill overlap, availability, and completion history.',
    points: ['PostGIS proximity', 'Skill matching', 'Coordinator assignment'],
  },
  {
    title: 'Proof of Resolution',
    description:
      'Volunteers check in, progress tasks, and close work with evidence so teams know help actually reached the ground.',
    points: ['GPS check-in', 'Image verification', 'Completion record'],
  },
];

export const ROLE_CARDS = [
  {
    title: 'Users',
    label: 'Report fast',
    description: 'Capture needs from affected communities with mobile-first forms, location, and offline safety.',
  },
  {
    title: 'Coordinators',
    label: 'Decide clearly',
    description: 'See heatmaps, urgency rankings, open tasks, and matched volunteers in a single command view.',
  },
  {
    title: 'Volunteers',
    label: 'Act confidently',
    description: 'Receive assigned missions, check in on arrival, and update completion without back-and-forth calls.',
  },
];

export const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'A need is captured',
    detail:
      'A field worker records what happened, where help is needed, how many people are affected, and the support category.',
  },
  {
    step: '02',
    title: 'The system prioritizes',
    detail:
      'Urgency scoring turns messy ground reports into a ranked queue that coordinators can trust during pressure.',
  },
  {
    step: '03',
    title: 'The right volunteer is matched',
    detail:
      'The matching engine compares distance, skills, availability, and reliability to recommend the best responders.',
  },
  {
    step: '04',
    title: 'Response is tracked live',
    detail:
      'Assignments move from open to assigned, in progress, and complete so every team sees the same operational truth.',
  },
  {
    step: '05',
    title: 'Closure is verified',
    detail:
      'GPS and image checks help confirm that work happened in the right place before it becomes a completed record.',
  },
];

export const TRUST_SIGNALS = [
  {
    title: 'Spatial Confidence',
    description: 'PostGIS distance checks keep reports and volunteer movement tied to real coordinates.',
  },
  {
    title: 'Photo Evidence',
    description: 'Camera, EXIF, OCR fallback, and CLIP validation help reduce spoofed completion claims.',
  },
  {
    title: 'Role-Based Access',
    description: 'Clerk authentication and coordinator whitelisting keep dispatch controls with authorized teams.',
  },
];

export const FAQ_ITEMS = [
  {
    question: 'Who is SevaSetu built for?',
    answer:
      'NGO coordinators, field workers, and volunteers who need one reliable place to report needs, dispatch help, and close tasks.',
  },
  {
    question: 'Does it work when the field team has poor internet?',
    answer:
      'Yes. The field reporting flow is designed as a PWA with an offline queue, then syncs reports when the network returns.',
  },
  {
    question: 'What makes the dispatch smarter than a spreadsheet?',
    answer:
      'The matching service weighs distance, skill overlap, volunteer availability, and completion rate instead of relying on manual sorting.',
  },
  {
    question: 'How does SevaSetu reduce false reports?',
    answer:
      'It combines GPS metadata, timestamp checks, image verification, and coordinator-controlled task states into a trust layer.',
  },
  {
    question: 'How much does SevaSetu cost?',
    answer:
      'SevaSetu is 100% free for NGOs and community relief teams. We believe that intelligence should be a public good during times of crisis.',
  },
];

