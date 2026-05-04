const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDB 연결 성공: ${conn.connection.host}`);
    
    // 연결 이벤트 리스너
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB 연결 에러:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB 연결 끊김. 재연결 시도...');
    });
    
  } catch (error) {
    logger.error('MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
