// server/routes/operationRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// 운영과 전용 빠른 재고 조정
router.post('/stock-adjust', auth('operation'), async (req, res) => {
  try {
    const { menuId, quantity, type, room } = req.body;
    const menu = await Menu.findById(menuId);
    
    if (!menu) {
      return res.status(404).json({ error: '메뉴를 찾을 수 없습니다' });
    }
    
    if (type === 'add') {
      menu.currentStock += quantity;
    } else {
      if (menu.currentStock < quantity) {
        return res.status(400).json({ error: '재고가 부족합니다' });
      }
      menu.currentStock -= quantity;
    }
    
    await menu.save();
    
    // 실시간 업데이트
    req.app.get('io').emit('stockAdjusted', {
      menuId,
      newStock: menu.currentStock,
      room,
      type
    });
    
    res.json({ success: true, currentStock: menu.currentStock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 운영과 모바일 대시보드 데이터
router.get('/mobile-dashboard', auth('operation'), async (req, res) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    
    const [menus, reservations, recentOrders] = await Promise.all([
      Menu.find({ isAvailable: true }),
      Reservation.find({
        reservationDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      }).populate('preOrders.menuItem'),
      Order.find({
        orderDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        }
      }).populate('menuItem').sort({ orderDate: -1 }).limit(20)
    ]);
    
    res.json({
      success: true,
      data: {
        menus: menus.map(m => ({
          id: m._id,
          name: m.name,
          currentStock: m.currentStock,
          initialStock: m.initialStock
        })),
        reservations: reservations.map(r => ({
          id: r._id,
          customerName: r.customerName,
          room: r.room,
          time: r.reservationTime,
          guests: r.numberOfGuests,
          preOrders: r.preOrders
        })),
        recentOrders
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
