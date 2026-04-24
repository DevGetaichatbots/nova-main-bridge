import { Navigate } from 'react-router-dom';

export default function SuperAdminRoute({ children }) {
  const userStr = localStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  
  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'super_admin') {
      return <Navigate to="/" replace />;
    }
    return children;
  } catch {
    return <Navigate to="/login" replace />;
  }
}
