// server/routes/operationRoutes.js
const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { authenticate, authorize } = require('../middleware/auth');

// 모든 라우트에 인증 적용
router.use(authenticate);

// 운영과 전용 빠른 재고 조정
router.post('/stock-adjust', authorize('operation', 'admin'), async (req, res) => {
  try {
    const { menuId, quantity, type, room } = req.body;
    const menu = await Menu.findById(menuId);
    
    if (!menu) {
      return res.status(404).json({ success: false, error: '메뉴를 찾을 수 없습니다' });
    }
    
    if (type === 'add') {
      menu.currentStock += quantity;
    } else if (type === 'subtract') {
      if (menu.currentStock < quantity) {
        return res.status(400).json({ success: false, error: '재고가 부족합니다' });
      }
      menu.currentStock -= quantity;
    } else if (type === 'set') {
      menu.currentStock = quantity;
    }
    
    menu.isAvailable = menu.currentStock > 0;
    await menu.save();
    
    // 실시간 업데이트
    const io = req.app.get('io');
    if (io) {
      const updatedMenus = await Menu.find({ isAvailable: true });
      io.of('/restaurant').emit('menuUpdate', { menus: updatedMenus });
      io.of('/operation').emit('stockAdjusted', {
        menuId,
        newStock: menu.currentStock,
        type,
        adjustedBy: req.user.name
      });
    }
    
    res.json({ success: true, currentStock: menu.currentStock });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 운영과 모바일 대시보드 데이터
router.get('/mobile-dashboard', authorize('operation', 'admin'), async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const [menus, reservations, recentOrders] = await Promise.all([
      Menu.find({ isAvailable: true }).select('-__v'),
      Reservation.find({
        reservationDate: { $gte: startOfDay, $lt: endOfDay },
        status: { $in: ['confirmed', 'pending'] }
      })
      .populate('preOrders.menuItem', 'name price')
      .select('-__v'),
      Order.find({
        orderDate: { $gte: startOfDay }
      })
      .populate('menuItem', 'name price')
      .sort({ orderDate: -1 })
      .limit(50)
      .select('-__v')
    ]);
    
    res.json({
      success: true,
      data: {
        menus: menus.map(m => ({
          id: m._id,
          name: m.name,
          currentStock: m.currentStock,
          initialStock: m.initialStock,
          price: m.price,
          category: m.category
        })),
        reservations: reservations.map(r => ({
          id: r._id,
          reservationNumber: r.reservationNumber,
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// 재고 현황 상세
router.get('/stock-status', authorize('operation', 'admin'), async (req, res) => {
  try {
    const menus = await Menu.find({ isAvailable: true }).select('-__v');
    
    const stockStatus = menus.map(menu => ({
      menuId: menu._id,
      menuName: menu.name,
      currentStock: menu.currentStock,
      initialStock: menu.initialStock,
      status: menu.currentStock === 0 ? 'sold_out' :
              menu.currentStock <= 5 ? 'low_stock' :
              menu.currentStock <= 10 ? 'moderate' : 'available',
      utilizationRate: ((1 - menu.currentStock / menu.initialStock) * 100).toFixed(1)
    }));
    
    res.json({ success: true, data: stockStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 주문 내역 조회 (회의실별)
router.get('/orders/:room', authorize('operation', 'admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orders = await Order.find({
      room: req.params.room,
      orderDate: { $gte: today }
    })
    .populate('menuItem', 'name price')
    .sort({ orderDate: -1 })
    .limit(100);
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
