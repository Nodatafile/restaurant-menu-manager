// client/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API 기본 URL 설정
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // 인증 상태 확인
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // 토큰 유효성 확인
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        // 토큰이 유효하지 않으면 제거
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('인증 확인 실패:', error);
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // 로그인
  const login = async (employeeId, password) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/auth/login`, {
        employeeId,
        password
      });

      if (response.data.success) {
        const { token, user } = response.data;
        
        // 토큰 저장
        localStorage.setItem('token', token);
        
        // 사용자 정보 저장
        setUser(user);
        setIsAuthenticated(true);
        
        return { success: true, user };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || '로그인에 실패했습니다';
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  // 비밀번호 변경
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.put(
        `${API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        return { success: true, message: '비밀번호가 변경되었습니다' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '비밀번호 변경 실패' 
      };
    }
  };

  // 컴포넌트 마운트 시 인증 확인
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // axios 인터셉터 설정
  useEffect(() => {
    // 요청 인터셉터
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 응답 인터셉터
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // 401 에러 시 자동 로그아웃
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    // 클린업
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [logout]);

  // Context 값
  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    changePassword,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
