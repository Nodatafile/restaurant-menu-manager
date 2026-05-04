const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '메뉴 이름은 필수입니다'],
    trim: true,
    maxlength: [100, '메뉴 이름은 100자를 초과할 수 없습니다']
  },
  category: {
    type: String,
    enum: ['main', 'side', 'drink', 'dessert'],
    default: 'main'
  },
  initialStock: {
    type: Number,
    required: true,
    min: [0, '초기 재고는 0 이상이어야 합니다']
  },
  currentStock: {
    type: Number,
    required: true,
    min: [0, '현재 재고는 0 이상이어야 합니다']
  },
  price: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 재고 부족 여부 가상 필드
menuSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= 5;
});

// 재고 소진 여부 가상 필드
menuSchema.virtual('isOutOfStock').get(function() {
  return this.currentStock <= 0;
});

// 업데이트 시 updatedAt 자동 갱신
menuSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Menu', menuSchema);
