const express = require('express');
const router = express.Router();
const ReservationService = require('../services/ReservationService');
const Reservation = require('../models/Reservation');
const DailyInventory = require('../models/DailyInventory');

// 예약 생성 (선주문 포함)
router.post('/', async (req, res) => {
  try {
    const result = await ReservationService.createReservation(req.body);
    
    // WebSocket 이벤트 발생
    req.app.get('io').emit('reservationCreated', {
      reservation: result.reservation,
      stockUpdate: result.affectedMenus
    });
    
    res.status(201).json({
      success: true,
      data: result.reservation,
      message: '예약이 완료되었습니다'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 예약 취소
router.post('/:id/cancel', async (req, res) => {
  try {
    const result = await ReservationService.cancelReservation(
      req.params.id,
      req.body.cancelledBy
    );
    
    req.app.get('io').emit('reservationCancelled', {
      reservationId: req.params.id,
      message: '예약이 취소되었습니다'
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 당일 예약 현황
router.get('/daily/:date', async (req, res) => {
  try {
    const result = await ReservationService.getDailyReservations(req.params.date);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 실시간 재고 현황
router.get('/stock/:date', async (req, res) => {
  try {
    const stockStatus = await ReservationService.getRealtimeStock(req.params.date);
    res.json({ success: true, data: stockStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 예약 가능 여부 확인
router.get('/availability', async (req, res) => {
  try {
    const { date, time, room, guests } = req.query;
    
    // 해당 시간대 예약 수 확인
    const existingReservations = await Reservation.countDocuments({
      reservationDate: new Date(date),
      reservationTime: time,
      room: room,
      status: { $ne: 'cancelled' }
    });
    
    // 룸별 최대 수용 인원 (설정 가능)
    const roomCapacities = {
      main: 100,
      room2: 20,
      room3: 15,
      room4: 15,
      room5: 20,
      room6: 25,
      room9: 30
    };
    
    const isAvailable = {
      timeSlotAvailable: existingReservations === 0, // 한 타임에 한 예약만 (설정에 따라 변경 가능)
      capacityOk: parseInt(guests) <= roomCapacities[room],
      canReserve: false
    };
    
    isAvailable.canReserve = isAvailable.timeSlotAvailable && isAvailable.capacityOk;
    
    res.json({
      success: true,
      data: {
        ...isAvailable,
        maxCapacity: roomCapacities[room],
        currentReservations: existingReservations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 예약 목록 조회 (필터링)
router.get('/list', async (req, res) => {
  try {
    const { date, room, status, search } = req.query;
    const filter = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.reservationDate = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (room) filter.room = room;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } },
        { reservationNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const reservations = await Reservation.find(filter)
      .populate('preOrders.menuItem')
      .sort({ reservationDate: -1, reservationTime: 1 });
    
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
