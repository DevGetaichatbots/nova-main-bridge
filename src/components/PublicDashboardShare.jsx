import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { publicShareService } from '../services/publicShareService';
import { exportDashboardPdfViaServer } from '../utils/exportPdf';
import {
  localizeComparisonDashboardHtml,
  localizePredictiveReportHtml,
  normalizePredictiveDashboardHtml,
} from '../utils/reportLocalization';

const Spinner = () => (
  <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1eb5ee] animate-spin" />
);

const SHARED_EXPORT_TRIGGER = 'nova-shared-dashboard-export-pdf';
const SHARED_EXPORT_STATE = 'nova-shared-dashboard-export-state';

const injectExportButtonIntoDashboardHtml = (inputHtml, { buttonLabel, exportingLabel }) => {
  if (!inputHtml) return inputHtml;
  if (inputHtml.includes('nova-shared-export-button')) return inputHtml;

  const exportControlMarkup = `
<style id="nova-shared-export-style">
  .nova-shared-export-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    background: #ffffff;
    padding: 10px 16px;
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    cursor: pointer;
    transition: box-shadow 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
  }

  .nova-shared-export-button:hover {
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  .nova-shared-export-button:disabled {
    opacity: 0.6;
    cursor: wait;
    transform: none;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  }

  .nova-shared-export-slot {
    display: inline-flex;
    align-items: center;
    margin-right: 12px;
  }

  .nova-shared-export-icon {
    width: 16px;
    height: 16px;
    display: inline-block;
  }
</style>
<script id="nova-shared-export-script">
  (() => {
    const BUTTON_LABEL = ${JSON.stringify(buttonLabel)};
    const EXPORTING_LABEL = ${JSON.stringify(exportingLabel)};

    const iconSvg = '<svg class="nova-shared-export-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';

    const ensureButton = () => {
      if (document.getElementById('nova-shared-export-button')) return;

      const badge = document.querySelector([
        'span[style*="border-radius: 20px"]',
        'span[style*="border-radius:20px"]',
        'div[style*="border-radius: 20px"]',
        'div[style*="border-radius:20px"]'
      ].join(','));

      if (!badge || !badge.parentElement) return;

      const slot = document.createElement('div');
      slot.className = 'nova-shared-export-slot';

      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'nova-shared-export-button';
      button.className = 'nova-shared-export-button';
      button.innerHTML = iconSvg + '<span>' + BUTTON_LABEL + '</span>';
      button.addEventListener('click', () => {
        window.parent.postMessage({ type: '${SHARED_EXPORT_TRIGGER}' }, '*');
      });

      slot.appendChild(button);

      const parent = badge.parentElement;
      parent.style.display = 'flex';
      parent.style.alignItems = 'center';
      parent.style.justifyContent = 'flex-end';
      parent.style.gap = '0';
      parent.style.flexWrap = 'wrap';
      parent.insertBefore(slot, badge);
    };

    const setExportingState = (exporting) => {
      const button = document.getElementById('nova-shared-export-button');
      if (!button) return;
      const label = button.querySelector('span');
      button.disabled = Boolean(exporting);
      if (label) label.textContent = exporting ? EXPORTING_LABEL : BUTTON_LABEL;
    };

    window.addEventListener('message', (event) => {
      if (event?.data?.type !== '${SHARED_EXPORT_STATE}') return;
      setExportingState(Boolean(event.data.exporting));
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureButton, { once: true });
    } else {
      ensureButton();
    }

    window.addEventListener('load', ensureButton, { once: true });
    window.setTimeout(ensureButton, 150);
  })();
</script>`;

  if (inputHtml.includes('</head>')) {
    return inputHtml.replace('</head>', `${exportControlMarkup}</head>`);
  }

  return `${exportControlMarkup}${inputHtml}`;
};

const PublicDashboardShare = () => {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const iframeRef = useRef(null);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [exportError, setExportError] = useState('');

  const language = searchParams.get('language') || i18n.language || 'en';
  const isComparison = type === 'comparison';
  const isValidType = type === 'schedule' || type === 'comparison';

  useEffect(() => {
    let cancelled = false;

    const loadSharedDashboard = async () => {
      if (!isValidType || !id) {
        setLoadError('Shared dashboard not found');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError('');
        const data = await publicShareService.getSharedDashboard(type, id, language);
        if (cancelled) return;

        setDashboard(isComparison ? data.comparison : data.analysis);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load shared dashboard');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadSharedDashboard();
    return () => {
      cancelled = true;
    };
  }, [id, isComparison, isValidType, language, type]);

  const html = useMemo(() => {
    if (!dashboard) return '';
    const rawHtml = isComparison ? dashboard.dashboard_html : dashboard.predictive_insights;
    if (isComparison) return localizeComparisonDashboardHtml(rawHtml, language);
    return localizePredictiveReportHtml(rawHtml, language);
  }, [dashboard, isComparison, language]);

  const isDashboardHtml = typeof html === 'string' && (
    html.includes('window.__pdData') ||
    html.includes('<script') ||
    html.includes('<!DOCTYPE html') ||
    html.includes('<html')
  );

  const sanitizedHtml = useMemo(() => {
    if (!html || isDashboardHtml) return '';
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style', 'class'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
    });
  }, [html, isDashboardHtml]);

  const exportHtml = useMemo(() => {
    if (!dashboard || !html) return '';

    if (isDashboardHtml) {
      if (isComparison) return html;
      return normalizePredictiveDashboardHtml(dashboard.predictive_insights, language);
    }

    return `<!DOCTYPE html>
<html lang="${language.substring(0, 2)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${dashboard.title || 'Nova Insight Dashboard'}</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f8fafc;
        color: #0f172a;
        font-family: Arial, sans-serif;
      }
    </style>
  </head>
  <body>
    <main>${sanitizedHtml}</main>
  </body>
</html>`;
  }, [dashboard, html, isComparison, isDashboardHtml, language, sanitizedHtml]);

  const exportFilename = useMemo(() => {
    if (!dashboard) return 'dashboard.pdf';

    if (isComparison) {
      return `${dashboard.title || 'health-dashboard'}.pdf`;
    }

    const baseName = dashboard.filename || dashboard.title || 'predictive-dashboard';
    return `${baseName.replace(/\.[^.]+$/, '')}.pdf`;
  }, [dashboard, isComparison]);

  const embeddedDashboardHtml = useMemo(() => {
    if (!isDashboardHtml) return '';

    return injectExportButtonIntoDashboardHtml(html, {
      buttonLabel: i18n.language?.startsWith('da') ? 'Eksporter PDF' : 'Export PDF',
      exportingLabel: i18n.language?.startsWith('da') ? 'Eksporterer...' : 'Exporting...',
    });
  }, [html, i18n.language, isDashboardHtml]);

  const handleExportPdf = async () => {
    if (!exportHtml || isExportingPdf) return;

    setIsExportingPdf(true);
    setExportError('');
    iframeRef.current?.contentWindow?.postMessage({ type: SHARED_EXPORT_STATE, exporting: true }, '*');
    try {
      await exportDashboardPdfViaServer(exportHtml, exportFilename);
    } catch (err) {
      console.error('Shared PDF export error:', err);
      setExportError(err.message || 'Failed to export PDF');
    } finally {
      iframeRef.current?.contentWindow?.postMessage({ type: SHARED_EXPORT_STATE, exporting: false }, '*');
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event?.data?.type !== SHARED_EXPORT_TRIGGER) return;
      handleExportPdf();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleExportPdf]);

  const exportButton = (
    <div className="flex items-center gap-3">
      {exportError && <span className="max-w-xs text-right text-xs font-medium text-red-600">{exportError}</span>}
      <button
        onClick={handleExportPdf}
        disabled={isExportingPdf}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
      >
        {isExportingPdf ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {i18n.language?.startsWith('da') ? 'Eksporter PDF' : 'Export PDF'}
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm font-medium text-slate-500">Loading shared dashboard...</p>
        </div>
      </div>
    );
  }

  if (loadError || !dashboard || !html) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-bold text-slate-800">Dashboard unavailable</h1>
          <p className="text-sm text-slate-500">{loadError || 'This shared dashboard could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (!isDashboardHtml) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white/95 px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-end">
            {exportButton}
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-6" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      </main>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50">
      <iframe
        ref={iframeRef}
        srcDoc={embeddedDashboardHtml}
        title={isComparison ? 'Shared Project Health Dashboard' : 'Shared Predictive Dashboard'}
        sandbox={isComparison ? 'allow-scripts' : 'allow-scripts allow-same-origin'}
        style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
      />
    </div>
  );
};

export default PublicDashboardShare;
