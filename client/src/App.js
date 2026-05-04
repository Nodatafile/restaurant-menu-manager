// client/src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

// Lazy loaded pages
const Login = lazy(() => import('./pages/Login'));
const ReservationDashboard = lazy(() => import('./pages/ReservationDashboard'));
const OperationMobile = lazy(() => import('./pages/OperationMobile'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const LiveMenuBoard = lazy(() => import('./pages/LiveMenuBoard'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Auth guard
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';

// PWA prompt
import PWAPrompt from './components/pwa/PWAPrompt';

// Loading spinner
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '20px',
    color: '#666'
  }}>
    <div>
      <div style={{ textAlign: 'center', fontSize: '40px', marginBottom: '16px' }}>🍽️</div>
      <div>로딩 중...</div>
    </div>
  </div>
);

// Role based redirect
const RoleBasedRedirect = ({ isMobile }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (user?.department) {
    case 'reservation':
      return <Navigate to="/reservation" replace />;
    case 'operation':
      return <Navigate to="/operation" replace />;
    case 'admin':
      return isMobile 
        ? <Navigate to="/operation" replace />
        : <Navigate to="/reservation" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 온라인 연결됨', { position: 'bottom-center' });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('📡 오프라인 모드', { position: 'bottom-center' });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('📱 앱이 설치되었습니다!');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="App">
              {!isOnline && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, right: 0,
                  background: '#f59e0b', color: 'white',
                  textAlign: 'center', padding: '8px', zIndex: 9999,
                  fontSize: '14px', fontWeight: 600
                }}>
                  📡 오프라인 모드 - 네트워크 연결을 확인해주세요
                </div>
              )}
              
              {isInstallable && (
                <PWAPrompt onInstall={handleInstallClick} />
              )}

              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
              />

              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route 
                    path="/reservation/*" 
                    element={
                      <ProtectedRoute>
                        <RoleBasedRoute allowedRoles={['reservation', 'admin']}>
                          <ReservationDashboard />
                        </RoleBasedRoute>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/operation/*" 
                    element={
                      <ProtectedRoute>
                        <RoleBasedRoute allowedRoles={['operation', 'admin']}>
                          <OperationMobile />
                        </RoleBasedRoute>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/*" 
                    element={
                      <ProtectedRoute>
                        <RoleBasedRoute allowedRoles={['admin']}>
                          <AdminPanel />
                        </RoleBasedRoute>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/menu-board/:roomId" 
                    element={
                      <ProtectedRoute>
                        <LiveMenuBoard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/" 
                    element={<RoleBasedRedirect isMobile={isMobile} />} 
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
