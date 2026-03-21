import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import StorefrontLayout from './components/StorefrontLayout';
import ErrorBoundary from './components/ErrorBoundary';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

// Storefront pages
const StorefrontHome = lazy(() => import('./pages/StorefrontHome'));
const StorefrontMenu = lazy(() => import('./pages/StorefrontMenu'));
const StorefrontOrder = lazy(() => import('./pages/StorefrontOrder'));
const StorefrontCatering = lazy(() => import('./pages/StorefrontCatering'));
const StorefrontLogin = lazy(() => import('./pages/StorefrontLogin'));
const StorefrontContact = lazy(() => import('./pages/StorefrontContact'));
const StorefrontEvents = lazy(() => import('./pages/StorefrontEvents'));
const StorefrontGallery = lazy(() => import('./pages/StorefrontGallery'));
const StorefrontRewards = lazy(() => import('./pages/StorefrontRewards'));
const StorefrontTracking = lazy(() => import('./pages/StorefrontTracking'));
const StorefrontProfile = lazy(() => import('./pages/StorefrontProfile'));
const FoodTruckAdmin = lazy(() => import('./pages/FoodTruckAdmin'));

const PageLoader = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, isLoading } = useApp();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN' && user.role !== 'DEV') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppShell = () => {
  const { settings, isLoading, connectionError } = useApp();

  if (isLoading) return <PageLoader />;

  if (connectionError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', padding: '1rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '1rem' }}>Connection Error</h1>
        <p>{connectionError}</p>
      </div>
    );
  }

  return (
    <StorefrontLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public storefront */}
          <Route path="/" element={<StorefrontHome />} />
          <Route path="/menu" element={<StorefrontMenu />} />
          <Route path="/order" element={<StorefrontOrder />} />
          <Route path="/catering" element={<StorefrontCatering />} />
          <Route path="/events" element={<StorefrontEvents />} />
          <Route path="/gallery" element={<StorefrontGallery />} />
          <Route path="/rewards" element={<StorefrontRewards />} />
          <Route path="/tracking" element={<StorefrontTracking />} />
          <Route path="/contact" element={<StorefrontContact />} />
          <Route path="/login" element={<StorefrontLogin />} />

          {/* Protected customer */}
          <Route path="/storefront-profile" element={
            <ProtectedRoute><StorefrontProfile /></ProtectedRoute>
          } />

          {/* Protected admin */}
          <Route path="/admin/*" element={
            <ProtectedRoute adminOnly><FoodTruckAdmin /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </StorefrontLayout>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_KEY}>
        <AppProvider>
          <HashRouter>
            <AppShell />
            <Toaster position="top-right" toastOptions={{
              duration: 4000,
              style: { background: '#1e293b', color: '#f8fafc', borderRadius: '8px' },
            }} />
          </HashRouter>
        </AppProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

export default App;
