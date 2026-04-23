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
  if (value >= 8) return '#fb7185';
  if (value >= 5) return '#f59e0b';
  return '#34d399';
};
