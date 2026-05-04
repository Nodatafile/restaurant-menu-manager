import React from 'react';
import { useSocket } from '../context/SocketContext';

const roomNames = {
  main: '메인 한식당',
  room2: '2회의실',
  room3: '3회의실',
  room4: '4회의실',
  room5: '5회의실',
  room6: '6회의실',
  room9: '9회의실'
};

const RoomGrid = () => {
  const { menus } = useSocket();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Object.entries(roomNames).map(([roomId, roomName]) => (
        <div key={roomId} className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">🏢 {roomName}</h3>
          <div className="space-y-3">
            {menus.map(menu => (
              <div key={menu._id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-semibold">{menu.name}</div>
                  <div className="text-sm text-gray-600">
                    {menu.currentStock <= 5 ? (
                      <span className="text-red-600 font-bold">
                        ⚠️ {menu.currentStock}개 남음
                      </span>
                    ) : (
                      <span>{menu.currentStock}개 남음</span>
                    )}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  menu.currentStock === 0 
                    ? 'bg-red-100 text-red-800' 
                    : menu.currentStock <= 10 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {menu.currentStock === 0 ? '품절' : '주문 가능'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoomGrid;
