// server/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// 일반 API 속도 제한
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100회 요청
  message: {
    success: false,
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 로그인 속도 제한 (더 엄격하게)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 최대 5회 시도
  message: {
    success: false,
    error: '로그인 시도가 너무 많습니다. 15분 후에 다시 시도해주세요.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 주문/예약 생성 속도 제한
const creationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 30, // 최대 30회
  message: {
    success: false,
    error: '생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  }
});

module.exports = { apiLimiter, loginLimiter, creationLimiter };
