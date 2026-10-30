export const formatElapsed = (isoString) => {
  if (!isoString) return 'N/A';

  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const urgencyColor = (score) => {
  const value = Number(score) || 0;
  if (value >= 70) return '#fb7185'; // Rose (Critical/Verified)
  if (value >= 40) return '#f59e0b'; // Amber (High)
  if (value >= 25) return '#fbbf24'; // Yellow (Elevated)
  return '#34d399'; // Emerald (Normal)
};

export const disasterColor = (type) => {
  const colors = {
    medical: '#f43f5e',   // Rose/Red
    food: '#0ea5e9',      // Sky/Blue
    shelter: '#f59e0b',   // Amber/Orange
    accidental: '#f97316', // Orange
    rescue: '#ef4444',    // Red
    education: '#8b5cf6', // Violet/Purple
    other: '#64748b'      // Slate/Gray
  };
  if (!type) return colors.other;
  if (typeof type === 'boolean') {
    return type ? '#ef4444' : colors.other;
  }
  if (typeof type === 'string') {
    const key = type.toLowerCase().trim();
    return colors[key] || colors.other;
  }
  return colors.other;
};
