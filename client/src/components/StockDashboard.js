import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const StockDashboard = () => {
  const { menus } = useSocket();
  const [stockStatus, setStockStatus] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    fetchStockStatus();
  }, [selectedDate]);

  const fetchStockStatus = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/reservations/stock/${selectedDate}`
      );
      setStockStatus(response.data.data);
    } catch (error) {
      console.error('재고 현황 조회 실패:', error);
    }
  };

  const getStockColor = (status) => {
    switch(status) {
      case 'sold_out': return 'bg-red-100 text-red-800 border-red-300';
      case 'low_stock': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'available': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'sold_out': return '품절';
      case 'low_stock': return '재고 부족';
      case 'moderate': return '원활';
      case 'available': return '여유';
      default: return '알 수 없음';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📊 실시간 재고 현황</h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            onClick={fetchStockStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            새로고침
          </button>
        </div>
      </div>

      {stockStatus && (
        <>
          {/* 요약 정보 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">전체 메뉴</div>
              <div className="text-2xl font-bold">{stockStatus.summary.totalMenus}개</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-sm text-red-600">품절</div>
              <div className="text-2xl font-bold text-red-700">
                {stockStatus.summary.soldOutMenus}개
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm text-yellow-600">재고 부족</div>
              <div className="text-2xl font-bold text-yellow-700">
                {stockStatus.summary.lowStockMenus}개
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600">선주문</div>
              <div className="text-2xl font-bold text-blue-700">
                {stockStatus.summary.totalPreOrders}건
              </div>
            </div>
          </div>

          {/* 상세 재고 현황 */}
          <div className="space-y-4">
            {stockStatus.stockStatus.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{item.menuName}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStockColor(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    활용률: {item.utilizationRate}%
                  </div>
                </div>

                {/* 재고 막대 그래프 */}
                <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                  <div
                    className={`h-4 rounded-full ${
                      item.utilizationRate > 80 ? 'bg-red-600' :
                      item.utilizationRate > 50 ? 'bg-yellow-500' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${item.utilizationRate}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">총 재고:</span>
                    <span className="ml-1 font-semibold">{item.totalStock}개</span>
                  </div>
                  <div>
                    <span className="text-orange-600">예약 선주문:</span>
                    <span className="ml-1 font-semibold">{item.reservedForPreOrders}개</span>
                  </div>
                  <div>
                    <span className="text-green-600">주문 가능:</span>
                    <span className="ml-1 font-semibold">{item.availableForOrder}개</span>
                  </div>
                </div>

                {/* 선주문 상세 */}
                {item.preOrderDetails.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      📋 예약 선주문 내역
                    </div>
                    <div className="space-y-1">
                      {item.preOrderDetails.map((po, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-600">
                          <span>
                            {po.reservationNumber} - {po.customerName}
                          </span>
                          <span>
                            {po.quantity}개 ({po.status === 'reserved' ? '예약중' : 
                                      po.status === 'confirmed' ? '확정' : 
                                      po.status === 'served' ? '제공완료' : '취소'})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StockDashboard;
