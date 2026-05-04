// client/src/pages/AdminPanel.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

const AdminPanel = () => {
  const { user } = useAuth();
  useSocket();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [stats, setStats] = useState(null);
  const [setLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  
  // 새 사용자 폼
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    password: '',
    department: 'operation',
    role: 'staff'
  });

  // 새 메뉴 폼
  const [newMenu, setNewMenu] = useState({
    name: '',
    category: 'main',
    initialStock: 30,
    price: 0
  });

  useEffect(() => {
    fetchDashboardData();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'menus') fetchMenus();
    if (activeTab === 'reports') fetchReports();
    // eslint-disable-next-line
  }, [activeTab, selectedDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/operations/mobile-dashboard');
      setStats(response.data.data);
    } catch (error) {
      toast.error('대시보드 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data.data);
    } catch (error) {
      toast.error('사용자 목록 로드 실패');
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await axios.get('/api/menus');
      setAllMenus(response.data.data);
    } catch (error) {
      toast.error('메뉴 목록 로드 실패');
    }
  };

  const fetchReports = async () => {
    try {
      const response = await axios.get(`/api/reservations/stock/${selectedDate}`);
      setStats(response.data.data);
    } catch (error) {
      toast.error('리포트 로드 실패');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/users', newUser);
      toast.success('사용자가 생성되었습니다');
      setShowUserModal(false);
      fetchUsers();
      setNewUser({ employeeId: '', name: '', password: '', department: 'operation', role: 'staff' });
    } catch (error) {
      toast.error(error.response?.data?.error || '사용자 생성 실패');
    }
  };

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/menus', {
        ...newMenu,
        currentStock: newMenu.initialStock
      });
      toast.success('메뉴가 등록되었습니다');
      fetchMenus();
      setNewMenu({ name: '', category: 'main', initialStock: 30, price: 0 });
    } catch (error) {
      toast.error(error.response?.data?.error || '메뉴 등록 실패');
    }
  };

  const handleResetDaily = async () => {
    if (!window.confirm('정말로 모든 메뉴의 재고를 초기화하시겠습니까?')) return;
    
    try {
      await axios.post('/api/menus/reset-daily');
      toast.success('일일 재고가 초기화되었습니다');
      fetchDashboardData();
    } catch (error) {
      toast.error('재고 초기화 실패');
    }
  };

  const handleToggleUserStatus = async (userId, isActive) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, { isActive: !isActive });
      toast.success(`사용자가 ${!isActive ? '활성화' : '비활성화'}되었습니다`);
      fetchUsers();
    } catch (error) {
      toast.error('상태 변경 실패');
    }
  };

  // 대시보드 탭
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="총 메뉴"
          value={stats?.menus?.length || 0}
          icon="🍽️"
          color="blue"
        />
        <SummaryCard
          title="오늘 예약"
          value={stats?.reservations?.length || 0}
          icon="📅"
          color="green"
        />
        <SummaryCard
          title="품절 메뉴"
          value={stats?.menus?.filter(m => m.currentStock === 0).length || 0}
          icon="🚫"
          color="red"
        />
        <SummaryCard
          title="재고 부족"
          value={stats?.menus?.filter(m => m.currentStock <= 5 && m.currentStock > 0).length || 0}
          icon="⚠️"
          color="yellow"
        />
      </div>

      {/* 빠른 작업 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold mb-4">⚡ 빠른 작업</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetDaily}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            🔄 일일 재고 초기화
          </button>
          <button
            onClick={() => setActiveTab('menus')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            📝 메뉴 관리
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            👥 사용자 관리
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            📊 리포트
          </button>
        </div>
      </div>

      {/* 실시간 모니터링 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold mb-4">📡 실시간 모니터링</h3>
        <div className="space-y-3">
          {stats?.menus?.map((menu, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  menu.currentStock === 0 ? 'bg-red-500' :
                  menu.currentStock <= 5 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}></div>
                <span className="font-medium">{menu.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  초기: {menu.initialStock}
                </span>
                <span className={`font-bold ${
                  menu.currentStock === 0 ? 'text-red-600' :
                  menu.currentStock <= 5 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  현재: {menu.currentStock}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 사용자 관리 탭
  const UsersTab = () => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold">👥 사용자 관리</h3>
        <button
          onClick={() => setShowUserModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 새 사용자
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">사번</th>
              <th className="text-left py-3 px-4">이름</th>
              <th className="text-left py-3 px-4">부서</th>
              <th className="text-left py-3 px-4">역할</th>
              <th className="text-left py-3 px-4">상태</th>
              <th className="text-left py-3 px-4">마지막 로그인</th>
              <th className="text-left py-3 px-4">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-mono">{user.employeeId}</td>
                <td className="py-3 px-4 font-medium">{user.name}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-sm ${
                    user.department === 'admin' ? 'bg-purple-100 text-purple-700' :
                    user.department === 'reservation' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {user.department === 'admin' ? '관리자' :
                     user.department === 'reservation' ? '예약실' : '운영과'}
                  </span>
                </td>
                <td className="py-3 px-4">{user.role}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                    className={`px-2 py-1 rounded text-sm ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {user.isActive ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-'}
                </td>
                <td className="py-3 px-4">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    수정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 메뉴 관리 탭
  const MenusTab = () => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold">🍽️ 메뉴 관리</h3>
      </div>

      {/* 새 메뉴 추가 폼 */}
      <form onSubmit={handleCreateMenu} className="mb-8 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="메뉴명"
            value={newMenu.name}
            onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <select
            value={newMenu.category}
            onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="main">메인</option>
            <option value="side">사이드</option>
            <option value="drink">음료</option>
            <option value="dessert">디저트</option>
          </select>
          <input
            type="number"
            placeholder="초기 재고"
            value={newMenu.initialStock}
            onChange={(e) => setNewMenu({ ...newMenu, initialStock: parseInt(e.target.value) })}
            className="px-3 py-2 border rounded-lg"
            min="0"
            required
          />
          <input
            type="number"
            placeholder="가격"
            value={newMenu.price}
            onChange={(e) => setNewMenu({ ...newMenu, price: parseInt(e.target.value) })}
            className="px-3 py-2 border rounded-lg"
            min="0"
          />
        </div>
        <button
          type="submit"
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          메뉴 등록
        </button>
      </form>

      {/* 메뉴 목록 */}
      <div className="space-y-3">
        {allMenus.map((menu) => (
          <div key={menu._id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                {menu.category}
              </span>
              <span className="font-medium">{menu.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                재고: {menu.currentStock}/{menu.initialStock}
              </span>
              <span className="text-sm font-semibold">
                {menu.price?.toLocaleString()}원
              </span>
              <button
                onClick={() => {/* 수정 로직 */}}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                수정
              </button>
              <button
                onClick={() => {/* 삭제 로직 */}}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 리포트 탭
  const ReportsTab = () => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold">📊 일일 리포트</h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        />
      </div>

      {stats?.stockStatus && (
        <div className="space-y-6">
          {/* 재고 현황 */}
          <div>
            <h4 className="font-semibold mb-3">📦 재고 현황</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">전체</div>
                <div className="text-xl font-bold">{stats.summary.totalMenus}개</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600">선주문</div>
                <div className="text-xl font-bold">{stats.summary.totalPreOrders}건</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600">품절</div>
                <div className="text-xl font-bold">{stats.summary.soldOutMenus}개</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm text-yellow-600">부족</div>
                <div className="text-xl font-bold">{stats.summary.lowStockMenus}개</div>
              </div>
            </div>
          </div>

          {/* 상세 현황 */}
          <div>
            <h4 className="font-semibold mb-3">📋 상세 현황</h4>
            <div className="space-y-2">
              {stats.stockStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{item.menuName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">이용률: {item.utilizationRate}%</span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.utilizationRate > 80 ? 'bg-red-500' :
                          item.utilizationRate > 50 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${item.utilizationRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                ⚙️ 관리자 패널
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name}님 환영합니다
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/reservation'}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                예약실
              </button>
              <button
                onClick={() => window.location.href = '/operation'}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                운영과
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 대시보드', icon: '📊' },
            { id: 'users', label: '👥 사용자', icon: '👥' },
            { id: 'menus', label: '🍽️ 메뉴', icon: '🍽️' },
            { id: 'reports', label: '📈 리포트', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 컨텐츠 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'menus' && <MenusTab />}
            {activeTab === 'reports' && <ReportsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 새 사용자 모달 */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">새 사용자 등록</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">사번</label>
                <input
                  type="text"
                  value={newUser.employeeId}
                  onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">이름</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">비밀번호</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">부서</label>
                <select
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="operation">운영과</option>
                  <option value="reservation">예약실</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">역할</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="staff">직원</option>
                  <option value="supervisor">슈퍼바이저</option>
                  <option value="manager">매니저</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  등록
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// 요약 카드 컴포넌트
const SummaryCard = ({ title, value, icon, color }) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200'
  };

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700'
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-sm ${textColors[color]}`}>{title}</div>
      <div className={`text-2xl font-bold ${textColors[color]}`}>{value}</div>
    </div>
  );
};

export default AdminPanel;
