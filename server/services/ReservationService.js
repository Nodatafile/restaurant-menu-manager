const Reservation = require('../models/Reservation');
const DailyInventory = require('../models/DailyInventory');
const Menu = require('../models/Menu');

class ReservationService {
  // 예약 생성 (선주문 포함)
  static async createReservation(reservationData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. 예약 생성
      const reservation = new Reservation({
        ...reservationData,
        history: [{
          action: 'created',
          timestamp: new Date(),
          performedBy: reservationData.createdBy || 'system',
          details: '예약 생성됨'
        }]
      });
      
      // 선주문 총액 계산
      if (reservationData.preOrders && reservationData.preOrders.length > 0) {
        let totalAmount = 0;
        for (const preOrder of reservationData.preOrders) {
          const menu = await Menu.findById(preOrder.menuItem);
          if (!menu) {
            throw new Error(`메뉴를 찾을 수 없습니다: ${preOrder.menuItem}`);
          }
          preOrder.menuName = menu.name;
          preOrder.price = menu.price;
          totalAmount += menu.price * preOrder.quantity;
        }
        reservation.totalPreOrderAmount = totalAmount;
      }
      
      await reservation.save({ session });
      
      // 2. 당일 재고 업데이트
      const reservationDate = new Date(reservationData.reservationDate);
      const dateStr = reservationDate.toISOString().slice(0, 10);
      
      let dailyInventory = await DailyInventory.findOne({ date: dateStr });
      
      if (!dailyInventory) {
        // 해당 날짜의 재고가 없으면 생성
        const menus = await Menu.find({ isAvailable: true });
        dailyInventory = new DailyInventory({
          date: dateStr,
          menuItems: menus.map(menu => ({
            menuId: menu._id,
            menuName: menu.name,
            initialStock: menu.initialStock,
            currentStock: menu.currentStock,
            actualStock: menu.currentStock,
            preOrders: []
          }))
        });
      }
      
      // 3. 선주문 반영
      if (reservationData.preOrders && reservationData.preOrders.length > 0) {
        for (const preOrder of reservationData.preOrders) {
          const menuItem = dailyInventory.menuItems.find(item =>
            item.menuId.toString() === preOrder.menuItem.toString()
          );
          
          if (!menuItem) {
            throw new Error(`일일 재고에서 메뉴를 찾을 수 없습니다: ${preOrder.menuItem}`);
          }
          
          if (menuItem.actualStock < preOrder.quantity) {
            throw new Error(
              `${menuItem.menuName}의 예약 가능 수량이 부족합니다. ` +
              `(가용: ${menuItem.actualStock}, 요청: ${preOrder.quantity})`
            );
          }
          
          menuItem.preOrders.push({
            reservationId: reservation._id,
            quantity: preOrder.quantity,
            status: 'reserved'
          });
          
          dailyInventory.updateActualStock(preOrder.menuItem);
        }
      }
      
      await dailyInventory.save({ session });
      
      await session.commitTransaction();
      
      // Socket.io 이벤트 발생을 위한 객체 반환
      return {
        reservation,
        dailyInventory,
        affectedMenus: dailyInventory.menuItems.filter(item =>
          item.preOrders.some(po => 
            po.reservationId.toString() === reservation._id.toString()
          )
        )
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // 예약 취소
  static async cancelReservation(reservationId, cancelledBy = 'system') {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        throw new Error('예약을 찾을 수 없습니다');
      }
      
      reservation.status = 'cancelled';
      reservation.history.push({
        action: 'cancelled',
        performedBy: cancelledBy,
        details: '예약 취소됨'
      });
      await reservation.save({ session });
      
      // 선주문 복구
      if (reservation.preOrders && reservation.preOrders.length > 0) {
        const dateStr = reservation.reservationDate.toISOString().slice(0, 10);
        const dailyInventory = await DailyInventory.findOne({ date: dateStr });
        
        if (dailyInventory) {
          for (const preOrder of reservation.preOrders) {
            const menuItem = dailyInventory.menuItems.find(item =>
              item.menuId.toString() === preOrder.menuItem.toString()
            );
            
            if (menuItem) {
              // 예약 상태 변경
              const preOrderEntry = menuItem.preOrders.find(po =>
                po.reservationId.toString() === reservation._id.toString()
              );
              if (preOrderEntry) {
                preOrderEntry.status = 'cancelled';
              }
              
              dailyInventory.updateActualStock(preOrder.menuItem);
            }
          }
          
          await dailyInventory.save({ session });
        }
      }
      
      await session.commitTransaction();
      return { reservation, message: '예약이 취소되었습니다' };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // 당일 예약 현황 조회
  static async getDailyReservations(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const reservations = await Reservation.find({
      reservationDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    })
    .populate('preOrders.menuItem')
    .sort({ reservationTime: 1 });
    
    // 회의실별 예약 현황 집계
    const roomStatus = {};
    const rooms = ['main', 'room2', 'room3', 'room4', 'room5', 'room6', 'room9'];
    
    rooms.forEach(room => {
      roomStatus[room] = {
        totalReservations: 0,
        totalGuests: 0,
        preOrdersSummary: {},
        timeSlots: {}
      };
    });
    
    reservations.forEach(reservation => {
      const room = roomStatus[reservation.room];
      room.totalReservations++;
      room.totalGuests += reservation.numberOfGuests;
      
      // 시간대별
      if (!room.timeSlots[reservation.reservationTime]) {
        room.timeSlots[reservation.reservationTime] = [];
      }
      room.timeSlots[reservation.reservationTime].push({
        reservationId: reservation._id,
        customerName: reservation.customerName,
        guests: reservation.numberOfGuests,
        preOrders: reservation.preOrders.length
      });
      
      // 선주문 집계
      reservation.preOrders.forEach(preOrder => {
        if (!room.preOrdersSummary[preOrder.menuName]) {
          room.preOrdersSummary[preOrder.menuName] = 0;
        }
        room.preOrdersSummary[preOrder.menuName] += preOrder.quantity;
      });
    });
    
    return {
      date,
      totalReservations: reservations.length,
      roomStatus,
      reservations: reservations.map(r => ({
        id: r._id,
        reservationNumber: r.reservationNumber,
        customerName: r.customerName,
        room: r.room,
        time: r.reservationTime,
        guests: r.numberOfGuests,
        status: r.status,
        preOrdersCount: r.preOrders.length,
        totalAmount: r.totalPreOrderAmount
      }))
    };
  }
  
  // 실시간 재고 현황 (예약 선주문 반영)
  static async getRealtimeStock(date) {
    const dateStr = new Date(date).toISOString().slice(0, 10);
    let dailyInventory = await DailyInventory.findOne({ date: dateStr })
      .populate('menuItems.menuId')
      .populate('menuItems.preOrders.reservationId');
    
    if (!dailyInventory) {
      // 해당 날짜의 재고가 없으면 생성
      const menus = await Menu.find({ isAvailable: true });
      dailyInventory = new DailyInventory({
        date: dateStr,
        menuItems: menus.map(menu => ({
          menuId: menu._id,
          menuName: menu.name,
          initialStock: menu.initialStock,
          currentStock: menu.currentStock,
          actualStock: menu.currentStock,
          preOrders: []
        }))
      });
    }
    
    // 재고 상태 분석
    const stockStatus = dailyInventory.menuItems.map(item => ({
      menuId: item.menuId._id,
      menuName: item.menuName,
      totalStock: item.currentStock,
      reservedForPreOrders: item.reservedStock,
      availableForOrder: item.actualStock,
      utilizationRate: ((item.reservedStock / item.initialStock) * 100).toFixed(1),
      status: item.actualStock === 0 ? 'sold_out' :
              item.actualStock <= 5 ? 'low_stock' :
              item.actualStock <= 10 ? 'moderate' : 'available',
      preOrderDetails: item.preOrders.map(po => ({
        reservationNumber: po.reservationId?.reservationNumber,
        customerName: po.reservationId?.customerName,
        quantity: po.quantity,
        status: po.status
      }))
    }));
    
    return {
      date: dateStr,
      lastUpdated: dailyInventory.lastUpdated,
      stockStatus,
      summary: {
        totalMenus: stockStatus.length,
        soldOutMenus: stockStatus.filter(s => s.status === 'sold_out').length,
        lowStockMenus: stockStatus.filter(s => s.status === 'low_stock').length,
        totalPreOrders: stockStatus.reduce((sum, s) => sum + s.preOrderDetails.length, 0)
      }
    };
  }
}

module.exports = ReservationService;
