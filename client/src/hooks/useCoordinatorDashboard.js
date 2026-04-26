import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchNeeds, fetchVolunteers, fetchTasks, fetchSystemStats } from '../services/dashboard';
import api from '../services/api';

export const useCoordinatorDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needs, setNeeds] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [systemStats, setSystemStats] = useState({ totalUsers: 0 });
  const [filters, setFilters] = useState({
    status: 'all',
    needType: 'all',
    district: 'all',
  });
  const [sorting, setSorting] = useState({ key: 'urgency_score', direction: 'desc' });
  const [selectedNeedId, setSelectedNeedId] = useState(null);
  
  const [matchModalNeed, setMatchModalNeed] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [assigningVolunteerId, setAssigningVolunteerId] = useState('');

  const [toast, setToast] = useState(null);
  const deletedIdsRef = useRef(new Set());

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadDashboard = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    if (isInitial) setError('');

    try {
      const [needsData, volunteersData, tasksData, statsData] = await Promise.all([
        fetchNeeds(),
        fetchVolunteers(),
        fetchTasks(),
        fetchSystemStats().catch((e) => {
          console.error("STATS FETCH FAIL:", e);
          return { totalUsers: 0 };
        })
      ]);
      
      console.log("DEBUG: Received system stats from server:", statsData);
      
      const filtered = (Array.isArray(needsData) ? needsData : [])
        .filter(need => !deletedIdsRef.current.has(need.id));

      setNeeds(filtered);
      setVolunteers(Array.isArray(volunteersData) ? volunteersData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setSystemStats(statsData || { totalUsers: 0 });
      
      if (isInitial) setError('');
    } catch (err) {
      console.error(err);
      if (isInitial) {
        setError(err?.response?.data?.message || 'Failed to load dashboard data.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    const interval = setInterval(() => loadDashboard(false), 5000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const districts = useMemo(() => {
    const all = new Set(needs.map((n) => n.district).filter(Boolean));
    return ['all', ...Array.from(all)];
  }, [needs]);

  const filteredNeeds = useMemo(() => {
    return needs.filter((need) => {
      if (need.status === 'archived' || need.status === 'rejected') return false;
      if (filters.status !== 'all' && need.status !== filters.status) return false;
      if (filters.needType !== 'all' && need.need_type !== filters.needType) return false;
      if (filters.district !== 'all' && need.district !== filters.district) return false;
      return true;
    });
  }, [filters, needs]);

  const sortedNeeds = useMemo(() => {
    const list = [...filteredNeeds];
    list.sort((a, b) => {
      const aVal = a[sorting.key];
      const bVal = b[sorting.key];
      if (aVal < bVal) return sorting.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredNeeds, sorting]);

  const pendingVolunteerRequests = systemStats.pendingVolunteerRequests || 0;

  const summary = useMemo(() => {
    const openNeeds = needs.filter((n) => n.status === 'open').length;
    const activeVolunteers = volunteers.filter((v) => v.is_available).length;
    const totalUsers = systemStats.totalUsers || 0;
    const completedToday = needs.filter((n) => n.status === 'completed').length;

    return { openNeeds, activeVolunteers, totalUsers, completedToday };
  }, [needs, volunteers, systemStats]);

  const openDispatchModal = (need) => setMatchModalNeed(need);
  const closeDispatchModal = () => setMatchModalNeed(null);

  useEffect(() => {
    const getMatches = async () => {
      if (!matchModalNeed) return;
      setMatchesLoading(true);
      try {
        const res = await api.get(`/needs/${matchModalNeed.id}/matches`);
        setMatches(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setMatchesLoading(false);
      }
    };
    getMatches();
  }, [matchModalNeed]);

  const assignVolunteer = async (volunteerId) => {
    if (!matchModalNeed) return;
    setAssigningVolunteerId(volunteerId);
    try {
      await api.post('/tasks', {
        need_id: matchModalNeed.id,
        volunteer_id: volunteerId,
      });
      showToast('Volunteer successfully assigned!');
      closeDispatchModal();
      await loadDashboard(false);
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to assign volunteer.', 'error');
    } finally {
      setAssigningVolunteerId('');
    }
  };

  const updatePipelineStatus = async (task, action) => {
    try {
      await api.patch(`/tasks/${task.id}/status`, { action });
      showToast(`Task ${action} successfully.`);
      await loadDashboard(false);
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const deleteNeed = (needId) => {
    deletedIdsRef.current.add(needId);
    setNeeds(prev => prev.filter(n => n.id !== needId));
    showToast('Issue permanently deleted.', 'success');
  };

  const setSort = (key) => {
    setSorting((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return {
    loading,
    error,
    summary,
    filters,
    setFilters,
    districts,
    sortedNeeds,
    selectedNeedId,
    setSelectedNeedId,
    sorting,
    setSort,
    tasks,
    matchModalNeed,
    matches,
    matchesLoading,
    assigningVolunteerId,
    openDispatchModal,
    closeDispatchModal,
    assignVolunteer,
    updatePipelineStatus,
    deleteNeed,
    toast,
    pendingVolunteerRequests,
  };
};
