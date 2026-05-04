// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    // 사용자 확인
    const user = await User.findOne({ employeeId });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '사번 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: '사번 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 계정 활성화 확인
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: '비활성화된 계정입니다. 관리자에게 문의하세요.'
      });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: user._id, department: user.department },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '12h' }
    );

    // 마지막 로그인 시간 업데이트
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        department: user.department,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다'
    });
  }
});

// 현재 사용자 정보 조회
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '사용자 정보 조회 실패'
    });
  }
});

// 로그아웃
router.post('/logout', authenticate, async (req, res) => {
  // 클라이언트에서 토큰 삭제
  res.json({
    success: true,
    message: '로그아웃 되었습니다'
  });
});

// 비밀번호 변경
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: '현재 비밀번호가 올바르지 않습니다'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: '비밀번호가 변경되었습니다'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '비밀번호 변경 실패'
    });
  }
});

module.exports = router;
