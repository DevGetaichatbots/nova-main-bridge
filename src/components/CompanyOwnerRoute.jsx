import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CompanyOwnerRoute = ({ children }) => {
  const { t } = useTranslation();
  
  const userStr = localStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  
  try {
    const user = JSON.parse(userStr);
    
    if (user.role !== 'company_owner' && user.role !== 'super_admin') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.312 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{t('companyPortal.noAccess')}</h2>
            <p className="text-gray-600 mb-4">{t('companyPortal.ownersOnly')}</p>
            <a 
              href="/"
              className="inline-block px-6 py-2 rounded-xl text-white font-semibold"
              style={{ background: '#00D6D6' }}
            >
              {t('notFound.backHome')}
            </a>
          </div>
        </div>
      );
    }
    
    return children;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return <Navigate to="/login" replace />;
  }
};

export default CompanyOwnerRoute;
