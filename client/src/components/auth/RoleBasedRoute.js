// client/src/components/auth/RoleBasedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.department)) {
    // 권한이 없으면 홈으로 리다이렉트
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RoleBasedRoute;
