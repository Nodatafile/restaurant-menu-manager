// server/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const { authenticate, authorize } = require('../middleware/auth');

// 주문 생성
router.post('/', async (req, res) => {
  try {
    const { room, menuId, quantity, staffName } = req.body;

    // 메뉴 확인
    const menu = await Menu.findById(menuId);
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: '메뉴를 찾을 수 없습니다'
      });
    }

    // 재고 확인
    if (menu.currentStock < quantity) {
      return res.status(400).json({
        success: false,
        error: `재고가 부족합니다. 현재 재고: ${menu.currentStock}개`
      });
    }

    // 주문 생성
    const order = new Order({
      room,
      menuItem: menuId,
      quantity,
      type: 'order',
      staffName: staffName || req.user.name
    });

    await order.save();

    // 재고 감소
    menu.currentStock -= quantity;
    await menu.save();

    await order.populate('menuItem');

    // Socket.io 이벤트
    req.app.get('io').of('/restaurant').emit('newOrder', order);

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 오늘의 주문 내역 조회
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      orderDate: { $gte: today }
    })
    .populate('menuItem')
    .sort({ orderDate: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 회의실별 주문 내역
router.get('/room/:room', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      room: req.params.room,
      orderDate: { $gte: today }
    })
    .populate('menuItem')
    .sort({ orderDate: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 주문 통계
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: today }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            room: '$room'
          },
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          rooms: {
            $push: {
              room: '$_id.room',
              count: '$count',
              quantity: '$totalQuantity'
            }
          },
          totalOrders: { $sum: '$count' },
          totalQuantity: { $sum: '$totalQuantity' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
