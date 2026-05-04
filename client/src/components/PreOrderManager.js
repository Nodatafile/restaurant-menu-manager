import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const PreOrderManager = ({ reservation, onUpdate }) => {
  const { menus } = useSocket();
  const [selectedMenu, setSelectedMenu] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [preOrders, setPreOrders] = useState(reservation?.preOrders || []);
  const [stockWarnings, setStockWarnings] = useState({});

  // 메뉴별 예약 가능 수량 계산
  const getAvailableStock = (menuId) => {
    const menu = menus.find(m => m._id === menuId);
    if (!menu) return 0;
    
    // 전체 재고 - 이미 예약된 수량
    const reservedQty = preOrders
      .filter(po => po.menuItem === menuId)
      .reduce((sum, po) => sum + po.quantity, 0);
    
    return menu.currentStock - reservedQty;
  };

  const handleAddPreOrder = () => {
    if (!selectedMenu || quantity < 1) return;
    
    const available = getAvailableStock(selectedMenu);
    if (quantity > available) {
      alert(`${menus.find(m => m._id === selectedMenu)?.name}의 예약 가능 수량이 부족합니다. (가용: ${available})`);
      return;
    }
    
    const menu = menus.find(m => m._id === selectedMenu);
    const newPreOrder = {
      menuItem: selectedMenu,
      menuName: menu?.name,
      quantity,
      price: menu?.price || 0
    };
    
    setPreOrders([...preOrders, newPreOrder]);
    setSelectedMenu('');
    setQuantity(1);
  };

  const handleRemovePreOrder = (index) => {
    setPreOrders(preOrders.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return preOrders.reduce((sum, po) => sum + (po.price * po.quantity), 0);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-bold mb-4">🍽️ 선주문 관리</h3>
      
      {/* 선주문 추가 폼 */}
      <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메뉴 선택
          </label>
          <select
            value={selectedMenu}
            onChange={(e) => setSelectedMenu(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">메뉴를 선택하세요</option>
            {menus.filter(menu => {
              const available = getAvailableStock(menu._id);
              return available > 0;
            }).map(menu => (
              <option key={menu._id} value={menu._id}>
                {menu.name} (가용: {getAvailableStock(menu._id)}개)
              </option>
            ))}
          </select>
        </div>
        
        <div className="w-24">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            수량
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-end">
          <button
            onClick={handleAddPreOrder}
            disabled={!selectedMenu}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            추가
          </button>
        </div>
      </div>
      
      {/* 재고 경고 */}
      {Object.keys(stockWarnings).length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <span className="text-yellow-800">⚠️</span>
            <span className="ml-2 text-sm text-yellow-700">
              일부 메뉴의 재고가 부족할 수 있습니다
            </span>
          </div>
        </div>
      )}
      
      {/* 선주문 목록 */}
      <div className="space-y-3">
        {preOrders.map((preOrder, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
            <div className="flex-1">
              <span className="font-medium">{preOrder.menuName}</span>
              <span className="ml-2 text-gray-600">
                {preOrder.quantity}개 × {preOrder.price?.toLocaleString()}원
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-600">
                {(preOrder.price * preOrder.quantity).toLocaleString()}원
              </span>
              <button
                onClick={() => handleRemovePreOrder(index)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {preOrders.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          선주문이 없습니다
        </p>
      )}
      
      {/* 총계 */}
      {preOrders.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">선주문 총액</span>
            <span className="font-bold text-xl text-blue-600">
              {calculateTotal().toLocaleString()}원
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreOrderManager;
