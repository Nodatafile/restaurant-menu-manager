// client/src/context/SocketContext.js
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // 소켓 연결 상태
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // 데이터 상태
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [dailyInventory, setDailyInventory] = useState(null);
  const [notifications, setNotifications] = useState([]);
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  
  // 소켓 ref (재연결 시 사용)
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // ============================================
  // 소켓 URL 설정 (환경별)
  // ============================================
  const getSocketUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      // 프로덕션: 환경 변수 사용
      return process.env.REACT_APP_WS_URL || 'wss://restaurant-api.onrender.com';
    }
    // 개발: 로컬 서버
    return process.env.REACT_APP_WS_URL || 'http://localhost:5000';
  };

  // ============================================
  // 소켓 연결 설정
  // ============================================
  const connectSocket = useCallback(() => {
    if (!isAuthenticated || !user) {
      console.log('🔌 인증되지 않음 - 소켓 연결 스킵');
      return null;
    }

    try {
      const socketUrl = getSocketUrl();
      console.log(`🔌 소켓 연결 시도: ${socketUrl}`);

      const newSocket = io(socketUrl, {
        path: '/socket.io',
        transports: ['polling', 'websocket'], // polling 먼저 시도 (호환성)
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        forceNew: false,
        query: {
          department: user.department,
          userName: user.name
        }
      });

      // ============================================
      // 연결 이벤트 핸들러
      // ============================================
      newSocket.on('connect', () => {
        console.log('🟢 WebSocket 연결됨:', newSocket.id);
        setIsConnected(true);
        setConnectionError(null);
        setIsLoading(false);

        // 인증 정보와 함께 방 조인
        const room = user.department === 'reservation' ? 'reservation' : 
                     user.department === 'operation' ? 'operation' : 'main';
        
        newSocket.emit('joinRoom', {
          room: room,
          department: user.department,
          userName: user.name
        });

        // 운영과는 별도 네임스페이스도 조인
        if (user.department === 'operation') {
          newSocket.emit('joinOperation', { userName: user.name });
        }

        // 예약실은 별도 네임스페이스 조인
        if (user.department === 'reservation') {
          newSocket.emit('joinReservation', { userName: user.name });
        }

        toast.success('🟢 실시간 연결됨', { 
          position: 'bottom-right',
          autoClose: 2000,
          hideProgressBar: true
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔴 WebSocket 연결 해제:', reason);
        setIsConnected(false);
        setIsLoading(false);

        if (reason === 'io server disconnect') {
          // 서버에서 강제로 끊은 경우 재연결 시도
          toast.warning('🔴 서버 연결이 끊어졌습니다. 재연결 시도 중...', {
            position: 'bottom-right',
            autoClose: 5000
          });
          setTimeout(() => {
            newSocket.connect();
          }, 2000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ 소켓 연결 에러:', error.message);
        setConnectionError(error.message);
        setIsConnected(false);
        setIsLoading(false);

        // 5회 이상 실패 시 사용자에게 알림
        if (newSocket.io?.reconnectAttempts > 5) {
          toast.error('서버 연결에 실패했습니다. 네트워크를 확인해주세요.', {
            position: 'bottom-right',
            autoClose: false,
            closeOnClick: true
          });
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 재연결 성공 (시도: ${attemptNumber})`);
        setIsConnected(true);
        setConnectionError(null);
        
        toast.success('🔄 재연결 성공!', { 
          position: 'bottom-right',
          autoClose: 2000
        });

        // 재연결 시 데이터 다시 요청
        newSocket.emit('requestMenuUpdate');
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 재연결 시도 중... (${attemptNumber}/20)`);
        setIsLoading(true);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ 재연결 실패:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ 재연결 최대 시도 횟수 초과');
        setIsConnected(false);
        setIsLoading(false);
        
        toast.error('서버 연결에 실패했습니다. 페이지를 새로고침 해주세요.', {
          position: 'bottom-right',
          autoClose: false,
          closeOnClick: true
        });
      });

      // ============================================
      // 데이터 수신 이벤트 핸들러
      // ============================================
      newSocket.on('menuUpdate', (data) => {
        console.log('📊 메뉴 업데이트 수신:', data);
        if (data.menus) {
          setMenus(data.menus);
        }
        if (data.dailyInventory) {
          setDailyInventory(data.dailyInventory);
        }
        if (data.reservations) {
          setReservations(data.reservations);
        }
        setIsLoading(false);
      });

      newSocket.on('operationData', (data) => {
        console.log('🔧 운영 데이터 수신:', data);
        if (data.menus) setMenus(data.menus);
        if (data.dailyInventory) setDailyInventory(data.dailyInventory);
        if (data.reservations) setReservations(data.reservations);
        setIsLoading(false);
      });

      newSocket.on('reservationData', (data) => {
        console.log('📋 예약 데이터 수신:', data);
        if (data.menus) setMenus(data.menus);
        if (data.reservations) setReservations(data.reservations);
        if (data.dailyInventory) setDailyInventory(data.dailyInventory);
        setIsLoading(false);
      });

      // ============================================
      // 주문 관련 이벤트
      // ============================================
      newSocket.on('newOrder', (orderData) => {
        console.log('🆕 새 주문:', orderData);
        
        // 주문 목록 업데이트
        if (orderData.order) {
          setOrders(prev => [orderData.order, ...prev].slice(0, 100));
        }

        // 예약 선주문 매칭 알림
        if (orderData.matchedReservation) {
          addNotification({
            type: 'preorder_match',
            message: `🎯 예약 선주문 매칭: ${orderData.matchedReservation.customerName}님`,
            details: orderData.matchedReservation
          });
        } else {
          addNotification({
            type: 'order',
            message: `✅ 새 주문: ${orderData.order?.menuItem?.name || '메뉴'} ${orderData.order?.quantity || 0}개`
          });
        }
      });

      newSocket.on('cancelledOrder', (order) => {
        console.log('❌ 주문 취소:', order);
        addNotification({
          type: 'cancel',
          message: `❌ 주문 취소: ${order?.menuItem?.name || '메뉴'} ${order?.quantity || 0}개`
        });
      });

      // ============================================
      // 회의실 업데이트
      // ============================================
      newSocket.on('roomOrderUpdate', (data) => {
        console.log('🏢 회의실 업데이트:', data);
        
        // 선주문 매칭 메시지 표시
        if (data.preOrderMatch?.isPreOrder) {
          toast.info(data.preOrderMatch.message, {
            position: 'top-center',
            autoClose: 3000,
          });
        }
        
        // 일반 알림
        addNotification({
          type: data.type,
          message: data.message
        });
      });

      // ============================================
      // 재고 경고
      // ============================================
      newSocket.on('stockAlert', (alert) => {
        console.log('⚠️ 재고 경고:', alert);
        
        const toastType = alert.type === 'low_stock' ? 'warning' : 
                         alert.type === 'restored' ? 'success' : 'info';
        
        toast[toastType](alert.message, {
          position: 'top-right',
          autoClose: 5000,
          closeOnClick: true,
        });

        addNotification({
          type: 'stock_alert',
          message: alert.message
        });
      });

      // ============================================
      // 에러 처리
      // ============================================
      newSocket.on('orderError', (error) => {
        console.error('주문 에러:', error);
        toast.error(error.message || '주문 처리 중 오류가 발생했습니다.');
      });

      newSocket.on('cancelError', (error) => {
        console.error('취소 에러:', error);
        toast.error(error.message || '취소 처리 중 오류가 발생했습니다.');
      });

      newSocket.on('stockError', (error) => {
        console.error('재고 조정 에러:', error);
        toast.error(error.message || '재고 조정 중 오류가 발생했습니다.');
      });

      newSocket.on('error', (error) => {
        console.error('서버 에러:', error);
        toast.error(error.message || '서버 오류가 발생했습니다.');
      });

      // ============================================
      // 서버 전체 에러
      // ============================================
      newSocket.on('serverError', (error) => {
        console.error('서버 에러:', error);
        if (process.env.NODE_ENV !== 'production') {
          toast.error(`서버 에러: ${error.message}`, {
            position: 'bottom-right',
            autoClose: 10000
          });
        }
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      return newSocket;
    } catch (error) {
      console.error('소켓 생성 실패:', error);
      setConnectionError(error.message);
      setIsLoading(false);
      return null;
    }
  }, [isAuthenticated, user]);

  // ============================================
  // 소켓 연결/해제 관리
  // ============================================
  useEffect(() => {
    const newSocket = connectSocket();

    // 클린업
    return () => {
      if (socketRef.current) {
        console.log('🔌 소켓 연결 종료');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSocket]);

  // ============================================
  // Keep-alive (4분마다 핑)
  // ============================================
  useEffect(() => {
    if (!isConnected) return;

    const keepAliveInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('requestMenuUpdate');
      }
    }, 4 * 60 * 1000); // 4분

    return () => clearInterval(keepAliveInterval);
  }, [isConnected]);

  // ============================================
  // 알림 관리
  // ============================================
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // ============================================
  // 액션 메서드
  // ============================================
  const placeOrder = useCallback((orderData) => {
    if (!socketRef.current?.connected) {
      toast.error('서버와 연결되어 있지 않습니다.');
      return false;
    }

    console.log('📝 주문 전송:', orderData);
    socketRef.current.emit('placeOrder', {
      ...orderData,
      staffName: user?.name || 'Unknown',
      department: user?.department || 'operation'
    });
    return true;
  }, [user]);

  const cancelOrderAction = useCallback((cancelData) => {
    if (!socketRef.current?.connected) {
      toast.error('서버와 연결되어 있지 않습니다.');
      return false;
    }

    console.log('❌ 주문 취소 전송:', cancelData);
    socketRef.current.emit('cancelOrder', {
      ...cancelData,
      staffName: user?.name || 'Unknown'
    });
    return true;
  }, [user]);

  const createReservation = useCallback((reservationData) => {
    if (!socketRef.current?.connected) {
      toast.error('서버와 연결되어 있지 않습니다.');
      return false;
    }

    console.log('📋 예약 생성 전송:', reservationData);
    socketRef.current.emit('createReservation', {
      ...reservationData,
      createdBy: user?.name || 'Unknown'
    });
    return true;
  }, [user]);

  const cancelReservationAction = useCallback((reservationId) => {
    if (!socketRef.current?.connected) {
      toast.error('서버와 연결되어 있지 않습니다.');
      return false;
    }

    console.log('❌ 예약 취소 전송:', reservationId);
    socketRef.current.emit('cancelReservation', {
      reservationId,
      cancelledBy: user?.name || 'Unknown'
    });
    return true;
  }, [user]);

  const adjustStock = useCallback((stockData) => {
    if (!socketRef.current?.connected) {
      toast.error('서버와 연결되어 있지 않습니다.');
      return false;
    }

    console.log('⚙️ 재고 조정 전송:', stockData);
    socketRef.current.emit('adjustStock', stockData);
    return true;
  }, []);

  const requestMenuUpdate = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('requestMenuUpdate');
    }
  }, []);

  const requestPreOrders = useCallback((room) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('requestPreOrders', { room });
    }
  }, []);

  // ============================================
  // 소켓 수동 재연결
  // ============================================
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔄 수동 재연결 시도...');
      socketRef.current.connect();
    } else {
      connectSocket();
    }
  }, [connectSocket]);

  // ============================================
  // Context 값
  // ============================================
  const value = {
    // 소켓 상태
    socket,
    isConnected,
    connectionError,
    isLoading,
    
    // 데이터
    menus,
    orders,
    reservations,
    dailyInventory,
    notifications,
    
    // 액션
    placeOrder,
    cancelOrder: cancelOrderAction,
    createReservation,
    cancelReservation: cancelReservationAction,
    adjustStock,
    requestMenuUpdate,
    requestPreOrders,
    
    // 유틸리티
    addNotification,
    clearNotifications,
    reconnect
  };

  return (
    <SocketContext.Provider value={value}>
      {/* 연결 상태 표시 (선택사항) */}
      {!isConnected && isAuthenticated && !isLoading && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm z-50">
          🔄 서버 연결 중... 일부 기능이 제한될 수 있습니다
          <button 
            onClick={reconnect}
            className="ml-2 underline"
          >
            재연결
          </button>
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
