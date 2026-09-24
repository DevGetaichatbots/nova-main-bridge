import { getApiBaseUrl } from './apiConfig.js';

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('accessToken');
  const headers = {
    "Content-Type": "application/json",
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.setItem("auth_redirect_message", "session_expired");
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return response;
};

export const getWithAuth = (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  return fetchWithAuth(url, { method: 'GET', ...options });
};

export const postWithAuth = (endpoint, body, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  return fetchWithAuth(url, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
};

export const putWithAuth = (endpoint, body, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  return fetchWithAuth(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options,
  });
};

export const patchWithAuth = (endpoint, body, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  return fetchWithAuth(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options,
  });
};

export const deleteWithAuth = (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  return fetchWithAuth(url, { method: 'DELETE', ...options });
};

export const uploadFilesWithAuth = async (endpoint, formData, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  const token = localStorage.getItem('accessToken');

  const headers = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
    ...options,
  });

  if (response.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.setItem("auth_redirect_message", "session_expired");
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return response;
};

// localStorage is per-origin: after a redirect to {tenant}.novainsight.net the API cookie is
// still valid but the new origin has no stored user. Restore it from /api/me.
export const rehydrateSession = async (base = getApiBaseUrl()) => {
  try {
    const response = await fetch(`${base}/api/me`, { credentials: "include" });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.success || !data.user) return false;
    localStorage.setItem("user", JSON.stringify(data.user));
    window.dispatchEvent(new Event("authChange"));
    return true;
  } catch {
    return false;
  }
};
