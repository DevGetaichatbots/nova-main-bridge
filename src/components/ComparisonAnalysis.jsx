import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatService } from '../services/chatService';
import { comparisonService } from '../services/comparisonService';
import { localizeComparisonDashboardHtml } from '../utils/reportLocalization';
import { exportDashboardPdfViaServer } from '../utils/exportPdf';
import { buildDashboardShareUrl, copyTextToClipboard } from '../utils/shareLinks';
import FileComparisonModal from './FileComparisonModal';
import AnalysisPageShell from './AnalysisPageShell';
import ScheduleAnalysisSidebar from './ScheduleAnalysisSidebar';

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ComparisonAnalysis = ({ user }) => {
  const { i18n } = useTranslation();
  const [comparisons, setComparisons] = useState([]);
  const [activeComparisonId, setActiveComparisonId] = useState(null);
  const [activeComparison, setActiveComparison] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const iframeRef = useRef(null);

  const loadComparisons = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const data = await comparisonService.listComparisons();
      if (data.success) setComparisons(data.comparisons || []);
    } catch (err) {
      console.error('Failed to load comparisons:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  useEffect(() => {
    if (!activeComparisonId) {
      setActiveComparison(null);
      return;
    }

    const loadComparison = async () => {
      try {
        setIsLoadingComparison(true);
        const data = await comparisonService.getComparison(activeComparisonId);
        if (data.success) {
          setActiveComparison(data.comparison);
          if (data.comparison.session_id) setUploadSessionId(data.comparison.session_id);
        }
      } catch (err) {
        console.error('Failed to load comparison:', err);
        setError(err.message || 'Failed to load comparison');
      } finally {
        setIsLoadingComparison(false);
      }
    };

    loadComparison();
  }, [activeComparisonId]);

  useEffect(() => {
    if (!isProcessing) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  const handleNewComparison = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const comparisonId = comparisonService.generateComparisonId();
      const now = new Date();
      const title = `Comparison ${now.toLocaleDateString(i18n.language === 'da' ? 'da-DK' : 'en-US', {
        day: '2-digit',
        month: 'short',
      })}, ${now.toLocaleTimeString(i18n.language === 'da' ? 'da-DK' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
      const data = await comparisonService.createComparison(comparisonId, title);
      if (data.success) {
        const sessionId = chatService.generateSessionId();
        setUploadSessionId(sessionId);
        setActiveComparisonId(data.comparison.comparison_id);
        setActiveComparison(data.comparison);
        setShowUploadModal(true);
        await loadComparisons();
      }
    } catch (err) {
      setError(err.message || 'Failed to create comparison');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteComparison = async (comparisonId) => {
    try {
      await comparisonService.deleteComparison(comparisonId);
      if (activeComparisonId === comparisonId) {
        setActiveComparisonId(null);
        setActiveComparison(null);
        setUploadSessionId(null);
      }
      await loadComparisons();
    } catch (err) {
      setError(err.message || 'Failed to delete comparison');
    }
  };

  const handleRenameComparison = async (comparisonId, title) => {
    try {
      await comparisonService.renameComparison(comparisonId, title);
      if (activeComparisonId === comparisonId) {
        setActiveComparison(prev => prev ? { ...prev, title } : prev);
      }
      await loadComparisons();
    } catch (err) {
      setError(err.message || 'Failed to rename comparison');
    }
  };

  const openUploadModal = () => {
    if (!activeComparisonId) return;
    const nextSessionId = uploadSessionId || chatService.generateSessionId();
    setUploadSessionId(nextSessionId);
    setShowUploadModal(true);
  };

  const handleFilesUploaded = async ({ oldSessionId, newSessionId, oldFileName, newFileName, useNusf }) => {
    if (!activeComparisonId || !uploadSessionId) return;
    setShowUploadModal(false);
    setIsProcessing(true);
    setError(null);

    try {
      await comparisonService.generateDashboard(activeComparisonId, {
        sessionId: uploadSessionId,
        oldSessionId,
        newSessionId,
        oldFilename: oldFileName,
        newFilename: newFileName,
        useNusf: useNusf,
        language: i18n.language?.substring(0, 2) || 'en',
      });

      const data = await comparisonService.getComparison(activeComparisonId);
      if (data.success) {
        setActiveComparison(data.comparison);
        await loadComparisons();
      }
    } catch (err) {
      setError(err.message || 'Comparison failed');
      setActiveComparison(prev => prev ? { ...prev, status: 'error' } : prev);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIframeLoad = (event) => {
    try {
      const doc = event.target.contentDocument;
      if (doc?.body) {
        event.target.style.height = `${doc.body.scrollHeight + 32}px`;
      }
    } catch {
      event.target.style.height = '100vh';
    }
  };

  const handleShareComparison = async (comparisonId = activeComparisonId) => {
    if (!comparisonId) return;
    try {
      const shareUrl = buildDashboardShareUrl('comparison', comparisonId, i18n.language);
      await copyTextToClipboard(shareUrl);
      setShareFeedback(i18n.language?.startsWith('da') ? 'Link kopieret' : 'Link copied');
      setTimeout(() => setShareFeedback(''), 2400);
    } catch (err) {
      console.error('Share link copy failed:', err);
      setError(i18n.language?.startsWith('da') ? 'Kunne ikke kopiere linket.' : 'Could not copy the share link.');
    }
  };

  const renderDashboard = () => (
    <iframe
      ref={iframeRef}
      srcDoc={localizeComparisonDashboardHtml(activeComparison.dashboard_html, i18n.language)}
      sandbox="allow-scripts"
      style={{ width: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
      onLoad={handleIframeLoad}
      title={i18n.language?.startsWith('da') ? 'Projektsundhed Dashboard' : 'Project Health Dashboard'}
    />
  );

  const renderProcessing = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[#1eb5ee]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-[#1eb5ee] border-t-transparent animate-spin" />
          <div className="absolute inset-3 rounded-2xl bg-gradient-to-br from-[#1eb5ee] to-[#00B4B4] flex items-center justify-center text-white">
            <Spinner />
          </div>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          {i18n.language?.startsWith('da') ? 'Genererer projektsundhedsdashboard' : 'Generating project health dashboard'}
        </h3>
        <p className="text-sm text-slate-500 mb-5">
          {i18n.language?.startsWith('da')
            ? 'Nova sammenligner de uploadede tidsplaner og forbereder v5-grafvisningen.'
            : 'Nova is comparing the uploaded schedules and preparing the v5 graph view.'}
        </p>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1eb5ee] to-[#00B4B4] transition-all"
            style={{ width: `${Math.min(85, Math.max(8, elapsedSeconds * 1.2))}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
        </p>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#1eb5ee]/10 to-[#00B4B4]/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-[#00B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">
          {i18n.language?.startsWith('da') ? 'Projektsundhed Dashboard' : 'Project Health Dashboard'}
        </h2>
        <p className="text-slate-500 mb-6">
          {i18n.language?.startsWith('da')
            ? 'Upload to tidsplaner for automatisk at generere v5-grafdashboardet.'
            : 'Upload two schedules to generate the v5 graph dashboard automatically.'}
        </p>
        <button
          onClick={handleNewComparison}
          disabled={isCreating}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1eb5ee] to-[#00B4B4] text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {isCreating ? <Spinner /> : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          {i18n.language?.startsWith('da') ? 'Ny Sammenligning' : 'New Comparison'}
        </button>
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <button
        onClick={openUploadModal}
        className="w-full max-w-lg border-2 border-dashed border-slate-300 hover:border-[#1eb5ee] hover:bg-[#1eb5ee]/5 rounded-2xl p-12 text-center transition-all"
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#1eb5ee] to-[#00B4B4] flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {i18n.language?.startsWith('da') ? 'Upload gammel og ny tidsplan' : 'Upload old and new schedules'}
        </h3>
        <p className="text-slate-500">
          {i18n.language?.startsWith('da')
            ? 'Dashboardet bliver genereret, når begge filer er færdigbehandlet.'
            : 'The dashboard will be generated after both files finish processing.'}
        </p>
      </button>
    </div>
  );

  const renderReport = () => {
    if (!activeComparison?.dashboard_html) return renderUpload();

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className={`flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 py-3 flex items-center justify-between ${
            sidebarOpen ? 'px-6' : 'pl-20 pr-6'
          }`}
        >
          <div>
            <h3 className="text-sm font-bold text-slate-800">{activeComparison.title}</h3>
            <p className="text-xs text-slate-500">
              {[activeComparison.old_filename, activeComparison.new_filename].filter(Boolean).join(' vs ')}
              {activeComparison.processing_time && ` - ${Number(activeComparison.processing_time).toFixed(1)}s`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {shareFeedback && <span className="text-xs font-semibold text-[#00B4B4]">{shareFeedback}</span>}
            <button
              onClick={() => handleShareComparison(activeComparisonId)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:shadow-md transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.59 13.51a3 3 0 010-4.24l2.12-2.12a3 3 0 014.24 4.24l-.35.35m-1.18-1.18a3 3 0 010 4.24l-2.12 2.12a3 3 0 01-4.24-4.24l.35-.35" />
              </svg>
              {i18n.language?.startsWith('da') ? 'Del link' : 'Share link'}
            </button>
            <button
              onClick={async () => {
                if (isExportingPdf) return;
                setIsExportingPdf(true);
                setError(null);
                try {
                  const html = localizeComparisonDashboardHtml(activeComparison.dashboard_html, i18n.language);
                  await exportDashboardPdfViaServer(
                    html,
                    (activeComparison.title || 'health-dashboard') + '.pdf',
                  );
                } catch (e) {
                  console.error('PDF export error:', e);
                  setError(i18n.language?.startsWith('da')
                    ? 'Kunne ikke eksportere PDF. Prøv venligst igen.'
                    : 'Failed to export PDF. Please try again.');
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:shadow-md transition-all disabled:opacity-50"
            >
              {isExportingPdf ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {i18n.language?.startsWith('da') ? 'Eksporter PDF' : 'Export PDF'}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {renderDashboard()}
          </div>
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    if (!activeComparisonId) return renderWelcome();
    if (isLoadingComparison) {
      return (
        <div className="flex-1 flex items-center justify-center text-[#1eb5ee]">
          <Spinner />
        </div>
      );
    }
    if (isProcessing) return renderProcessing();
    if (activeComparison?.status === 'completed') return renderReport();
    return renderUpload();
  };

  const sidebarItems = comparisons.map(comparison => ({
    ...comparison,
    analysis_id: comparison.comparison_id,
    filename: [comparison.old_filename, comparison.new_filename].filter(Boolean).join(' vs '),
  }));

  return (
    <AnalysisPageShell
      sidebar={(
        <ScheduleAnalysisSidebar
          analyses={sidebarItems}
          activeAnalysisId={activeComparisonId}
          onSelectAnalysis={setActiveComparisonId}
          onNewAnalysis={handleNewComparison}
          onDeleteAnalysis={handleDeleteComparison}
          onRenameAnalysis={handleRenameComparison}
          onShareAnalysis={handleShareComparison}
          isLoadingList={isLoadingList}
          isCreating={isCreating}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      )}
      sidebarOpen={sidebarOpen}
      onOpenSidebar={() => setSidebarOpen(true)}
      errorBanner={error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">x</button>
        </div>
      )}
    >
      {renderMainContent()}
      
      <FileComparisonModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onFilesUploaded={handleFilesUploaded}
        sessionId={uploadSessionId}
      />
    </AnalysisPageShell>
  );
};

export default ComparisonAnalysis;
