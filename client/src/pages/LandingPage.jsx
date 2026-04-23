import MainLayout from '../layouts/MainLayout';
import HeroSection from '../components/landing/HeroSection';
import StatsStrip from '../components/landing/StatsStrip';
import CapabilitiesSection from '../components/landing/CapabilitiesSection';
import WorkflowSection from '../components/landing/WorkflowSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';

const LandingPage = () => (
  <MainLayout>
    <HeroSection />
    <StatsStrip />
    <CapabilitiesSection />
    <WorkflowSection />
    <FinalCtaSection />
  </MainLayout>
);

export default LandingPage;

