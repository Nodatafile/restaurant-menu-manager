const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    enum: ['main', 'room2', 'room3', 'room4', 'room5', 'room6', 'room9']
  },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, '수량은 1 이상이어야 합니다']
  },
  type: {
    type: String,
    enum: ['order', 'cancel'],
    required: true
  },
  staffName: {
    type: String,
    default: 'Unknown'
  },
  notes: {
    type: String,
    maxlength: [200, '메모는 200자를 초과할 수 없습니다']
  },
  orderDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 인덱스 생성 (검색 성능 향상)
orderSchema.index({ room: 1, orderDate: -1 });
orderSchema.index({ menuItem: 1, type: 1 });
orderSchema.index({ orderDate: -1 });

module.exports = mongoose.model('Order', orderSchema);
