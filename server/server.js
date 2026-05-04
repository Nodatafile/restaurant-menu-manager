require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// 미들웨어 임포트
const { authenticate, authorize } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, loginLimiter, creationLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { corsOptions, securityHeaders } = require('./middleware/security');

// 유틸리티 임포트
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// 라우트 임포트
const menuRoutes = require('./routes/menuRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const operationRoutes = require('./routes/operationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');

// 모델 임포트 (Socket.io에서 사용)
const Menu = require('./models/Menu');
const Order = require('./models/Order');
const Reservation = require('./models/Reservation');
const DailyInventory = require('./models/DailyInventory');

// Express 앱 초기화
const app = express();
const server = http.createServer(app);

// Socket.io 설정
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ============================================
// 기본 미들웨어 설정 (순서 중요!)
// ============================================

// 1. 보안 헤더
app.use(securityHeaders);

// 2. CORS
app.use(corsOptions);

// 3. 요청 로깅
app.use(requestLogger);

// 4. Body 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. 정적 파일 서빙 (프로덕션)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// 6. API 속도 제한
app.use('/api/', apiLimiter);

// io 객체를 request에서 접근 가능하게 설정
app.set('io', io);

// ============================================
// 데이터베이스 연결
// ============================================
connectDB();

// ============================================
// 라우트 설정 (미들웨어 포함)
// ============================================

// 인증 라우트 (속도 제한 적용)
app.use('/api/auth', loginLimiter, authRoutes);

// 메뉴 관리 라우트 (인증 + 권한 필요)
app.use('/api/menus', 
  authenticate, 
  authorize('admin', 'operation', 'reservation'), 
  menuRoutes
);

// 예약 관리 라우트 (인증 + 예약실/관리자만)
app.use('/api/reservations', 
  authenticate, 
  authorize('reservation', 'admin'), 
  creationLimiter, 
  reservationRoutes
);

// 운영 관리 라우트 (인증 + 운영과/관리자만)
app.use('/api/operations', 
  authenticate, 
  authorize('operation', 'admin'), 
  operationRoutes
);

// 주문 관리 라우트 (인증 + 운영과/관리자만)
app.use('/api/orders', 
  authenticate, 
  authorize('operation', 'admin'), 
  creationLimiter, 
  orderRoutes
);

// ============================================
// 상태 확인 엔드포인트 (인증 불필요)
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    websocket: `${io.engine.clientsCount} clients connected`,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// 프로덕션 환경: React 앱 서빙
// ============================================
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// ============================================
// Socket.io 이벤트 핸들러
// ============================================

// 네임스페이스 설정
const restaurantNamespace = io.of('/restaurant');
const operationNamespace = io.of('/operation');
const reservationNamespace = io.of('/reservation');

// ============================================
// 레스토랑 메인 네임스페이스
// ============================================
restaurantNamespace.on('connection', (socket) => {
  logger.info(`🔌 레스토랑 클라이언트 연결: ${socket.id}`);
  
  // 클라이언트 정보 저장
  let clientInfo = {
    id: socket.id,
    department: null,
    room: null,
    userName: 'Unknown'
  };

  // 회의실 조인
  socket.on('joinRoom', async (data) => {
    const { room, department, userName } = data;
    clientInfo.room = room;
    clientInfo.department = department;
    clientInfo.userName = userName || 'Unknown';
    
    socket.join(room);
    socket.join(department);
    
    logger.info(`${userName}(${department})님이 ${room}에 조인`);
    
    try {
      const menus = await Menu.find({ isAvailable: true });
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      
      const dailyInventory = await DailyInventory.findOne({ date: dateStr })
        .populate('menuItems.preOrders.reservationId');
      
      const reservations = await Reservation.find({
        reservationDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      }).populate('preOrders.menuItem');
      
      socket.emit('menuUpdate', {
        menus,
        dailyInventory,
        reservations
      });
      
      // 운영과에게만 재고 경고 전송
      if (department === 'operation') {
        const lowStockMenus = menus.filter(m => m.currentStock <= 5);
        if (lowStockMenus.length > 0) {
          socket.emit('stockAlert', {
            type: 'warning',
            message: `${lowStockMenus.length}개 메뉴 재고 부족`,
            menus: lowStockMenus
          });
        }
      }
      
    } catch (error) {
      logger.error('메뉴 정보 로드 실패:', error);
      socket.emit('error', { message: '메뉴 정보 로드 실패' });
    }
  });

  // ============================================
  // 주문 처리 (예약 선주문 확인 포함)
  // ============================================
  socket.on('placeOrder', async (orderData) => {
    try {
      const { room, menuId, quantity, staffName, department } = orderData;
      
      // 메뉴 확인 및 재고 체크
      const menu = await Menu.findById(menuId);
      if (!menu) {
        socket.emit('orderError', { message: '메뉴를 찾을 수 없습니다' });
        return;
      }
      
      if (menu.currentStock < quantity) {
        socket.emit('orderError', { 
          message: `${menu.name} 재고가 부족합니다. (남은 수량: ${menu.currentStock})` 
        });
        return;
      }
      
      // 예약 선주문 확인
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      let matchedReservation = null;
      let preOrderInfo = null;
      
      // 해당 회의실의 오늘 예약 확인
      const reservation = await Reservation.findOne({
        reservationDate: { $gte: startOfDay, $lt: endOfDay },
        room: room,
        status: { $in: ['confirmed', 'pending'] },
        'preOrders.menuItem': menuId,
        'preOrders.served': false
      });
      
      if (reservation) {
        matchedReservation = reservation;
        const preOrder = reservation.preOrders.find(
          po => po.menuItem.toString() === menuId && !po.served
        );
        
        if (preOrder) {
          preOrderInfo = {
            reservationId: reservation._id,
            reservationNumber: reservation.reservationNumber,
            customerName: reservation.customerName,
            preOrderedQuantity: preOrder.quantity,
            orderedQuantity: Math.min(quantity, preOrder.quantity)
          };
          
          // 선주문 서빙 처리
          preOrder.served = true;
          preOrder.servedAt = new Date();
          preOrder.servedQuantity = Math.min(quantity, preOrder.quantity);
          await reservation.save();
          
          // 일일 재고 업데이트
          const dateStr = today.toISOString().slice(0, 10);
          const dailyInventory = await DailyInventory.findOne({ date: dateStr });
          if (dailyInventory) {
            const menuItem = dailyInventory.menuItems.find(
              item => item.menuId.toString() === menuId
            );
            if (menuItem) {
              const preOrderEntry = menuItem.preOrders.find(
                po => po.reservationId.toString() === reservation._id.toString()
              );
              if (preOrderEntry) {
                preOrderEntry.status = 'served';
              }
              await dailyInventory.save();
            }
          }
        }
      }
      
      // 주문 생성
      const order = new Order({
        room,
        menuItem: menuId,
        quantity,
        type: 'order',
        staffName: staffName || clientInfo.userName,
        matchedReservation: matchedReservation?._id,
        isPreOrderServed: !!matchedReservation
      });
      
      await order.save();
      await order.populate('menuItem');
      
      // 재고 감소
      menu.currentStock -= quantity;
      if (menu.currentStock <= 0) {
        menu.isAvailable = false;
      }
      await menu.save();
      
      // ============================================
      // 실시간 업데이트 브로드캐스트
      // ============================================
      
      const updatedMenus = await Menu.find({ isAvailable: true });
      restaurantNamespace.emit('menuUpdate', { menus: updatedMenus });
      
      const orderNotification = {
        order,
        matchedReservation: matchedReservation ? {
          reservationNumber: matchedReservation.reservationNumber,
          customerName: matchedReservation.customerName
        } : null
      };
      
      restaurantNamespace.emit('newOrder', orderNotification);
      
      restaurantNamespace.to(room).emit('roomOrderUpdate', {
        type: 'order',
        message: `${menu.name} ${quantity}개 주문 완료`,
        order,
        preOrderMatch: preOrderInfo ? {
          isPreOrder: true,
          customerName: matchedReservation.customerName,
          reservationNumber: matchedReservation.reservationNumber,
          message: `🎯 예약 선주문: ${matchedReservation.customerName}님`
        } : null
      });
      
      if (preOrderInfo) {
        operationNamespace.emit('preOrderServed', {
          reservation: matchedReservation,
          preOrder: preOrderInfo,
          message: `예약 선주문 서빙: ${matchedReservation.customerName}님 ${menu.name}`
        });
      }
      
      // 재고 부족 경고
      if (menu.currentStock <= 5) {
        const alertData = {
          type: 'low_stock',
          menu: { id: menu._id, name: menu.name, currentStock: menu.currentStock },
          message: `⚠️ ${menu.name} 재고 부족! (${menu.currentStock}개 남음)`
        };
        
        operationNamespace.emit('stockAlert', alertData);
        reservationNamespace.emit('stockAlert', {
          ...alertData,
          message: `${menu.name} 재고가 ${menu.currentStock}개 남았습니다. 추가 예약 선주문 제한이 필요할 수 있습니다.`
        });
      }
      
      logger.info(`주문 완료: ${room} - ${menu.name} ${quantity}개 (${staffName || clientInfo.userName})`);
      
    } catch (error) {
      logger.error('주문 처리 에러:', error);
      socket.emit('orderError', { message: error.message });
    }
  });

  // ============================================
  // 주문 취소 처리
  // ============================================
  socket.on('cancelOrder', async (cancelData) => {
    try {
      const { room, menuId, quantity, staffName, orderId } = cancelData;
      
      const menu = await Menu.findById(menuId);
      if (!menu) {
        socket.emit('cancelError', { message: '메뉴를 찾을 수 없습니다' });
        return;
      }
      
      // 기존 주문 확인 및 선주문 복구
      if (orderId) {
        const originalOrder = await Order.findById(orderId);
        if (originalOrder && originalOrder.isPreOrderServed) {
          const reservation = await Reservation.findById(originalOrder.matchedReservation);
          if (reservation) {
            const preOrder = reservation.preOrders.find(
              po => po.menuItem.toString() === menuId
            );
            if (preOrder) {
              preOrder.served = false;
              preOrder.servedAt = null;
              preOrder.servedQuantity = 0;
              await reservation.save();
              
              const today = new Date();
              const dateStr = today.toISOString().slice(0, 10);
              const dailyInventory = await DailyInventory.findOne({ date: dateStr });
              if (dailyInventory) {
                const menuItem = dailyInventory.menuItems.find(
                  item => item.menuId.toString() === menuId
                );
                if (menuItem) {
                  const preOrderEntry = menuItem.preOrders.find(
                    po => po.reservationId.toString() === reservation._id.toString()
                  );
                  if (preOrderEntry) {
                    preOrderEntry.status = 'reserved';
                  }
                  await dailyInventory.save();
                }
              }
            }
          }
        }
      }
      
      // 취소 주문 생성
      const cancelOrder = new Order({
        room,
        menuItem: menuId,
        quantity,
        type: 'cancel',
        staffName: staffName || clientInfo.userName,
        originalOrder: orderId || null
      });
      
      await cancelOrder.save();
      await cancelOrder.populate('menuItem');
      
      // 재고 복구
      menu.currentStock += quantity;
      menu.isAvailable = true;
      await menu.save();
      
      // 브로드캐스트
      const updatedMenus = await Menu.find({ isAvailable: true });
      
      restaurantNamespace.emit('menuUpdate', { menus: updatedMenus });
      restaurantNamespace.emit('cancelledOrder', cancelOrder);
      
      restaurantNamespace.to(room).emit('roomOrderUpdate', {
        type: 'cancel',
        message: `${menu.name} ${quantity}개 취소 완료`,
        order: cancelOrder
      });
      
      // 재고 회복 알림
      if (menu.currentStock > 5) {
        reservationNamespace.emit('stockAlert', {
          type: 'restored',
          menu: { id: menu._id, name: menu.name, currentStock: menu.currentStock },
          message: `${menu.name} 재고가 ${menu.currentStock}개로 회복되었습니다.`
        });
      }
      
      logger.info(`주문 취소: ${room} - ${menu.name} ${quantity}개 (${staffName || clientInfo.userName})`);
      
    } catch (error) {
      logger.error('취소 처리 에러:', error);
      socket.emit('cancelError', { message: error.message });
    }
  });

  // ============================================
  // 예약 생성 (선주문 포함)
  // ============================================
  socket.on('createReservation', async (reservationData) => {
    try {
      const ReservationService = require('./services/ReservationService');
      const result = await ReservationService.createReservation({
        ...reservationData,
        createdBy: clientInfo.userName
      });
      
      reservationNamespace.emit('reservationCreated', {
        reservation: result.reservation,
        affectedMenus: result.affectedMenus
      });
      
      restaurantNamespace.to(reservationData.room).emit('roomOrderUpdate', {
        type: 'reservation',
        message: `📋 새 예약: ${reservationData.customerName}님 (${reservationData.numberOfGuests}명)`,
        reservation: result.reservation
      });
      
      if (reservationData.preOrders && reservationData.preOrders.length > 0) {
        operationNamespace.emit('preOrderAlert', {
          message: `새로운 예약 선주문: ${reservationData.customerName}님`,
          reservation: result.reservation,
          preOrders: reservationData.preOrders
        });
      }
      
      socket.emit('reservationSuccess', {
        message: '예약이 완료되었습니다',
        reservation: result.reservation
      });
      
      logger.info(`예약 생성: ${reservationData.customerName} (${reservationData.room})`);
      
    } catch (error) {
      logger.error('예약 생성 에러:', error);
      socket.emit('reservationError', { message: error.message });
    }
  });

  // ============================================
  // 예약 취소
  // ============================================
  socket.on('cancelReservation', async (data) => {
    try {
      const { reservationId, cancelledBy } = data;
      const ReservationService = require('./services/ReservationService');
      const result = await ReservationService.cancelReservation(
        reservationId, 
        cancelledBy || clientInfo.userName
      );
      
      restaurantNamespace.emit('reservationCancelled', {
        reservationId,
        message: '예약이 취소되었습니다'
      });
      
      operationNamespace.emit('stockAlert', {
        type: 'restored',
        message: '예약 취소로 재고가 복구되었습니다',
        reservationId
      });
      
      socket.emit('reservationCancelled', {
        success: true,
        message: '예약이 취소되었습니다'
      });
      
      logger.info(`예약 취소: ${reservationId}`);
      
    } catch (error) {
      logger.error('예약 취소 에러:', error);
      socket.emit('reservationError', { message: error.message });
    }
  });

  // ============================================
  // 재고 직접 조정 (운영과)
  // ============================================
  socket.on('adjustStock', async (data) => {
    try {
      const { menuId, quantity, type } = data;
      const menu = await Menu.findById(menuId);
      
      if (!menu) {
        socket.emit('stockError', { message: '메뉴를 찾을 수 없습니다' });
        return;
      }
      
      if (type === 'add') {
        menu.currentStock += quantity;
      } else if (type === 'subtract') {
        if (menu.currentStock < quantity) {
          socket.emit('stockError', { message: '재고가 부족합니다' });
          return;
        }
        menu.currentStock -= quantity;
      } else if (type === 'set') {
        menu.currentStock = quantity;
      }
      
      menu.isAvailable = menu.currentStock > 0;
      await menu.save();
      
      const updatedMenus = await Menu.find({ isAvailable: true });
      restaurantNamespace.emit('menuUpdate', { menus: updatedMenus });
      operationNamespace.emit('stockAdjusted', {
        menuId,
        newStock: menu.currentStock,
        type,
        adjustedBy: clientInfo.userName
      });
      
      logger.info(`재고 조정: ${menu.name} ${type} ${quantity} → ${menu.currentStock}개`);
      
    } catch (error) {
      logger.error('재고 조정 에러:', error);
      socket.emit('stockError', { message: error.message });
    }
  });

  // ============================================
  // 데이터 요청 핸들러
  // ============================================
  socket.on('requestMenuUpdate', async () => {
    try {
      const menus = await Menu.find({ isAvailable: true });
      socket.emit('menuUpdate', { menus });
    } catch (error) {
      socket.emit('error', { message: '메뉴 정보 로드 실패' });
    }
  });

  socket.on('requestPreOrders', async (data) => {
    try {
      const { room } = data;
      const today = new Date();
      
      const reservations = await Reservation.find({
        reservationDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        },
        room: room || { $exists: true },
        status: { $in: ['confirmed', 'pending'] }
      }).populate('preOrders.menuItem');
      
      socket.emit('preOrdersUpdate', { reservations });
    } catch (error) {
      socket.emit('error', { message: '선주문 정보 로드 실패' });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    logger.info(`클라이언트 연결 해제: ${socket.id} (${clientInfo.userName})`);
    
    if (clientInfo.room) {
      restaurantNamespace.to(clientInfo.room).emit('userLeft', {
        userName: clientInfo.userName,
        department: clientInfo.department
      });
    }
  });
});

// ============================================
// 운영과 전용 네임스페이스
// ============================================
operationNamespace.on('connection', (socket) => {
  logger.info(`🔧 운영과 클라이언트 연결: ${socket.id}`);
  
  socket.on('joinOperation', async (data) => {
    const { userName } = data;
    logger.info(`운영과 ${userName} 연결됨`);
    
    try {
      const menus = await Menu.find({ isAvailable: true });
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      
      const dailyInventory = await DailyInventory.findOne({ date: dateStr });
      const reservations = await Reservation.find({
        reservationDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      }).populate('preOrders.menuItem');
      
      socket.emit('operationData', {
        menus,
        dailyInventory,
        reservations,
        timestamp: new Date()
      });
      
      const lowStockMenus = menus.filter(m => m.currentStock <= 5);
      if (lowStockMenus.length > 0) {
        socket.emit('stockAlert', {
          type: 'warning',
          message: `${lowStockMenus.length}개 메뉴 재고 부족`,
          menus: lowStockMenus
        });
      }
      
    } catch (error) {
      logger.error('운영 데이터 로드 실패:', error);
      socket.emit('error', { message: '운영 데이터 로드 실패' });
    }
  });
});

// ============================================
// 예약실 전용 네임스페이스
// ============================================
reservationNamespace.on('connection', (socket) => {
  logger.info(`📋 예약실 클라이언트 연결: ${socket.id}`);
  
  socket.on('joinReservation', async (data) => {
    const { userName } = data;
    logger.info(`예약실 ${userName} 연결됨`);
    
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      
      const [menus, reservations, dailyInventory] = await Promise.all([
        Menu.find({ isAvailable: true }),
        Reservation.find({
          reservationDate: {
            $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
          }
        }).sort({ reservationTime: 1 }),
        DailyInventory.findOne({ date: dateStr })
      ]);
      
      socket.emit('reservationData', {
        menus,
        reservations,
        dailyInventory,
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('예약 데이터 로드 실패:', error);
      socket.emit('error', { message: '예약 데이터 로드 실패' });
    }
  });
});

// ============================================
// 에러 핸들링 미들웨어 (라우트 다음에 위치)
// ============================================
app.use(notFound);
app.use(errorHandler);

// ============================================
// 서버 시작
// ============================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`
  🚀 서버 실행 중
  ┌─────────────────────────────────────────────────┐
  │ REST API    : http://localhost:${PORT}              │
  │ WebSocket   : ws://localhost:${PORT}               │
  │ Namespaces  : /restaurant, /operation, /reservation │
  │ Environment : ${process.env.NODE_ENV || 'development'}                     │
  │ MongoDB     : ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'} │
  │ Rate Limit  : ${process.env.NODE_ENV === 'production' ? 'Enabled' : 'Disabled'}            │
  └─────────────────────────────────────────────────┘
  `);
});

// ============================================
// 프로세스 종료 처리
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. 서버 종료 중...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      logger.info('MongoDB 연결 종료');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. 서버 종료 중...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      logger.info('MongoDB 연결 종료');
      process.exit(0);
    });
  });
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = { app, server, io };
