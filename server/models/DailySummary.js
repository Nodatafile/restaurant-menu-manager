const mongoose = require('mongoose');

const dailySummarySchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD 형식
    required: true,
    unique: true
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalCancelled: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  menuStats: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu'
    },
    totalOrdered: Number,
    totalCancelled: Number,
    revenue: Number
  }],
  roomStats: [{
    room: String,
    orderCount: Number,
    revenue: Number
  }]
});

module.exports = mongoose.model('DailySummary', dailySummarySchema);
