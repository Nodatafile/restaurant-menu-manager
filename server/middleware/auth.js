// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT 토큰 검증 미들웨어
const authenticate = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '인증 토큰이 필요합니다'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: '비활성화된 계정입니다'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '인증에 실패했습니다'
    });
  }
};

// 역할 기반 권한 확인 미들웨어
const authorize = (...departments) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다'
      });
    }

    if (!departments.includes(req.user.department)) {
      return res.status(403).json({
        success: false,
        error: '접근 권한이 없습니다'
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
