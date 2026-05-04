const Menu = require('../models/Menu');
const Order = require('../models/Order');

module.exports = (io) => {
  // 네임스페이스 설정
  const mainNamespace = io.of('/restaurant');
  
  mainNamespace.on('connection', (socket) => {
    console.log(`새 클라이언트 연결: ${socket.id}`);
    
    // 룸(회의실) 조인
    socket.on('joinRoom', async (room) => {
      socket.join(room);
      console.log(`클라이언트 ${socket.id}가 ${room}에 조인`);
      
      // 해당 방의 현재 메뉴 상태 전송
      const menus = await Menu.find({ isAvailable: true });
      socket.emit('menuUpdate', menus);
    });
    
    // 주문 생성
    socket.on('placeOrder', async (orderData) => {
      try {
        const { room, menuId, quantity, staffName } = orderData;
        
        // 메뉴 확인 및 재고 체크
        const menu = await Menu.findById(menuId);
        if (!menu) {
          socket.emit('orderError', { message: '메뉴를 찾을 수 없습니다' });
          return;
        }
        
        if (menu.currentStock < quantity) {
          socket.emit('orderError', { message: '재고가 부족합니다' });
          return;
        }
        
        // 주문 생성
        const order = new Order({
          room,
          menuItem: menuId,
          quantity,
          type: 'order',
          staffName
        });
        
        await order.save();
        
        // 재고 감소
        menu.currentStock -= quantity;
        if (menu.currentStock <= 0) {
          menu.isAvailable = false;
        }
        await menu.save();
        
        // 생성된 주문 populate
        await order.populate('menuItem');
        
        // 모든 클라이언트에 업데이트 브로드캐스트
        const updatedMenus = await Menu.find({ isAvailable: true });
        mainNamespace.emit('menuUpdate', updatedMenus);
        mainNamespace.emit('newOrder', order);
        
        // 특정 룸에만 알림
        mainNamespace.to(room).emit('roomOrderUpdate', {
          message: `${menu.name} ${quantity}개 주문 완료`,
          order
        });
        
      } catch (error) {
        socket.emit('orderError', { message: error.message });
      }
    });
    
    // 주문 취소
    socket.on('cancelOrder', async (cancelData) => {
      try {
        const { room, menuId, quantity, staffName } = cancelData;
        
        const menu = await Menu.findById(menuId);
        if (!menu) {
          socket.emit('cancelError', { message: '메뉴를 찾을 수 없습니다' });
          return;
        }
        
        // 취소 주문 생성
        const cancelOrder = new Order({
          room,
          menuItem: menuId,
          quantity,
          type: 'cancel',
          staffName
        });
        
        await cancelOrder.save();
        
        // 재고 복구
        menu.currentStock += quantity;
        menu.isAvailable = true;
        await menu.save();
        
        await cancelOrder.populate('menuItem');
        
        // 업데이트 브로드캐스트
        const updatedMenus = await Menu.find({ isAvailable: true });
        mainNamespace.emit('menuUpdate', updatedMenus);
        mainNamespace.emit('cancelledOrder', cancelOrder);
        
        mainNamespace.to(room).emit('roomOrderUpdate', {
          message: `${menu.name} ${quantity}개 취소 완료`,
          order: cancelOrder
        });
        
      } catch (error) {
        socket.emit('cancelError', { message: error.message });
      }
    });
    
    // 재고 업데이트 요청
    socket.on('requestMenuUpdate', async () => {
      const menus = await Menu.find({ isAvailable: true });
      socket.emit('menuUpdate', menus);
    });
    
    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`클라이언트 연결 해제: ${socket.id}`);
    });
  });
};
