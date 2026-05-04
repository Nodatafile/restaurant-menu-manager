// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['reservation', 'operation', 'admin'],
    required: true
  },
  role: {
    type: String,
    enum: ['manager', 'staff', 'supervisor'],
    default: 'staff'
  },
  permissions: {
    canManageReservations: { type: Boolean, default: false },
    canManageStock: { type: Boolean, default: false },
    canPlaceOrders: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  deviceTokens: [String] // 푸시 알림용
}, {
  timestamps: true
});

// 비밀번호 해싱
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 권한 자동 설정
userSchema.pre('save', function(next) {
  switch(this.department) {
    case 'reservation':
      this.permissions = {
        canManageReservations: true,
        canManageStock: false,
        canPlaceOrders: true,
        canViewReports: true
      };
      break;
    case 'operation':
      this.permissions = {
        canManageReservations: false,
        canManageStock: true,
        canPlaceOrders: true,
        canViewReports: true
      };
      break;
    case 'admin':
      this.permissions = {
        canManageReservations: true,
        canManageStock: true,
        canPlaceOrders: true,
        canViewReports: true
      };
      break;
  }
  next();
});

// 기존 User 모델에 이 메서드 추가
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('비밀번호 비교 실패');
  }
};

module.exports = mongoose.model('User', userSchema);
