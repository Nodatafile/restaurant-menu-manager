import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const OperationMobile = () => {
  const { menus, placeOrder } = useSocket();
  const [selectedRoom, setSelectedRoom] = useState('main');
  const [activeTab, setActiveTab] = useState('stock');
  const [stockUpdates, setStockUpdates] = useState({});
  const [pendingChanges, setPendingChanges] = useState([]);

  const rooms = [
    { id: 'main', name: '메인', icon: '🏠' },
    { id: 'room2', name: '2회의', icon: '2️⃣' },
    { id: 'room3', name: '3회의', icon: '3️⃣' },
    { id: 'room4', name: '4회의', icon: '4️⃣' },
    { id: 'room5', name: '5회의', icon: '5️⃣' },
    { id: 'room6', name: '6회의', icon: '6️⃣' },
    { id: 'room9', name: '9회의', icon: '9️⃣' }
  ];

  // 탭 변경 시 진동 피드백
  const handleTabChange = (tab) => {
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    setActiveTab(tab);
  };

  // 빠른 수량 조정 (+/-)
  const quickStockAdjust = async (menuId, change) => {
    const key = menuId;
    const currentChange = stockUpdates[key] || 0;
    const newChange = currentChange + change;
    
    setStockUpdates(prev => ({
      ...prev,
      [key]: newChange
    }));

    setPendingChanges(prev => {
      const existing = prev.find(c => c.menuId === menuId);
      if (existing) {
        return prev.map(c => 
          c.menuId === menuId ? { ...c, quantity: newChange } : c
        );
      }
      return [...prev, { menuId, quantity: newChange }];
    });

    // 진동 피드백
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // 변경사항 적용
  const applyChanges = async () => {
    try {
      for (const change of pendingChanges) {
        if (change.quantity > 0) {
          await axios.post('/api/orders/stock-adjust', {
            menuId: change.menuId,
            quantity: change.quantity,
            type: 'add',
            room: selectedRoom,
            adjustedBy: 'operation'
          });
        } else if (change.quantity < 0) {
          await axios.post('/api/orders/stock-adjust', {
            menuId: change.menuId,
            quantity: Math.abs(change.quantity),
            type: 'subtract',
            room: selectedRoom,
            adjustedBy: 'operation'
          });
        }
      }
      
      setStockUpdates({});
      setPendingChanges([]);
      
      // 성공 진동
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    } catch (error) {
      alert('재고 조정 실패: ' + error.message);
    }
  };

  // 재고 현황 탭
  const StockTab = () => (
    <div className="p-4">
      {/* 회의실 선택 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              selectedRoom === room.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {room.icon} {room.name}
          </button>
        ))}
      </div>

      {/* 재고 현황 카드 */}
      <div className="space-y-3">
        {menus.map(menu => {
          const adjustment = stockUpdates[menu._id] || 0;
          const displayStock = menu.currentStock + adjustment;
          
          return (
            <motion.div
              key={menu._id}
              layout
              className={`p-4 rounded-xl shadow-sm border ${
                displayStock <= 0 ? 'border-red-300 bg-red-50' :
                displayStock <= 5 ? 'border-yellow-300 bg-yellow-50' :
                'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-bold text-lg">{menu.name}</h3>
                  <p className="text-sm text-gray-600">
                    초기: {menu.initialStock}개
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    displayStock <= 0 ? 'text-red-600' :
                    displayStock <= 5 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {displayStock}
                  </div>
                  <p className="text-xs text-gray-500">현재 재고</p>
                </div>
              </div>

              {/* 빠른 조정 버튼 */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => quickStockAdjust(menu._id, -1)}
                  disabled={displayStock <= 0}
                  className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xl disabled:opacity-50"
                >
                  -
                </button>
                
                <div className="flex-1 text-center">
                  {adjustment !== 0 && (
                    <span className={`text-sm font-semibold ${
                      adjustment > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {adjustment > 0 ? '+' : ''}{adjustment}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => quickStockAdjust(menu._id, 1)}
                  className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xl"
                >
                  +
                </button>

                {/* 품절 처리 */}
                <button
                  onClick={() => quickStockAdjust(menu._id, -displayStock)}
                  className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm"
                >
                  품절
                </button>
              </div>

              {/* 예약 선주문 표시 */}
              {menu.reservedQuantity > 0 && (
                <div className="mt-2 text-xs text-orange-600">
                  📋 예약 선주문: {menu.reservedQuantity}개
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 적용 버튼 */}
      {pendingChanges.length > 0 && (
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          onClick={applyChanges}
          className="fixed bottom-20 left-4 right-4 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-2xl"
        >
          변경사항 적용 ({pendingChanges.length}개)
        </motion.button>
      )}
    </div>
  );

  // 주문 관리 탭
  const OrdersTab = () => {
    const [orderQuantity, setOrderQuantity] = useState({});
    const [selectedMenu, setSelectedMenu] = useState(null);

    return (
      <div className="p-4">
        {/* 빠른 주문 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {menus.filter(m => m.currentStock > 0).map(menu => (
            <motion.button
              key={menu._id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedMenu(menu)}
              className={`p-4 rounded-xl text-left ${
                selectedMenu?._id === menu._id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="font-bold">{menu.name}</div>
              <div className="text-sm mt-1">
                남은 수량: {menu.currentStock}
              </div>
            </motion.button>
          ))}
        </div>

        {/* 선택된 메뉴 주문 */}
        {selectedMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-4 mb-4"
          >
            <h3 className="font-bold text-lg mb-2">{selectedMenu.name}</h3>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setOrderQuantity(prev => ({
                  ...prev,
                  [selectedMenu._id]: Math.max(1, (prev[selectedMenu._id] || 1) - 1)
                }))}
                className="w-8 h-8 bg-gray-200 rounded-full"
              >
                -
              </button>
              <span className="text-2xl font-bold">
                {orderQuantity[selectedMenu._id] || 1}
              </span>
              <button
                onClick={() => setOrderQuantity(prev => ({
                  ...prev,
                  [selectedMenu._id]: Math.min(selectedMenu.currentStock, (prev[selectedMenu._id] || 1) + 1)
                }))}
                className="w-8 h-8 bg-gray-200 rounded-full"
              >
                +
              </button>
            </div>
            <button
              onClick={() => {
                placeOrder({
                  room: selectedRoom,
                  menuId: selectedMenu._id,
                  quantity: orderQuantity[selectedMenu._id] || 1,
                  staffName: '운영과'
                });
                setSelectedMenu(null);
              }}
              className="w-full bg-green-500 text-white py-3 rounded-lg font-bold"
            >
              주문 완료
            </button>
          </motion.div>
        )}
      </div>
    );
  };

  // 예약 선주문 확인 탭
  const PreOrdersTab = () => {
    const [preOrders, setPreOrders] = useState([]);

    useEffect(() => {
      fetchPreOrders();
    }, []); // eslint-disable-line

    const fetchPreOrders = async () => {
      try {
        const response = await axios.get(`/api/reservations/preorders/${selectedRoom}`);
        setPreOrders(response.data.data);
      } catch (error) {
        console.error('선주문 조회 실패:', error);
      }
    };

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">📋 예약 선주문 현황</h2>
        <div className="space-y-4">
          {preOrders.map((reservation, index) => (
            <div key={index} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold">{reservation.customerName}</h3>
                  <p className="text-sm text-gray-600">
                    {reservation.time} • {reservation.guests}명
                  </p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                  예약확정
                </span>
              </div>
              <div className="border-t pt-3">
                {reservation.preOrders.map((preOrder, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1">
                    <span>{preOrder.menuName}</span>
                    <span className="font-semibold">{preOrder.quantity}개</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* 상단 헤더 */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">🍽️ 운영 관리</h1>
          <button
            onClick={() => setActiveTab('stock')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            실시간 새로고침
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {activeTab === 'stock' && <StockTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'preorders' && <PreOrdersTab />}
        </motion.div>
      </AnimatePresence>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex">
          <button
            onClick={() => handleTabChange('stock')}
            className={`flex-1 py-4 text-center ${
              activeTab === 'stock' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="text-2xl">📊</div>
            <div className="text-xs mt-1">재고관리</div>
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`flex-1 py-4 text-center ${
              activeTab === 'orders' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="text-2xl">🛒</div>
            <div className="text-xs mt-1">주문하기</div>
          </button>
          <button
            onClick={() => handleTabChange('preorders')}
            className={`flex-1 py-4 text-center ${
              activeTab === 'preorders' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="text-2xl">📋</div>
            <div className="text-xs mt-1">예약확인</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationMobile;
