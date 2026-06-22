import { getApiBaseUrl } from '../utils/apiConfig';
import { deleteWithAuth, fetchWithAuth, patchWithAuth, postWithAuth } from '../utils/authApi';

const API_BASE = `${getApiBaseUrl()}/api/schedule/comparisons`;

const parseJson = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
};

export const comparisonService = {
  generateComparisonId() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `cmp_${hex}`;
  },

  async listComparisons() {
    const response = await fetchWithAuth(API_BASE);
    return parseJson(response, 'Failed to fetch comparisons');
  },

  async createComparison(comparisonId, title) {
    const response = await postWithAuth('/api/schedule/comparisons', {
      comparison_id: comparisonId,
      title,
    });
    return parseJson(response, 'Failed to create comparison');
  },

  async getComparison(comparisonId) {
    const response = await fetchWithAuth(`${API_BASE}/${comparisonId}`);
    return parseJson(response, 'Failed to fetch comparison');
  },

  async renameComparison(comparisonId, title) {
    const response = await patchWithAuth(`/api/schedule/comparisons/${comparisonId}`, { title });
    return parseJson(response, 'Failed to rename comparison');
  },

  async deleteComparison(comparisonId) {
    const response = await deleteWithAuth(`/api/schedule/comparisons/${comparisonId}`);
    return parseJson(response, 'Failed to delete comparison');
  },

  async generateDashboard(comparisonId, {
    sessionId,
    oldSessionId,
    newSessionId,
    oldFilename,
    newFilename,
    language = 'en',
    useNusf = false,
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 330000);

    try {
      const response = await postWithAuth(
        `/api/schedule/comparisons/${comparisonId}/generate`,
        {
          session_id: sessionId,
          old_session_id: oldSessionId,
          new_session_id: newSessionId,
          old_filename: oldFilename,
          new_filename: newFilename,
          language,
          use_nusf: useNusf,
        },
        { signal: controller.signal }
      );
      return parseJson(response, 'Failed to generate dashboard');
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Comparison timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
