import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const localizer = momentLocalizer(moment);

const ReservationDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [filterRoom, setFilterRoom] = useState('all');

  const rooms = [
    { id: 'main', name: '메인 한식당', capacity: 100, color: '#3B82F6' },
    { id: 'room2', name: '2회의실', capacity: 20, color: '#10B981' },
    { id: 'room3', name: '3회의실', capacity: 15, color: '#F59E0B' },
    { id: 'room4', name: '4회의실', capacity: 15, color: '#EF4444' },
    { id: 'room5', name: '5회의실', capacity: 20, color: '#8B5CF6' },
    { id: 'room6', name: '6회의실', capacity: 25, color: '#EC4899' },
    { id: 'room9', name: '9회의실', capacity: 30, color: '#06B6D4' }
  ];

  useEffect(() => {
    fetchReservations();
    fetchDailySummary();
  }, [selectedDate]);

  const fetchReservations = async () => {
    try {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const response = await axios.get(`/api/reservations/daily/${dateStr}`);
      const data = response.data.data;
      
      // 캘린더 이벤트로 변환
      const calendarEvents = data.reservations.map(res => ({
        id: res.id,
        title: `${res.customerName} (${res.guests}명)`,
        start: new Date(`${dateStr}T${res.time}`),
        end: new Date(new Date(`${dateStr}T${res.time}`).getTime() + 2*60*60*1000),
        resource: res,
        color: rooms.find(r => r.id === res.room)?.color
      }));
      
      setEvents(calendarEvents);
      setReservations(data.reservations);
    } catch (error) {
      console.error('예약 조회 실패:', error);
    }
  };

  const fetchDailySummary = async () => {
    try {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const response = await axios.get(`/api/reservations/stock/${dateStr}`);
      setDailySummary(response.data.data);
    } catch (error) {
      console.error('일일 요약 조회 실패:', error);
    }
  };

  // 예약 생성 모달
  const NewReservationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📋 새 예약 등록</h2>
            <button
              onClick={() => setShowNewReservation(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <NewReservationForm 
            onSubmit={handleCreateReservation}
            onCancel={() => setShowNewReservation(false)}
          />
        </div>
      </div>
    </div>
  );

  const handleCreateReservation = async (formData) => {
    try {
      await axios.post('/api/reservations', {
        ...formData,
        createdBy: user.name
      });
      setShowNewReservation(false);
      fetchReservations();
      fetchDailySummary();
    } catch (error) {
      alert(error.response?.data?.error || '예약 생성 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📋 예약 관리 시스템
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.department === 'reservation' ? '예약실' : '관리자'} • {user?.name}
              </p>
            </div>
            <button
              onClick={() => setShowNewReservation(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-lg"
            >
              + 새 예약 등록
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 캘린더 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                onSelectEvent={(event) => {
                  // 예약 상세 보기
                }}
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.color,
                    borderRadius: '4px'
                  }
                })}
                views={['day']}
                defaultView="day"
                date={selectedDate}
                onNavigate={setSelectedDate}
              />
            </div>
          </div>

          {/* 오른쪽: 요약 및 통계 */}
          <div className="space-y-6">
            {/* 날짜 선택 및 필터 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <input
                type="date"
                value={selectedDate.toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full rounded-lg border-gray-300 mb-4"
              />
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="w-full rounded-lg border-gray-300"
              >
                <option value="all">전체 회의실</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>

            {/* 일일 요약 */}
            {dailySummary && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="text-lg font-bold mb-4">📊 당일 요약</h3>
                <div className="space-y-3">
                  <SummaryItem 
                    label="총 예약" 
                    value={`${reservations.length}건`} 
                    color="blue" 
                  />
                  <SummaryItem 
                    label="선주문 메뉴" 
                    value={`${dailySummary.summary.totalPreOrders}건`} 
                    color="orange" 
                  />
                  <SummaryItem 
                    label="품절 메뉴" 
                    value={`${dailySummary.summary.soldOutMenus}개`} 
                    color="red" 
                  />
                  <SummaryItem 
                    label="재고 부족" 
                    value={`${dailySummary.summary.lowStockMenus}개`} 
                    color="yellow" 
                  />
                </div>
              </div>
            )}

            {/* 회의실별 현황 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-lg font-bold mb-4">🏢 회의실 현황</h3>
              <div className="space-y-2">
                {rooms.map(room => {
                  const roomReservations = reservations.filter(r => r.room === room.id);
                  return (
                    <div key={room.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color }}></div>
                        <span className="font-medium">{room.name}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{roomReservations.length}건</span>
                        <span className="text-gray-500 ml-1">/ {room.capacity}명</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 예약 목록 */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">📝 예약 명단</h2>
          <ReservationTable 
            reservations={reservations}
            filterRoom={filterRoom}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {showNewReservation && <NewReservationModal />}
    </div>
  );
};

// 요약 아이템 컴포넌트
const SummaryItem = ({ label, value, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700'
  };

  return (
    <div className={`p-3 rounded-lg ${colors[color]}`}>
      <div className="text-sm">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

// 예약 테이블 컴포넌트
const ReservationTable = ({ reservations, filterRoom, onStatusChange }) => {
  const filtered = filterRoom === 'all' 
    ? reservations 
    : reservations.filter(r => r.room === filterRoom);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4">예약번호</th>
            <th className="text-left py-3 px-4">시간</th>
            <th className="text-left py-3 px-4">회의실</th>
            <th className="text-left py-3 px-4">예약자</th>
            <th className="text-left py-3 px-4">인원</th>
            <th className="text-left py-3 px-4">선주문</th>
            <th className="text-left py-3 px-4">금액</th>
            <th className="text-left py-3 px-4">상태</th>
            <th className="text-left py-3 px-4">관리</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((res, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4 font-mono text-sm">{res.reservationNumber}</td>
              <td className="py-3 px-4">{res.time}</td>
              <td className="py-3 px-4">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                  {res.room}
                </span>
              </td>
              <td className="py-3 px-4 font-medium">{res.customerName}</td>
              <td className="py-3 px-4">{res.guests}명</td>
              <td className="py-3 px-4">
                {res.preOrdersCount > 0 ? (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                    {res.preOrdersCount}건
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="py-3 px-4">
                {res.totalAmount?.toLocaleString()}원
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded text-sm ${
                  res.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  res.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {res.status === 'confirmed' ? '확정' :
                   res.status === 'pending' ? '대기' :
                   res.status === 'cancelled' ? '취소' : '완료'}
                </span>
              </td>
              <td className="py-3 px-4">
                <button className="text-blue-600 hover:text-blue-800 mr-2">
                  상세
                </button>
                <button className="text-red-600 hover:text-red-800">
                  취소
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReservationDashboard;
