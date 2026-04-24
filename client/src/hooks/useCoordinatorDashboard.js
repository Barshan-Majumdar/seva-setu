import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignVolunteerToNeed,
  checkInTask,
  completeTask,
  fetchNeedMatches,
  fetchNeeds,
  fetchTasks,
  fetchVolunteers,
  updateNeedStatus,
} from '../services/dashboard';

const initialFilters = {
  status: 'all',
  needType: 'all',
  district: 'all',
};

export const useCoordinatorDashboard = () => {
  const [needs, setNeeds] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedNeedId, setSelectedNeedId] = useState(null);
  const [sorting, setSorting] = useState({ key: 'urgency_score', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [matchModalNeed, setMatchModalNeed] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [assigningVolunteerId, setAssigningVolunteerId] = useState('');

  const [toast, setToast] = useState(null);

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
    setError('');

    try {
      const [needsData, volunteersData, tasksData] = await Promise.all([
        fetchNeeds(),
        fetchVolunteers(),
        fetchTasks(),
      ]);
      setNeeds(Array.isArray(needsData) ? needsData : []);
      setVolunteers(Array.isArray(volunteersData) ? volunteersData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard(true);
    });
  }, [loadDashboard]);

  const districts = useMemo(() => {
    const all = new Set(needs.map((n) => n.district).filter(Boolean));
    return ['all', ...Array.from(all)];
  }, [needs]);

  const filteredNeeds = useMemo(() => {
    return needs.filter((need) => {
      // Always exclude archived needs unless explicitly requested (which we don't have a filter for yet)
      if (need.status === 'archived') return false;
      
      if (filters.status !== 'all' && need.status !== filters.status) return false;
      if (filters.needType !== 'all' && need.need_type !== filters.needType) return false;
      if (filters.district !== 'all' && need.district !== filters.district) return false;
      return true;
    });
  }, [filters, needs]);

  const sortedNeeds = useMemo(() => {
    const list = [...filteredNeeds];
    const { key, direction } = sorting;

    list.sort((a, b) => {
      const left = a[key];
      const right = b[key];
      const factor = direction === 'asc' ? 1 : -1;

      if (key === 'created_at' || key === 'updated_at') {
        return (new Date(left).getTime() - new Date(right).getTime()) * factor;
      }

      if (typeof left === 'number' || typeof right === 'number') {
        return ((Number(left) || 0) - (Number(right) || 0)) * factor;
      }

      return String(left || '').localeCompare(String(right || '')) * factor;
    });

    return list;
  }, [filteredNeeds, sorting]);

  const summary = useMemo(() => {
    const openNeeds = needs.filter((n) => n.status === 'open').length;
    const activeVolunteers = volunteers.filter((v) => v.is_available).length;
    
    // Present workers = unique volunteers who have a task that is NOT completed
    const activeTasks = tasks.filter((t) => t.status === 'assigned' || t.status === 'in_progress');
    const presentWorkers = new Set(activeTasks.map(t => t.volunteer_id)).size;

    const today = new Date();
    const completedToday = needs.filter((n) => {
      if (n.status !== 'completed') return false;
      const d = new Date(n.updated_at || n.created_at);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    }).length;

    return { openNeeds, activeVolunteers, presentWorkers, completedToday };
  }, [needs, volunteers, tasks]);

  const setSort = (key) => {
    setSorting((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const openDispatchModal = async (need) => {
    setMatchModalNeed(need);
    setMatches([]);
    setMatchesLoading(true);
    setAssigningVolunteerId('');

    try {
      const ranked = await fetchNeedMatches(need.id);
      setMatches(Array.isArray(ranked) ? ranked : []);
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch volunteer matches.', 'error');
    } finally {
      setMatchesLoading(false);
    }
  };

  const closeDispatchModal = () => {
    setMatchModalNeed(null);
    setMatches([]);
    setAssigningVolunteerId('');
  };

  const assignVolunteer = async (volunteerId) => {
    if (!matchModalNeed) return;

    try {
      setAssigningVolunteerId(volunteerId);
      await assignVolunteerToNeed({ needId: matchModalNeed.id, volunteerId });
      await loadDashboard();
      closeDispatchModal();
      showToast('Volunteer assigned successfully.');
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Assignment failed.', 'error');
    } finally {
      setAssigningVolunteerId('');
    }
  };

  const updatePipelineStatus = async (task, action) => {
    // Optimistic update for archiving to ensure zero-lag UI
    if (action === 'archive') {
      setNeeds(prev => prev.map(n => n.id === task.need_id ? { ...n, status: 'archived' } : n));
    }

    try {
      if (action === 'checkin') {
        await checkInTask(task.task_id);
      } else if (action === 'complete') {
        await completeTask(task.task_id);
      } else if (action === 'reopen') {
        await updateNeedStatus({ needId: task.need_id, status: 'open' });
      } else if (action === 'archive') {
        await updateNeedStatus({ needId: task.need_id, status: 'archived' });
      }

      // Background refresh (silent)
      await loadDashboard(false);
      showToast(action === 'archive' ? 'Need archived.' : 'Task pipeline updated.');
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Could not update task status.', 'error');
    }
  };

  return {
    loading,
    error,
    needs,
    tasks,
    volunteers,
    summary,
    filters,
    setFilters,
    districts,
    sortedNeeds,
    selectedNeedId,
    setSelectedNeedId,
    sorting,
    setSort,
    matchModalNeed,
    matches,
    matchesLoading,
    assigningVolunteerId,
    openDispatchModal,
    closeDispatchModal,
    assignVolunteer,
    updatePipelineStatus,
    toast,
  };
};
