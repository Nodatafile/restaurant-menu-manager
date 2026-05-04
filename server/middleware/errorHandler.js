// server/middleware/errorHandler.js
const logger = require('../utils/logger');

// 404 에러 핸들러
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// 일반 에러 핸들러
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // 로깅
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '서버 오류가 발생했습니다' 
      : err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = { notFound, errorHandler };
