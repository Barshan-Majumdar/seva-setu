export const volunteerStatusLabel = (status) => {
  if (status === 'assigned') return 'Assigned';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return status;
};

export const volunteerStatusClass = (status) => {
  if (status === 'assigned') return 'volunteer-pill-assigned';
  if (status === 'in_progress') return 'volunteer-pill-in-progress';
  if (status === 'completed') return 'volunteer-pill-completed';
  return 'volunteer-pill-default';
};
