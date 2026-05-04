// client/src/pages/LiveMenuBoard.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { motion } from 'framer-motion';

const LiveMenuBoard = () => {
  const { roomId } = useParams();
  const { menus, socket } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
 
  const roomNames = {
    main: '메인 한식당',
    room2: '2회의실',
    room3: '3회의실',
    room4: '4회의실',
    room5: '5회의실',
    room6: '6회의실',
    room9: '9회의실'
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (socket) {
      socket.emit('joinRoom', { room: roomId });
    }
  }, [socket, roomId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{roomNames[roomId] || '회의실'}</h1>
            <p className="text-gray-400 mt-1">실시간 메뉴 현황</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono">
              {currentTime.toLocaleTimeString('ko-KR')}
            </div>
            <div className="text-sm text-gray-400">
              {currentTime.toLocaleDateString('ko-KR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴 그리드 */}
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu, index) => (
            <motion.div
              key={menu._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-6 rounded-xl backdrop-blur-sm ${
                menu.currentStock === 0 
                  ? 'bg-red-900/50 border border-red-500' 
                  : menu.currentStock <= 5 
                  ? 'bg-yellow-900/50 border border-yellow-500'
                  : 'bg-gray-800/50 border border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{menu.name}</h3>
                <span className="text-sm text-gray-400">
                  {menu.price?.toLocaleString()}원
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">남은 수량</span>
                  <span className={`text-3xl font-bold ${
                    menu.currentStock === 0 ? 'text-red-400' :
                    menu.currentStock <= 5 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {menu.currentStock}
                    <span className="text-lg ml-1">개</span>
                  </span>
                </div>

                {/* 재고 표시 바 */}
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      menu.currentStock === 0 ? 'bg-red-500' :
                      menu.currentStock <= 5 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ 
                      width: `${(menu.currentStock / menu.initialStock) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* 상태 표시 */}
              <div className="mt-4">
                {menu.currentStock === 0 ? (
                  <span className="inline-block px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold animate-pulse">
                    품절
                  </span>
                ) : menu.currentStock <= 5 ? (
                  <span className="inline-block px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-bold">
                    품절 임박
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1 bg-green-500 text-white rounded-full text-sm">
                    주문 가능
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveMenuBoard;
