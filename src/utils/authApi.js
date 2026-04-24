import { getApiBaseUrl } from './apiConfig';

export const fetchWithAuth = async (url, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    localStorage.removeItem("user");
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

  const headers = {
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
    localStorage.setItem("auth_redirect_message", "session_expired");
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return response;
};
