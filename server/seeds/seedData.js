// server/seeds/seedData.js
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Menu = require('../models/Menu');
const connectDB = require('../config/database');

const seedData = async () => {
  try {
    await connectDB();
    console.log('데이터베이스 연결됨');

    // 기존 데이터 삭제
    await User.deleteMany({});
    await Menu.deleteMany({});

    // 사용자 생성
    const users = [
      {
        employeeId: 'RES001',
        name: '김예약',
        password: 'password123',
        department: 'reservation',
        role: 'staff'
      },
      {
        employeeId: 'OPS001',
        name: '이운영',
        password: 'password123',
        department: 'operation',
        role: 'staff'
      },
      {
        employeeId: 'OPS002',
        name: '박서빙',
        password: 'password123',
        department: 'operation',
        role: 'staff'
      },
      {
        employeeId: 'ADM001',
        name: '최관리',
        password: 'password123',
        department: 'admin',
        role: 'manager'
      }
    ];

    const createdUsers = await User.create(users);
    console.log(`${createdUsers.length}명의 사용자 생성됨`);

    // 메뉴 생성
    const menus = [
      {
        name: '불고기',
        category: 'main',
        initialStock: 30,
        currentStock: 30,
        price: 15000
      },
      {
        name: '김치찌개',
        category: 'main',
        initialStock: 25,
        currentStock: 25,
        price: 12000
      },
      {
        name: '된장찌개',
        category: 'main',
        initialStock: 20,
        currentStock: 20,
        price: 10000
      },
      {
        name: '비빔밥',
        category: 'main',
        initialStock: 35,
        currentStock: 35,
        price: 13000
      },
      {
        name: '잡채',
        category: 'side',
        initialStock: 20,
        currentStock: 20,
        price: 8000
      },
      {
        name: '해물파전',
        category: 'side',
        initialStock: 15,
        currentStock: 15,
        price: 10000
      },
      {
        name: '식혜',
        category: 'drink',
        initialStock: 40,
        currentStock: 40,
        price: 3000
      }
    ];

    const createdMenus = await Menu.create(menus);
    console.log(`${createdMenus.length}개 메뉴 생성됨`);

    console.log('✅ 초기 데이터 생성 완료!');
    console.log('\n--- 테스트 계정 ---');
    console.log('예약실: RES001 / password123');
    console.log('운영과: OPS001 / password123');
    console.log('관리자: ADM001 / password123');

    process.exit(0);
  } catch (error) {
    console.error('시드 데이터 생성 실패:', error);
    process.exit(1);
  }
};

seedData();
