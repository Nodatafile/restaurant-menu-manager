const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('환경변수 MONGODB_URI가 설정되지 않았습니다.');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // performance, stability을 위해 옵션 추가
      // Render 같은 클라우드 환경에서 connection drop 방지에 효과적
      serverSelectionTimeoutMS: 10000, // 연결 시도 타임아웃
      socketTimeoutMS: 45000, // 소켓 비활성 타임아웃
    });
    
    console.log(`✅ MongoDB 연결 성공: ${conn.connection.host}`);
    
  } catch (error) {
    console.error(`❌ MongoDB 연결 실패 사유: ${error.message}`);
    // 프로세스를 종료해야 Render가 배포 실패로 인지하고 재시도합니다.
    process.exit(1); 
  }
};

module.exports = connectDB;
