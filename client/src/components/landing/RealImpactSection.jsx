import { Quote, CheckCircle2 } from 'lucide-react';

const RealImpactSection = () => {
  return (
    <section id="real-impact" className="landing-impact-revamp" style={{ background: '#f8fafc', padding: '100px 0', borderTop: '1px solid #e2e8f0' }}>
      <div className="container-lg">
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 className="section-title">Real Verification, Real Impact</h2>
          <p className="section-subtitle">How SevaSetu is transforming disaster response for leading NGOs.</p>
        </div>
        
        <div style={{ maxWidth: '800px', margin: '0 auto', background: '#ffffff', borderRadius: '24px', padding: '48px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-24px', left: '48px', background: '#2d6148', color: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(45, 97, 72, 0.3)' }}>
            <Quote size={24} />
          </div>
          
          <p style={{ fontSize: '1.25rem', lineHeight: '1.8', color: '#1e293b', fontStyle: 'italic', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
            "Project is very good especially the 3 layer verification and the most important that is offline PWA. This project totally disappears those ghost verifications or any kind of unverified status means there is a total chance gone to submit a unverified report or just a false report."
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '32px', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden' }}>
                <img src="/sanjib.jpg" alt="Sanjib Kumar Das" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '600' }}>Sanjib Kumar Das</h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>CEO, Bandhan NGO</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: '#10b981', background: '#ecfdf5', padding: '6px 12px', borderRadius: '20px', fontWeight: '500' }}>
                 <CheckCircle2 size={16} /> 3-Layer Verified
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: '#3b82f6', background: '#eff6ff', padding: '6px 12px', borderRadius: '20px', fontWeight: '500' }}>
                 <CheckCircle2 size={16} /> Offline PWA Used
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RealImpactSection;
