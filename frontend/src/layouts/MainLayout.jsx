import { Outlet, ScrollRestoration } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import TabBar from '../components/TabBar.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import ProgressStatus from '../components/ProgressStatus.jsx';

export default function MainLayout() {
  return (
    <div className="layout layout--main">
      <Navbar />
      <OfflineBanner />
      <ProgressStatus />
      <main className="layout__content">
        <Outlet />
      </main>
      <Footer />
      <TabBar />
      <ScrollRestoration />
    </div>
  );
}
