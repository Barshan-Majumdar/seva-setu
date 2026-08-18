import { useState, useCallback, useMemo } from 'react';
import {
  MOCK_SHELTERS,
  getShelterNeeds,
  getOpenIncidentCount,
  getOccupancyPercent,
} from '../components/dashboard/shelters/shelterMockData';

/**
 * useShelterDashboard
 * --------------------
 * Plain custom hook that owns all state for the Shelter Comparison feature.
 * Follows the useCoordinatorDashboard.js pattern exactly:
 *   - called once in ShelterDashboardPage.jsx
 *   - destructured, passed as props to every child component
 *   - no Context/Provider wrapper
 *
 * TODO: When the real GET /api/shelters endpoint is built, replace MOCK_SHELTERS
 * with a useEffect + fetchShelters() call (same pattern as loadDashboard in
 * useCoordinatorDashboard). All downstream components remain unchanged.
 */
export const useShelterDashboard = () => {
  // ── Selection state ──────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // ── Sorting state (for the list table) ───────────────────────
  const [sorting, setSorting] = useState({ key: 'name', direction: 'asc' });

  // ── Compare-view sorting (independent of list sort) ──────────
  const [compareSortKey, setCompareSortKey] = useState('occupancy');

  // ── Max-10 warning state (inline in tray, not Toast) ─────────
  const [maxWarning, setMaxWarning] = useState(false);

  const isMaxed = selectedIds.length >= 10;

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setMaxWarning(false);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 10) {
        setMaxWarning(true);
        setTimeout(() => setMaxWarning(false), 3000);
        return prev; // no-op — blocked
      }
      return [...prev, id];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setMaxWarning(false);
  }, []);

  const openCompare = useCallback(() => setIsCompareOpen(true), []);
  const closeCompare = useCallback(() => setIsCompareOpen(false), []);

  // ── Table sort toggle (same pattern as useCoordinatorDashboard setSort) ──
  const setSort = useCallback((key) => {
    setSorting((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // ── Sorted shelters for the list ─────────────────────────────
  const sortedShelters = useMemo(() => {
    const list = [...MOCK_SHELTERS];
    list.sort((a, b) => {
      let aVal, bVal;

      switch (sorting.key) {
        case 'occupancy': {
          aVal = getOccupancyPercent(a);
          bVal = getOccupancyPercent(b);
          break;
        }
        case 'incidents': {
          aVal = getOpenIncidentCount(a);
          bVal = getOpenIncidentCount(b);
          break;
        }
        default: {
          aVal = a[sorting.key];
          bVal = b[sorting.key];
        }
      }

      if (aVal < bVal) return sorting.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [sorting]);

  // ── Selected shelter objects for compare view ────────────────
  const selectedShelters = useMemo(() => {
    const selected = MOCK_SHELTERS.filter((s) => selectedIds.includes(s.id));

    // Sort by compareSortKey
    selected.sort((a, b) => {
      switch (compareSortKey) {
        case 'occupancy': {
          return getOccupancyPercent(b) - getOccupancyPercent(a); // highest first
        }
        case 'critical': {
          // Most critical = most resource categories in LOW/OUT state
          const aCritical = getShelterNeeds(a).filter((n) => n.status !== 'ok').length;
          const bCritical = getShelterNeeds(b).filter((n) => n.status !== 'ok').length;
          return bCritical - aCritical;
        }
        case 'incidents': {
          return getOpenIncidentCount(b) - getOpenIncidentCount(a);
        }
        case 'name':
        default: {
          return a.name.localeCompare(b.name);
        }
      }
    });

    return selected;
  }, [selectedIds, compareSortKey]);

  // ── Aggregate stats for compare header ───────────────────────
  const compareAggregates = useMemo(() => {
    const totalPeople = selectedShelters.reduce((sum, s) => sum + s.occupancyCurrent, 0);
    const totalOpenNeeds = selectedShelters.reduce((sum, s) => {
      const needs = getShelterNeeds(s);
      return sum + needs.filter((n) => n.status !== 'ok').length;
    }, 0);
    const totalIncidents = selectedShelters.reduce(
      (sum, s) => sum + getOpenIncidentCount(s),
      0
    );

    // Find most critical shelter (most LOW/OUT resources)
    let mostCritical = null;
    let maxCriticalCount = 0;
    selectedShelters.forEach((s) => {
      const critCount = getShelterNeeds(s).filter((n) => n.status !== 'ok').length;
      if (critCount > maxCriticalCount) {
        maxCriticalCount = critCount;
        mostCritical = s;
      }
    });

    // Find the most urgent single resource shortage
    let urgentResource = null;
    if (mostCritical) {
      const needs = getShelterNeeds(mostCritical);
      const outResources = needs.filter((n) => n.status === 'out');
      const lowResources = needs.filter((n) => n.status === 'low');
      const worst = outResources[0] || lowResources[0];
      if (worst) {
        urgentResource = {
          shelterName: mostCritical.name,
          category: worst.category,
          status: worst.status,
          hoursRemaining: worst.hoursRemaining,
        };
      }
    }

    return {
      totalPeople,
      totalOpenNeeds,
      totalIncidents,
      mostCritical,
      urgentResource,
    };
  }, [selectedShelters]);

  return {
    shelters: sortedShelters,
    sorting,
    setSort,
    selectedIds,
    toggleSelect,
    clearSelection,
    isMaxed,
    maxWarning,
    isCompareOpen,
    openCompare,
    closeCompare,
    selectedShelters,
    compareAggregates,
    compareSortKey,
    setCompareSortKey,
  };
};
