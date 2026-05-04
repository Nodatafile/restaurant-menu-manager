const mongoose = require('mongoose');

const dailyInventorySchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: true,
    unique: true
  },
  menuItems: [{
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    menuName: String,
    initialStock: {
      type: Number,
      required: true
    },
    currentStock: {
      type: Number,
      required: true
    },
    reservedStock: { // 예약으로 인해 미리 차감된 수량
      type: Number,
      default: 0
    },
    actualStock: { // 실제 주문 가능한 수량 (currentStock - reservedStock)
      type: Number,
      required: true
    },
    preOrders: [{
      reservationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation'
      },
      quantity: Number,
      status: {
        type: String,
        enum: ['reserved', 'confirmed', 'served', 'cancelled'],
        default: 'reserved'
      }
    }]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// actualStock 계산
dailyInventorySchema.methods.updateActualStock = function(menuId) {
  const menuItem = this.menuItems.find(item => 
    item.menuId.toString() === menuId.toString()
  );
  
  if (menuItem) {
    const totalReserved = menuItem.preOrders
      .filter(po => ['reserved', 'confirmed'].includes(po.status))
      .reduce((sum, po) => sum + po.quantity, 0);
    
    menuItem.reservedStock = totalReserved;
    menuItem.actualStock = Math.max(0, menuItem.currentStock - totalReserved);
  }
};

module.exports = mongoose.model('DailyInventory', dailyInventorySchema);
