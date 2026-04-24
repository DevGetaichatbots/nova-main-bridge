
// Backend URL configuration
export const getApiBaseUrl = () => {
  return '';
};

export const API_ENDPOINTS = {
  SIGNUP: '/api/signup',
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  VERIFY_TOKEN: '/api/verify-token',
  HEALTH: '/api/health'
};

// Test the API connection
export const testApiConnection = async () => {
  try {
    const apiUrl = getApiBaseUrl();
    console.log('🧪 Testing API connection to:', `${apiUrl}/api/health`);

    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connection successful:', data);
      return { success: true, data };
    } else {
      console.error('❌ API connection failed:', response.status, response.statusText);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('❌ API connection error:', error);
    return { success: false, error: error.message };
  }
};
