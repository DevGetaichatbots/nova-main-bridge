import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  
  const userData = localStorage.getItem("user");
  
  if (!userData) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  try {
    const user = JSON.parse(userData);
    
    if (!user.role || user.role.toLowerCase() !== "admin") {
      return <Navigate to="/" replace />;
    }
    
    return children;
  } catch (error) {
    console.error("Error parsing user data:", error);
    localStorage.removeItem("user");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
};

export default AdminRoute;
