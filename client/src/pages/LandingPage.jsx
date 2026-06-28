import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import MainLayout from '../layouts/MainLayout';
import HeroSection from '../components/landing/HeroSection';
import StatsStrip from '../components/landing/StatsStrip';
import ProblemSection from '../components/landing/ProblemSection';
import WorkflowSection from '../components/landing/WorkflowSection';
import RolesSection from '../components/landing/RolesSection';
import ImpactSection from '../components/landing/ImpactSection';
import TrustSection from '../components/landing/TrustSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';
import RealImpactSection from '../components/landing/RealImpactSection';

const LandingPage = () => {
  const { isAuthenticated, isLoaded } = useAuth();

  if (isLoaded && isAuthenticated) {
    return <Navigate to="/post-login" replace />;
  }

  return (
    <MainLayout>
      <HeroSection />
      <StatsStrip />
      <ProblemSection />
      <WorkflowSection />
      <RolesSection />
      <TrustSection />
      <ImpactSection />
      <RealImpactSection />
      <FinalCtaSection />
    </MainLayout>
  );
};

export default LandingPage;
