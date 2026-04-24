import { getApiBaseUrl } from '../utils/apiConfig';
import { fetchWithAuth, uploadFilesWithAuth } from '../utils/authApi';

const API_BASE = getApiBaseUrl();

export const scheduleService = {
  async listAnalyses() {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses`);
    if (!response.ok) throw new Error('Failed to fetch analyses');
    return response.json();
  },

  async createAnalysis(analysisId, title) {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses`, {
      method: 'POST',
      body: JSON.stringify({ analysis_id: analysisId, title }),
    });
    if (!response.ok) throw new Error('Failed to create analysis');
    return response.json();
  },

  async getAnalysis(analysisId) {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses/${analysisId}`);
    if (!response.ok) throw new Error('Failed to fetch analysis');
    return response.json();
  },

  async deleteAnalysis(analysisId) {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses/${analysisId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete analysis');
    return response.json();
  },

  async renameAnalysis(analysisId, title) {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses/${analysisId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error('Failed to rename analysis');
    return response.json();
  },

  async uploadAndAnalyze(analysisId, file, language = 'en') {
    const formData = new FormData();
    formData.append('schedule', file);
    formData.append('language', language);
    formData.append('format', 'html');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    try {
      const response = await uploadFilesWithAuth(
        `${API_BASE}/api/schedule/analyses/${analysisId}/upload`,
        formData,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Analysis timed out. Please try again.');
      }
      throw err;
    }
  },

  async getProgress(analysisId) {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses/${analysisId}/progress`);
      if (!response.ok) return { stage: 'unknown', message: '', step: 0, total_steps: 6 };
      return response.json();
    } catch {
      return { stage: 'unknown', message: '', step: 0, total_steps: 6 };
    }
  },

  async downloadPdf(analysisId, language = 'en') {
    const response = await fetchWithAuth(`${API_BASE}/api/schedule/analyses/${analysisId}/pdf?language=${language}`);
    if (!response.ok) throw new Error('Failed to download PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'Nova_Insight_Schedule_Analysis.pdf';
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) filename = match[1].replace(/['"]/g, '');
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },

  generateAnalysisId() {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return `sa_${hex}`;
  },
};
