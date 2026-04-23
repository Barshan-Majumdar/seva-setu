const WEIGHTS = {
  medical: 4,
  food: 3,
  shelter: 2,
  education: 1,
  other: 1,
};

export const calculateUrgencyPreview = ({
  need_type,
  people_affected,
  is_disaster_zone,
  created_at,
}) => {
  let score = WEIGHTS[need_type] || 1;

  const peopleScore = Math.min(3, (Number(people_affected) || 0) / 50);
  score += peopleScore;

  const createdAt = created_at ? new Date(created_at) : new Date();
  const hoursSince = Math.abs(new Date() - createdAt) / 36e5;
  const timeScore = Math.min(2, hoursSince / 6);
  score += timeScore;

  if (is_disaster_zone) score += 1;

  return Number(Math.max(1, Math.min(10, score)).toFixed(2));
};
