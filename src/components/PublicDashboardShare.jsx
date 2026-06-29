import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { publicShareService } from '../services/publicShareService';
import {
  localizeComparisonDashboardHtml,
  localizePredictiveReportHtml,
} from '../utils/reportLocalization';

const Spinner = () => (
  <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1eb5ee] animate-spin" />
);

const PublicDashboardShare = () => {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const language = searchParams.get('language') || i18n.language || 'en';
  const isComparison = type === 'comparison';
  const isValidType = type === 'schedule' || type === 'comparison';

  useEffect(() => {
    let cancelled = false;

    const loadSharedDashboard = async () => {
      if (!isValidType || !id) {
        setError('Shared dashboard not found');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');
        const data = await publicShareService.getSharedDashboard(type, id, language);
        if (cancelled) return;

        setDashboard(isComparison ? data.comparison : data.analysis);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load shared dashboard');
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

  if (error || !dashboard || !html) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-bold text-slate-800">Dashboard unavailable</h1>
          <p className="text-sm text-slate-500">{error || 'This shared dashboard could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (!isDashboardHtml) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div
          className="mx-auto max-w-7xl p-6"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </main>
    );
  }

  return (
    <iframe
      srcDoc={html}
      title={isComparison ? 'Shared Project Health Dashboard' : 'Shared Predictive Dashboard'}
      sandbox={isComparison ? 'allow-scripts' : 'allow-scripts allow-same-origin'}
      style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
    />
  );
};

export default PublicDashboardShare;
