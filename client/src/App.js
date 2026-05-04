// client/src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

// 공통 컴포넌트
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineIndicator from './components/common/OfflineIndicator';

// 레이지 로딩된 페이지 컴포넌트들
const Login = lazy(() => import('./pages/Login'));
const ReservationDashboard = lazy(() => import('./pages/ReservationDashboard'));
const OperationMobile = lazy(() => import('./pages/OperationMobile'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const LiveMenuBoard = lazy(() => import('./pages/LiveMenuBoard'));
const NotFound = lazy(() => import('./pages/NotFound'));

// 인증 가드 컴포넌트
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';

// PWA 설치 프롬프트
import PWAPrompt from './components/pwa/PWAPrompt';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // 온라인/오프라인 상태 감지
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

  // PWA 설치 이벤트
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // PWA 설치 핸들러
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

  // 기기 감지 (모바일/데스크톱)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Router>
              <div className="App">
                {/* 오프라인 표시 */}
                {!isOnline && <OfflineIndicator />}
                
                {/* PWA 설치 프롬프트 */}
                {isInstallable && (
                  <PWAPrompt onInstall={handleInstallClick} />
                )}

                {/* 토스트 컨테이너 */}
                <ToastContainer
                  position="top-right"
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="colored"
                />

                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <LoadingSpinner size="large" message="로딩 중..." />
                  </div>
                }>
                  <Routes>
                    {/* 공개 라우트 */}
                    <Route path="/login" element={<Login />} />
                    
                    {/* 예약실 대시보드 (데스크톱/태블릿) */}
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

                    {/* 운영과 모바일 (스마트폰) */}
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

                    {/* 관리자 패널 */}
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

                    {/* 실시간 메뉴 보드 (회의실 태블릿) */}
                    <Route 
                      path="/menu-board/:roomId" 
                      element={
                        <ProtectedRoute>
                          <LiveMenuBoard />
                        </ProtectedRoute>
                      } 
                    />

                    {/* 루트 리다이렉트 - 역할에 따라 자동 분기 */}
                    <Route 
                      path="/" 
                      element={<RoleBasedRedirect isMobile={isMobile} />} 
                    />

                    {/* 404 페이지 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </div>
            </Router>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// 역할 기반 자동 리다이렉트 컴포넌트
const RoleBasedRedirect = ({ isMobile }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 역할에 따른 리다이렉트
  switch (user?.department) {
    case 'reservation':
      return <Navigate to="/reservation" replace />;
    case 'operation':
      // 운영과는 항상 모바일 뷰로
      return <Navigate to="/operation" replace />;
    case 'admin':
      return isMobile 
        ? <Navigate to="/operation" replace />
        : <Navigate to="/reservation" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export default App;
