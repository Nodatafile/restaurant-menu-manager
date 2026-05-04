import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      path: '/restaurant'
    });

    newSocket.on('connect', () => {
      console.log('WebSocket 연결됨');
      newSocket.emit('joinRoom', 'main');
    });

    newSocket.on('menuUpdate', (updatedMenus) => {
      setMenus(updatedMenus);
    });

    newSocket.on('newOrder', (order) => {
      setOrders(prev => [order, ...prev].slice(0, 50)); // 최근 50개만 유지
      addNotification({
        type: 'order',
        message: `${order.room} - ${order.menuItem.name} ${order.quantity}개 주문`
      });
    });

    newSocket.on('cancelledOrder', (order) => {
      addNotification({
        type: 'cancel',
        message: `${order.room} - ${order.menuItem.name} ${order.quantity}개 취소`
      });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket 연결 해제');
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  const addNotification = (notification) => {
    setNotifications(prev => [
      { id: Date.now(), ...notification },
      ...prev
    ].slice(0, 10)); // 최근 10개만 유지
  };

  const placeOrder = (orderData) => {
    socket?.emit('placeOrder', orderData);
  };

  const cancelOrder = (cancelData) => {
    socket?.emit('cancelOrder', cancelData);
  };

  const requestMenuUpdate = () => {
    socket?.emit('requestMenuUpdate');
  };

  return (
    <SocketContext.Provider value={{
      socket,
      menus,
      orders,
      notifications,
      placeOrder,
      cancelOrder,
      requestMenuUpdate
    }}>
      {children}
    </SocketContext.Provider>
  );
};
