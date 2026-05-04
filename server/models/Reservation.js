const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  reservationNumber: {
    type: String,
    unique: true,
    required: true
  },
  customerName: {
    type: String,
    required: [true, '예약자명은 필수입니다'],
    trim: true
  },
  contactNumber: {
    type: String,
    required: [true, '연락처는 필수입니다'],
    match: [/^\d{2,3}-\d{3,4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다']
  },
  room: {
    type: String,
    required: true,
    enum: ['main', 'room2', 'room3', 'room4', 'room5', 'room6', 'room9']
  },
  reservationDate: {
    type: Date,
    required: true
  },
  reservationTime: {
    type: String,
    required: true,
    enum: ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
           '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00']
  },
  numberOfGuests: {
    type: Number,
    required: true,
    min: [1, '최소 1명 이상이어야 합니다'],
    max: [50, '최대 50명까지 가능합니다']
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'completed', 'no-show'],
    default: 'confirmed'
  },
  preOrders: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    menuName: String, // 당시 메뉴명 저장 (메뉴가 변경될 수 있으므로)
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: Number, // 당시 가격 저장
    specialRequests: {
      type: String,
      maxlength: 200
    }
  }],
  totalPreOrderAmount: {
    type: Number,
    default: 0
  },
  specialRequests: {
    type: String,
    maxlength: 500
  },
  isAllergies: [{
    type: String
  }],
  createdBy: {
    type: String,
    default: 'system'
  },
  notes: [{
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: String
  }],
  history: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: String,
    details: String
  }]
}, {
  timestamps: true
});

// 예약 번호 자동 생성
reservationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('Reservation').countDocuments({
      reservationDate: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    this.reservationNumber = `R${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// 인덱스 생성
reservationSchema.index({ reservationDate: 1, room: 1, reservationTime: 1 });
reservationSchema.index({ reservationNumber: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ customerName: 1, contactNumber: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
