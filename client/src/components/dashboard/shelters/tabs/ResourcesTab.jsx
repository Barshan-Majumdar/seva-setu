import { useState } from 'react';
import { format } from 'date-fns';

const ResourcesTab = ({ shelter, manager }) => {
  const isCoordinator = true;
  const [restockAmounts, setRestockAmounts] = useState({});

  const handleRestock = (resourceId) => {
    const amount = parseInt(restockAmounts[resourceId], 10);
    if (!isNaN(amount) && amount > 0) {
      manager.restock(shelter.id, resourceId, amount);
      setRestockAmounts(prev => ({ ...prev, [resourceId]: '' }));
    }
  };

  const handleRequestResupply = (resource) => {
    // In the real app, this would open a modal to create a `Need` of type `resource_resupply`.
    // For now, it's just an alert stub.
    alert(`Requested resupply for ${resource.category} at ${shelter.name}. This will create a new Need report for volunteers.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Inventory</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {shelter.computedResources.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px' }}>
            No resources tracked for this shelter yet.
          </div>
        ) : (
          shelter.computedResources.map(resource => (
            <div key={resource.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: resource.isCritical ? 'rgba(220, 38, 38, 0.05)' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{resource.category}</span>
                  {resource.isCritical && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Critical Low</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Restocked: {resource.lastRestockedAt ? format(new Date(resource.lastRestockedAt), 'MMM d, h:mm a') : 'Never'}
                </div>
              </div>

              <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Current Stock</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    {resource.quantity} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{resource.unit}</span>
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Burn Rate</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
                    {resource.dailyBurnRate || 0} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>/ day</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Est. Remaining</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: resource.isCritical ? '#dc2626' : resource.daysRemaining > 7 ? '#059669' : '#d97706' }}>
                    {resource.daysRemaining === Infinity ? '∞' : Math.floor(resource.daysRemaining)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>days</span>
                  </div>
                </div>
              </div>

              {isCoordinator && shelter.status !== 'closed' && (
                <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="number"
                      placeholder="Add amount"
                      min="1"
                      value={restockAmounts[resource.id] || ''}
                      onChange={e => setRestockAmounts(prev => ({ ...prev, [resource.id]: e.target.value }))}
                      style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '100px' }}
                    />
                    <button 
                      onClick={() => handleRestock(resource.id)}
                      disabled={!restockAmounts[resource.id]}
                      style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', background: '#3b82f6', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: restockAmounts[resource.id] ? 'pointer' : 'default', opacity: restockAmounts[resource.id] ? 1 : 0.5 }}
                    >
                      Restock
                    </button>
                  </div>

                  <button 
                    onClick={() => handleRequestResupply(resource)}
                    style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', background: 'transparent', color: '#2d6148', border: '1px solid #2d6148', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Request Resupply
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResourcesTab;
