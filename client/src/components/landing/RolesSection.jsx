import { useState } from 'react';
import { Smartphone, LayoutDashboard, UserCheck, CheckCircle2 } from 'lucide-react';

const RolesSection = () => {
  const [activeRole, setActiveRole] = useState('field');

  const roles = [
    { id: 'field', label: 'User', icon: <Smartphone size={18} /> },
    { id: 'volunteer', label: 'Volunteer', icon: <UserCheck size={18} /> },
    { id: 'coordinator', label: 'Coordinator', icon: <LayoutDashboard size={18} /> },
  ];

  return (
    <section className="landing-section roles-revamp" id="roles">
      <div className="container-lg">
        <div className="section-header centered">
          <h2 className="landing-heading">Built for every role in the mission</h2>
          <div className="role-tabs">
            {roles.map(role => (
              <button 
                key={role.id}
                className={`role-tab-btn ${activeRole === role.id ? 'active' : ''}`}
                onClick={() => setActiveRole(role.id)}
              >
                {role.icon} {role.label}
              </button>
            ))}
          </div>
        </div>

        <div className="role-content-wrap">
          {activeRole === 'field' && (
            <div className="role-content grid-2">
              <div className="role-text">
                <h3>Reliable reporting, even in dark zones.</h3>
                <ul>
                  <li><CheckCircle2 size={18} className="text-moss" /> <strong>Offline-First:</strong> Log needs without internet; sync when back online.</li>
                  <li><CheckCircle2 size={18} className="text-moss" /> <strong>Rich Metadata:</strong> Auto-capture GPS, upload photos, and tag need types.</li>
                  <li><CheckCircle2 size={18} className="text-moss" /> <strong>Low Bandwidth:</strong> Optimized for field conditions and slow networks.</li>
                  <li><CheckCircle2 size={18} className="text-moss" /> <strong>Track History:</strong> Review your submissions and their current resolution status.</li>
                </ul>
              </div>
              <div className="role-visual">
                <div className="phone-mockup-wrap">
                  <img src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=600" className="role-img-main" alt="Mobile App" />
                  <div className="floating-imgs">
                    <img src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=300" alt="Field" />
                    <img src="https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&q=80&w=300" alt="Relief" />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeRole === 'coordinator' && (
            <div className="role-content grid-2 reverse">
               <div className="role-text">
                <h3>Command with total visibility.</h3>
                <p>Monitor high-urgency clusters on a real-time heatmap. Use our smart matching engine to dispatch the right volunteers to the right place in seconds.</p>
              </div>
              <div className="role-visual">
                <div className="dashboard-preview-wrap">
                  <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=800" className="role-img-main" alt="Coordinator Dashboard" />
                  <div className="floating-imgs">
                    <img src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=300" alt="Management" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRole === 'volunteer' && (
             <div className="role-content grid-2">
                <div className="role-text">
                  <h3>Actionable tasks. Verifiable impact.</h3>
                  <p>Receive assignments matched to your specific skill set and location. Use GPS-backed check-ins to provide NGOs with immediate proof of your progress and impact.</p>
                </div>
                <div className="role-visual">
                  <div className="phone-mockup-wrap">
                    <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600" className="role-img-main" alt="Volunteer App" />
                    <div className="floating-imgs">
                      <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=300" alt="Teamwork" />
                      <img src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&q=80&w=300" alt="Helping" />
                    </div>
                  </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RolesSection;
