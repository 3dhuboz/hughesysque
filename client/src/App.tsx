
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

// Storefront pages
const StorefrontHome = React.lazy(() => import('./pages/StorefrontHome'));
const StorefrontMenu = React.lazy(() => import('./pages/StorefrontMenu'));
const StorefrontOrder = React.lazy(() => import('./pages/StorefrontOrder'));
const StorefrontCatering = React.lazy(() => import('./pages/StorefrontCatering'));
const StorefrontLogin = React.lazy(() => import('./pages/StorefrontLogin'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const StorefrontRewards = React.lazy(() => import('./pages/StorefrontRewards'));
const StorefrontContact = React.lazy(() => import('./pages/StorefrontContact'));
const StorefrontEvents = React.lazy(() => import('./pages/StorefrontEvents'));
const StorefrontGallery = React.lazy(() => import('./pages/StorefrontGallery'));
const StorefrontLive = React.lazy(() => import('./pages/StorefrontLive'));
const StorefrontTracking = React.lazy(() => import('./pages/StorefrontTracking'));

// New pages matching SM feature set
const PitmasterAI = React.lazy(() => import('./pages/PitmasterAI'));
const Promoters = React.lazy(() => import('./pages/Promoters'));
const PaymentSuccess = React.lazy(() => import('./pages/PaymentSuccess'));
const Maintenance = React.lazy(() => import('./pages/Maintenance'));

// Admin
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const DataSetup = React.lazy(() => import('./pages/admin/DataSetup'));

const PageLoader = () => (
  <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>
);

const ProtectedAdminRoute: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useApp();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'DEV')) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const TITLE_MAP: Record<string, string> = {
  '/': 'Hughesys Que · BBQ catering & cook-day',
  '/menu': 'Menu · Hughesys Que',
  '/order': 'Order · Hughesys Que',
  '/catering': 'Catering · Hughesys Que',
  '/events': 'Events · Hughesys Que',
  '/gallery': 'Gallery · Hughesys Que',
  '/rewards': 'Rewards · Hughesys Que',
  '/login': 'Sign in · Hughesys Que',
};

const TitleByRoute: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let title: string;
    if (path.startsWith('/admin')) {
      title = 'Admin · Hughesys Que';
    } else if (TITLE_MAP[path]) {
      title = TITLE_MAP[path];
    } else {
      title = 'Hughesys Que';
    }
    document.title = title;
  }, [location.pathname]);
  return null;
};

const AppRoutes = () => {
  const { settings, user, isLoading, connectionError } = useApp();
  const location = useLocation();

  if (isLoading) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  if (connectionError) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h1>
        <p className="mb-4">{connectionError}</p>
        <p className="text-sm text-gray-400">Please check your configuration and try again.</p>
      </div>
    );
  }

  // Maintenance Mode
  const isMaintenance = settings?.maintenanceMode;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DEV';
  const isAllowedPath = ['/login', '/admin', '/setup'].some(path => location.pathname.startsWith(path));

  if (isMaintenance && !isAdmin && !isAllowedPath) {
    return <Maintenance />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {isMaintenance && isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 z-[100] animate-pulse">
          MAINTENANCE MODE ACTIVE - Public access restricted
        </div>
      )}
      <Routes>
        {/* Setup route - outside Layout */}
        <Route path="/setup" element={<DataSetup />} />

        {/* Main app routes */}
        <Route path="*" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<StorefrontHome />} />
                <Route path="/menu" element={<StorefrontMenu />} />
                <Route path="/catering" element={<StorefrontCatering />} />
                <Route path="/order" element={<StorefrontOrder />} />
                <Route path="/events" element={<StorefrontEvents />} />
                <Route path="/live" element={<StorefrontLive />} />
                <Route path="/gallery" element={<StorefrontGallery />} />
                <Route path="/tracking" element={<StorefrontTracking />} />
                <Route path="/contact" element={<StorefrontContact />} />
                <Route path="/login" element={<StorefrontLogin />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                {/* /rewards is public — page itself shows a sign-in CTA when not signed in */}
                <Route path="/rewards" element={<StorefrontRewards />} />
                <Route path="/promoters" element={<Promoters />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/pitmaster-ai" element={<PitmasterAI />} />

                <Route path="/admin" element={
                  <ProtectedAdminRoute>
                    <AdminDashboard />
                  </ProtectedAdminRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        } />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <TitleByRoute />
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  </ErrorBoundary>
);

export default App;
