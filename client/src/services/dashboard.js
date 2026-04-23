import api from './api';

export const fetchNeeds = async () => {
  const { data } = await api.get('/needs');
  return data;
};

export const fetchVolunteers = async () => {
  const { data } = await api.get('/volunteers');
  return data;
};

export const fetchTasks = async () => {
  const { data } = await api.get('/tasks');
  return data;
};

export const fetchNeedMatches = async (needId) => {
  const { data } = await api.get(`/needs/${needId}/matches`);
  return data;
};

export const assignVolunteerToNeed = async ({ needId, volunteerId }) => {
  const { data } = await api.post('/tasks', {
    need_id: needId,
    assigned_volunteer_id: volunteerId,
    notes: 'Assigned from coordinator dashboard',
  });
  return data;
};

export const updateNeedStatus = async ({ needId, status }) => {
  const { data } = await api.patch(`/needs/${needId}/status`, { status });
  return data;
};

export const checkInTask = async (taskId) => {
  const { data } = await api.patch(`/tasks/${taskId}/checkin`);
  return data;
};

export const completeTask = async (taskId) => {
  const { data } = await api.patch(`/tasks/${taskId}/complete`);
  return data;
};
