const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const Order = require('../models/Order');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');

// 모든 메뉴 조회
router.get('/', async (req, res) => {
  try {
    const menus = await Menu.find().sort({ createdAt: -1 });
    res.json({ success: true, data: menus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 특정 메뉴 조회
router.get('/:id', async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ success: false, error: '메뉴를 찾을 수 없습니다' });
    }
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 메뉴 생성
router.post('/', [
  body('name').trim().notEmpty().withMessage('메뉴 이름은 필수입니다'),
  body('initialStock').isInt({ min: 0 }).withMessage('유효한 초기 재고를 입력하세요'),
  body('price').optional().isFloat({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  try {
    const menu = new Menu({
      ...req.body,
      currentStock: req.body.initialStock
    });
    
    await menu.save();
    res.status(201).json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 메뉴 수정
router.put('/:id', async (req, res) => {
  try {
    const menu = await Menu.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!menu) {
      return res.status(404).json({ success: false, error: '메뉴를 찾을 수 없습니다' });
    }
    
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 메뉴 삭제 (소프트 삭제)
router.delete('/:id', async (req, res) => {
  try {
    const menu = await Menu.findByIdAndUpdate(
      req.params.id,
      { isAvailable: false },
      { new: true }
    );
    
    if (!menu) {
      return res.status(404).json({ success: false, error: '메뉴를 찾을 수 없습니다' });
    }
    
    res.json({ success: true, message: '메뉴가 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 일일 재고 리셋
router.post('/reset-daily', async (req, res) => {
  try {
    const menus = await Menu.find({});
    
    for (const menu of menus) {
      menu.currentStock = menu.initialStock;
      menu.isAvailable = true;
      await menu.save();
    }
    
    res.json({ success: true, message: '일일 재고가 초기화되었습니다', data: menus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 재고 현황 통계
router.get('/stats/overview', async (req, res) => {
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
          _id: '$type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 모든 라우트에 인증 적용
router.use(authenticate);

module.exports = router;
