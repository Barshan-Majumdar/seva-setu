import { useState, useMemo, useCallback } from 'react';
import { initialShelters, mockVolunteers } from '../mocks/shelterMockData';
import { v4 as uuidv4 } from 'uuid';

export const useShelterManager = () => {
  const [shelters, setShelters] = useState(initialShelters);
  
  // Expose mock volunteers for assignment dropdowns
  const availableVolunteers = mockVolunteers;

  // --- MUTATIONS ---
  // In the future, these will be async functions calling fetch() and waiting for socket updates.
  // For now, they synchronously update local React state.

  const activateShelter = useCallback((newShelter) => {
    const shelter = {
      ...newShelter,
      id: `sh-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      resources: [],
      occupancyLogs: [],
      incidents: [],
      staffing: [],
      occupancyCurrent: 0,
      status: 'open'
    };
    setShelters(prev => [...prev, shelter]);
  }, []);

  const updateStatus = useCallback((shelterId, status) => {
    setShelters(prev => prev.map(s => s.id === shelterId ? { ...s, status } : s));
  }, []);

  const logOccupancy = useCallback((shelterId, count, reportedBy) => {
    const log = {
      id: `ol-${uuidv4().slice(0, 8)}`,
      count,
      reportedBy,
      reportedAt: new Date().toISOString()
    };
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        return {
          ...s,
          occupancyCurrent: count,
          occupancyLogs: [...s.occupancyLogs, log].sort((a, b) => new Date(a.reportedAt) - new Date(b.reportedAt)),
          // Auto-flag overcrowded if count >= capacityTotal
          status: count >= s.capacityTotal ? 'full' : s.status === 'full' ? 'open' : s.status
        };
      }
      return s;
    }));
  }, []);

  const addOrUpdateResource = useCallback((shelterId, resource) => {
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        const existingIdx = s.resources.findIndex(r => r.category === resource.category);
        if (existingIdx >= 0) {
          const newResources = [...s.resources];
          newResources[existingIdx] = { ...newResources[existingIdx], ...resource };
          return { ...s, resources: newResources };
        } else {
          return {
            ...s,
            resources: [...s.resources, {
              ...resource,
              id: `r-${uuidv4().slice(0, 8)}`,
              lastRestockedAt: new Date().toISOString()
            }]
          };
        }
      }
      return s;
    }));
  }, []);

  const restock = useCallback((shelterId, resourceId, amount) => {
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        return {
          ...s,
          resources: s.resources.map(r => r.id === resourceId ? {
            ...r,
            quantity: r.quantity + amount,
            lastRestockedAt: new Date().toISOString()
          } : r)
        };
      }
      return s;
    }));
  }, []);

  const reportIncident = useCallback((shelterId, incident) => {
    const newIncident = {
      ...incident,
      id: `inc-${uuidv4().slice(0, 8)}`,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        return { ...s, incidents: [newIncident, ...s.incidents] };
      }
      return s;
    }));
  }, []);

  const resolveIncident = useCallback((shelterId, incidentId) => {
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        return {
          ...s,
          incidents: s.incidents.map(inc => inc.id === incidentId ? { ...inc, status: 'resolved' } : inc)
        };
      }
      return s;
    }));
  }, []);

  const assignVolunteer = useCallback((shelterId, volunteerId, role) => {
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        // Check if already assigned
        if (s.staffing.some(st => st.volunteerId === volunteerId)) return s;
        return { ...s, staffing: [...s.staffing, { volunteerId, role }] };
      }
      return s;
    }));
  }, []);

  const unassignVolunteer = useCallback((shelterId, volunteerId) => {
    setShelters(prev => prev.map(s => {
      if (s.id === shelterId) {
        return { ...s, staffing: s.staffing.filter(st => st.volunteerId !== volunteerId) };
      }
      return s;
    }));
  }, []);

  // --- DERIVED SELECTORS ---
  
  // Calculate days remaining and if critical for a resource
  const getResourceStatus = (resource) => {
    if (!resource.dailyBurnRate || resource.dailyBurnRate <= 0) return { daysRemaining: Infinity, isCritical: false };
    const daysRemaining = resource.quantity / resource.dailyBurnRate;
    return { daysRemaining, isCritical: daysRemaining <= 2 }; // Critical if <= 48 hours
  };

  const getShelterWithComputations = useCallback((shelter) => {
    const occupancyPercent = shelter.capacityTotal > 0 
      ? Math.round((shelter.occupancyCurrent / shelter.capacityTotal) * 100) 
      : 0;
    
    let isOvercrowded = occupancyPercent >= 100;
    
    const computedResources = shelter.resources.map(r => ({
      ...r,
      ...getResourceStatus(r)
    }));

    const criticalResources = computedResources.filter(r => r.isCritical);
    const hasCriticalResource = criticalResources.length > 0;
    
    const openIncidentsCount = shelter.incidents.filter(inc => inc.status === 'open').length;

    return {
      ...shelter,
      occupancyPercent,
      isOvercrowded,
      computedResources,
      criticalResources,
      hasCriticalResource,
      openIncidentsCount
    };
  }, []);

  const getAllShelters = useCallback(() => {
    return shelters.map(getShelterWithComputations);
  }, [shelters, getShelterWithComputations]);

  const getShelterById = useCallback((id) => {
    const shelter = shelters.find(s => s.id === id);
    return shelter ? getShelterWithComputations(shelter) : null;
  }, [shelters, getShelterWithComputations]);

  const getSummary = useCallback(() => {
    const all = getAllShelters();
    const activeShelters = all.filter(s => s.status !== 'closed' && s.status !== 'archived');
    
    const totalShelters = activeShelters.length;
    const totalCapacity = activeShelters.reduce((sum, s) => sum + s.capacityTotal, 0);
    const totalOccupancy = activeShelters.reduce((sum, s) => sum + s.occupancyCurrent, 0);
    
    // Critical count: overcrowded + low-stock combined (count unique shelters)
    const criticalShelters = activeShelters.filter(s => s.isOvercrowded || s.hasCriticalResource).length;
    
    // Unmet shelter needs: Mocked static count for now, as requested.
    const unmetShelterNeeds = 340; 

    return {
      totalShelters,
      totalCapacity,
      totalOccupancy,
      criticalShelters,
      unmetShelterNeeds
    };
  }, [getAllShelters]);

  const getDistrictBreakdown = useCallback(() => {
    const all = getAllShelters().filter(s => s.status !== 'closed');
    const breakdown = {};
    
    all.forEach(s => {
      const dist = s.district || 'Unknown';
      if (!breakdown[dist]) {
        breakdown[dist] = { count: 0, capacityTotal: 0, occupancyCurrent: 0, overcrowded: 0 };
      }
      breakdown[dist].count += 1;
      breakdown[dist].capacityTotal += s.capacityTotal;
      breakdown[dist].occupancyCurrent += s.occupancyCurrent;
      if (s.isOvercrowded) breakdown[dist].overcrowded += 1;
    });
    
    // Convert to array
    return Object.entries(breakdown).map(([district, stats]) => ({
      district,
      ...stats,
      occupancyPercent: stats.capacityTotal > 0 ? Math.round((stats.occupancyCurrent / stats.capacityTotal) * 100) : 0
    })).sort((a, b) => b.occupancyPercent - a.occupancyPercent);
  }, [getAllShelters]);

  const getCriticalResources = useCallback(() => {
    const all = getAllShelters().filter(s => s.status !== 'closed');
    const criticalList = [];
    
    all.forEach(s => {
      s.criticalResources.forEach(cr => {
        criticalList.push({
          shelterId: s.id,
          shelterName: s.name,
          district: s.district,
          ...cr
        });
      });
    });
    
    return criticalList.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [getAllShelters]);

  const getOvercrowded = useCallback(() => {
    return getAllShelters().filter(s => s.isOvercrowded && s.status !== 'closed')
      .sort((a, b) => b.occupancyPercent - a.occupancyPercent);
  }, [getAllShelters]);

  return {
    // Pure data
    availableVolunteers,
    
    // Mutations
    activateShelter,
    updateStatus,
    logOccupancy,
    addOrUpdateResource,
    restock,
    reportIncident,
    resolveIncident,
    assignVolunteer,
    unassignVolunteer,
    
    // Selectors
    getAllShelters,
    getShelterById,
    getSummary,
    getDistrictBreakdown,
    getCriticalResources,
    getOvercrowded
  };
};
