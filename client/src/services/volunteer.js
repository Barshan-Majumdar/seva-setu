import api from './api';

export const fetchMyTasks = async () => {
  const { data } = await api.get('/tasks/my');
  return data;
};

export const fetchMyVolunteerStats = async () => {
  const { data } = await api.get('/volunteers/me/stats');
  return data;
};

export const updateAvailability = async (isAvailable) => {
  const { data } = await api.patch('/volunteers/me/availability', {
    is_available: isAvailable,
  });
  return data;
};

export const updateMyLocation = async ({ lat, lng }) => {
  const { data } = await api.patch('/volunteers/me/location', { lat, lng });
  return data;
};

export const checkInTaskById = async (taskId) => {
  const { data } = await api.patch(`/tasks/${taskId}/checkin`);
  return data;
};

export const completeTaskById = async (taskId) => {
  const { data } = await api.patch(`/tasks/${taskId}/complete`);
  return data;
};
