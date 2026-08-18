import { useState, useRef } from 'react';
import { X, MapPin, User, Info, Users, Box, AlertTriangle, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import OverviewTab from './tabs/OverviewTab';
import OccupancyTab from './tabs/OccupancyTab';
import ResourcesTab from './tabs/ResourcesTab';
import IncidentsTab from './tabs/IncidentsTab';
import StaffingTab from './tabs/StaffingTab';

gsap.registerPlugin(useGSAP);

const ShelterDetailPanel = ({ shelterId, manager, onClose, isCoordinator = true }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const panelRef = useRef();

  useGSAP(() => {
    // Subtle slide-up and fade-in for the panel itself
    gsap.from(panelRef.current, {
      y: 20,
      opacity: 0,
      duration: 0.4,
      ease: 'power3.out'
    });
  }, { scope: panelRef });

  const shelter = manager.getShelterById(shelterId);

  if (!shelter) {
    return (
      <div className="dashboard-card" style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <p>Select a shelter from the map or list to view details.</p>
      </div>
    );
  }

  const allTabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'occupancy', label: 'Occupancy', icon: Users },
    { id: 'resources', label: 'Resources', icon: Box },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'staffing', label: 'Staffing', icon: ShieldCheck },
  ];

  // Restrict tabs for non-coordinators
  const tabs = isCoordinator 
    ? allTabs 
    : allTabs.filter(t => t.id === 'overview' || t.id === 'occupancy');

  return (
    <div ref={panelRef} className="dashboard-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'min(800px, 85vh)' }}>
      
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{shelter.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} /> {shelter.ward}, {shelter.district}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} /> {shelter.managerName || 'No Manager'}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
          <X size={20} />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                position: 'relative',
                padding: '0.85rem 0',
                background: isActive ? '#f8fafc' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #2d6148' : '2px solid transparent',
                color: isActive ? '#2d6148' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ letterSpacing: '0.02em' }}>{tab.label}</span>
              
              {/* Badges for tabs */}
              {tab.id === 'incidents' && shelter.openIncidentsCount > 0 && (
                <span style={{ position: 'absolute', top: '6px', right: '12%', background: '#dc2626', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '12px', fontWeight: 700, boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)' }}>
                  {shelter.openIncidentsCount}
                </span>
              )}
              {tab.id === 'resources' && shelter.hasCriticalResource && (
                <span style={{ position: 'absolute', top: '6px', right: '12%', background: '#d97706', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '12px', fontWeight: 700, boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)' }}>
                  !
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: '#fff' }}>
        {activeTab === 'overview' && <OverviewTab shelter={shelter} manager={manager} isCoordinator={isCoordinator} />}
        {activeTab === 'occupancy' && <OccupancyTab shelter={shelter} manager={manager} isCoordinator={isCoordinator} />}
        {isCoordinator && activeTab === 'resources' && <ResourcesTab shelter={shelter} manager={manager} />}
        {isCoordinator && activeTab === 'incidents' && <IncidentsTab shelter={shelter} manager={manager} />}
        {isCoordinator && activeTab === 'staffing' && <StaffingTab shelter={shelter} manager={manager} />}
      </div>

    </div>
  );
};

export default ShelterDetailPanel;
