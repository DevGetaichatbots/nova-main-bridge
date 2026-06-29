import { getApiBaseUrl } from '../utils/apiConfig';

const parseJson = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
};

export const publicShareService = {
  async getSharedDashboard(type, id, language = 'en') {
    const normalizedType = type === 'comparison' ? 'comparisons' : 'analyses';
    const params = new URLSearchParams();
    if (language) params.set('language', language.substring(0, 2));

    const response = await fetch(
      `${getApiBaseUrl()}/api/schedule/share/${normalizedType}/${encodeURIComponent(id)}?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return parseJson(response, 'Failed to load shared dashboard');
  },
};
