import MainLayout from '../layouts/MainLayout';
import DashboardHero from '../components/dashboard/DashboardHero';
import MetricsGrid from '../components/dashboard/MetricsGrid';
import OperationsPanels from '../components/dashboard/OperationsPanels';

const DashboardPage = () => (
  <MainLayout>
    <div className="dashboard-shell container-lg">
      <DashboardHero />
      <MetricsGrid />
      <OperationsPanels />
    </div>
  </MainLayout>
);

export default DashboardPage;

