import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { scheduleService } from '../services/scheduleService';
import ScheduleAnalysisSidebar from './ScheduleAnalysisSidebar';

const SCHEDULE_NAV_SECTIONS = [
  { id: 'predictive-schedule-outlook',      labelEn: 'Schedule Outlook',       labelDa: 'Tidsplan Udsigt' },
  { id: 'predictive-biggest-risk',          labelEn: 'Biggest Risk',           labelDa: 'Største Risiko' },
  { id: 'predictive-actions',               labelEn: 'Actions',                labelDa: 'Handlinger' },
  { id: 'predictive-confidence',            labelEn: 'Confidence',             labelDa: 'Tillidsniveau' },
  { id: 'predictive-overview',              labelEn: 'Overview',               labelDa: 'Overblik' },
  { id: 'predictive-project-status',        labelEn: 'Project Status',         labelDa: 'Projektstatus' },
  { id: 'predictive-schedule-overview',     labelEn: 'Schedule Overview',      labelDa: 'Tidsplanoversigt' },
  { id: 'predictive-management-conclusion', labelEn: 'Management Conclusion',  labelDa: 'Ledelsesbeslutning' },
  { id: 'predictive-delayed-activities',    labelEn: 'Delayed Activities',     labelDa: 'Forsinkede aktiviteter' },
  { id: 'predictive-root-cause',            labelEn: 'Root Cause Analysis',    labelDa: 'Årsagsanalyse' },
  { id: 'predictive-summary-by-area',       labelEn: 'Summary by Area',        labelDa: 'Resumé pr. område' },
  { id: 'predictive-priority-actions',      labelEn: 'Priority Actions',       labelDa: 'Prioriterede handlinger' },
  { id: 'predictive-resource-assessment',   labelEn: 'Resource Assessment',    labelDa: 'Ressourcevurdering' },
  { id: 'predictive-forcing-assessment',    labelEn: 'Forcing Assessment',     labelDa: 'Forceringsmuligheder' },
];

const ScheduleAnalysis = ({ user }) => {
  const { t, i18n } = useTranslation();
  const [analyses, setAnalyses] = useState([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState({ stage: '', message: '', step: 0, total_steps: 6 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [navSections, setNavSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const fileInputRef = useRef(null);
  const progressPollRef = useRef(null);
  const reportContainerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const observerRef = useRef(null);
  const analysisCacheRef = useRef({});

  const loadAnalyses = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const data = await scheduleService.listAnalyses();
      if (data.success) {
        setAnalyses(data.analyses || []);
      }
    } catch (err) {
      console.error('Failed to load analyses:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  useEffect(() => {
    if (!activeAnalysisId) {
      setActiveAnalysis(null);
      setIsLoadingAnalysis(false);
      return;
    }
    const cached = analysisCacheRef.current[activeAnalysisId];
    if (cached && cached.status === 'completed') {
      setActiveAnalysis(cached);
      setIsLoadingAnalysis(false);
      return;
    }
    setIsLoadingAnalysis(true);
    setActiveAnalysis(null);
    const loadAnalysis = async () => {
      try {
        const data = await scheduleService.getAnalysis(activeAnalysisId);
        if (data.success) {
          setActiveAnalysis(data.analysis);
          if (data.analysis.status === 'completed') {
            analysisCacheRef.current[activeAnalysisId] = data.analysis;
          }
        }
      } catch (err) {
        console.error('Failed to load analysis:', err);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };
    loadAnalysis();
  }, [activeAnalysisId]);

  useEffect(() => {
    if (!isProcessing || !activeAnalysisId) {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      return;
    }

    const pollProgress = async () => {
      try {
        const data = await scheduleService.getProgress(activeAnalysisId);
        if (data && data.stage && data.stage !== 'unknown' && data.step > 0) {
          setProgressData(data);
        }
      } catch (e) {}
    };

    pollProgress();
    progressPollRef.current = setInterval(pollProgress, 2500);

    return () => {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };
  }, [isProcessing, activeAnalysisId]);

  useEffect(() => {
    if (!isProcessing) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  const stampSectionIds = useCallback((container) => {
    const HEADING_MAP = {
      'predictive executive snapshot': 'predictive-schedule-outlook',
      'forudsigende ledelsesresumé':   'predictive-schedule-outlook',
      'schedule outlook':              'predictive-schedule-outlook',
      'schedule overlook':             'predictive-schedule-outlook',
      'predictive biggest risk':       'predictive-biggest-risk',
      'største prædiktive risiko':     'predictive-biggest-risk',
      'predictive actions':            'predictive-actions',
      'executive actions':             'predictive-actions',
      'ledelsens handlingsplan':       'predictive-actions',
      'prædiktive handlinger':         'predictive-actions',
      'predictive confidence':         'predictive-confidence',
      'tillidsniveau':                 'predictive-confidence',
      'schedule overview':             'predictive-schedule-overview',
      'tidsplanoversigt':              'predictive-schedule-overview',
      'management conclusion':         'predictive-management-conclusion',
      'ledelseskonklusion':            'predictive-management-conclusion',
      'delayed activities':            'predictive-delayed-activities',
      'forsinkede aktiviteter':        'predictive-delayed-activities',
      'root cause analysis':           'predictive-root-cause',
      'årsagsanalyse':                 'predictive-root-cause',
      'priority actions':              'predictive-priority-actions',
      'prioriterede handlinger':       'predictive-priority-actions',
      'resource assessment':           'predictive-resource-assessment',
      'ressourcevurdering':            'predictive-resource-assessment',
      'forcing assessment':            'predictive-forcing-assessment',
      'forceringsvurdering':           'predictive-forcing-assessment',
      'summary by area':               'predictive-summary-by-area',
      'oversigt efter område':         'predictive-summary-by-area',
    };

    container.querySelectorAll('.module-card').forEach(card => {
      const heading = card.querySelector('h1,h2,h3,h4');
      if (!heading) return;
      const text = heading.textContent.trim().toLowerCase();
      const id = HEADING_MAP[text];
      if (id && !card.id) card.id = id;
    });

    if (!container.querySelector('#predictive-project-status')) {
      container.querySelectorAll('div').forEach(div => {
        if (div.id || div.classList.contains('module-card') || div.closest('.module-card')) return;
        const style = div.getAttribute('style') || '';
        if (!style.includes('border-left') || !style.includes('border-radius')) return;
        const text = div.textContent;
        if (text.includes('PROJECT STATUS') || text.includes('PROJEKTSTATUS')) {
          if (!div.id) div.id = 'predictive-project-status';
        }
      });
    }

    if (!container.querySelector('#predictive-overview')) {
      const bigNum = container.querySelector('[style*="font-size:56px"]');
      if (bigNum) {
        const novaReport = container.querySelector('.nova-report') || container;
        let el = bigNum.parentElement;
        while (el && el.parentElement !== novaReport && el.parentElement !== container) {
          el = el.parentElement;
        }
        if (el && !el.id) el.id = 'predictive-overview';
      }
    }
  }, []);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    setNavSections([]);
    setActiveSectionId(null);

    if (!activeAnalysis?.predictive_insights || !reportContainerRef.current) return;

    const raf = requestAnimationFrame(() => {
      if (!reportContainerRef.current) return;
      stampSectionIds(reportContainerRef.current);
      const found = SCHEDULE_NAV_SECTIONS.filter(s =>
        reportContainerRef.current.querySelector(`[id="${s.id}"]`)
      );
      setNavSections(found);
      if (found.length > 0) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter(e => e.isIntersecting)
              .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible.length > 0) setActiveSectionId(visible[0].target.id);
          },
          { root: scrollContainerRef.current || null, threshold: 0.1, rootMargin: '0px 0px -55% 0px' }
        );
        found.forEach(s => {
          const el = reportContainerRef.current.querySelector(`[id="${s.id}"]`);
          if (el) observerRef.current.observe(el);
        });
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [activeAnalysis?.predictive_insights, stampSectionIds]);

  const handleNavClick = (sectionId) => {
    const el = reportContainerRef.current?.querySelector(`[id="${sectionId}"]`);
    if (!el) return;
    setActiveSectionId(sectionId);
    const NAV_OFFSET = 8;
    if (scrollContainerRef.current) {
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      scrollContainerRef.current.scrollBy({ top: elRect.top - containerRect.top - NAV_OFFSET, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNewAnalysis = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const analysisId = scheduleService.generateAnalysisId();
      const now = new Date();
      const title = `${t('scheduleAnalysis.analysis')} ${now.toLocaleDateString(i18n.language === 'da' ? 'da-DK' : 'en-US', { day: '2-digit', month: 'short' })}, ${now.toLocaleTimeString(i18n.language === 'da' ? 'da-DK' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;
      const data = await scheduleService.createAnalysis(analysisId, title);
      if (data.success) {
        await loadAnalyses();
        setActiveAnalysisId(data.analysis.analysis_id);
        setActiveAnalysis({ ...data.analysis, status: 'pending' });
        setError(null);
      }
    } catch (err) {
      console.error('Failed to create analysis:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    try {
      await scheduleService.deleteAnalysis(analysisId);
      delete analysisCacheRef.current[analysisId];
      if (activeAnalysisId === analysisId) {
        setActiveAnalysisId(null);
        setActiveAnalysis(null);
      }
      await loadAnalyses();
    } catch (err) {
      console.error('Failed to delete analysis:', err);
    }
  };

  const handleRenameAnalysis = async (analysisId, newTitle) => {
    try {
      await scheduleService.renameAnalysis(analysisId, newTitle);
      if (analysisCacheRef.current[analysisId]) {
        analysisCacheRef.current[analysisId] = {
          ...analysisCacheRef.current[analysisId],
          title: newTitle,
        };
      }
      await loadAnalyses();
      if (activeAnalysisId === analysisId && activeAnalysis) {
        setActiveAnalysis(prev => ({ ...prev, title: newTitle }));
      }
    } catch (err) {
      console.error('Failed to rename analysis:', err);
    }
  };

  const handleFileUpload = async (file) => {
    if (!activeAnalysisId || isProcessing) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.csv')) {
      setError(t('scheduleAnalysis.errors.pdfOnly'));
      return;
    }

    if (ext.endsWith('.csv')) {
      try {
        const text = await file.text();
        const rows = text.split('\n').filter(line => line.trim().length > 0);
        const dataRows = rows.length > 0 ? rows.length - 1 : 0;
        if (dataRows > 5000) {
          setError(t('scheduleAnalysis.errors.csvRowLimit', { count: dataRows.toLocaleString(), max: '5,000' }));
          return;
        }
      } catch {}
    }

    setIsProcessing(true);
    setError(null);
    setProgressData({ stage: 'received', message: t('scheduleAnalysis.progress.received'), step: 0, total_steps: 6 });

    try {
      const lang = i18n.language?.substring(0, 2) || 'en';
      const data = await scheduleService.uploadAndAnalyze(activeAnalysisId, file, lang);

      if (data.success) {
        setProgressData({ stage: 'complete', message: t('scheduleAnalysis.progress.complete'), step: 6, total_steps: 6 });
        await new Promise(r => setTimeout(r, 800));
        setActiveAnalysis(prev => {
          const updated = {
            ...prev,
            status: 'completed',
            filename: file.name,
            predictive_insights: data.predictive_insights,
            processing_time: data.processing_time_seconds,
            model: data.predictive_model,
            reference_date: data.reference_date,
          };
          analysisCacheRef.current[activeAnalysisId] = updated;
          return updated;
        });
        await loadAnalyses();
      } else {
        setError(data.error || t('scheduleAnalysis.errors.failed'));
        setActiveAnalysis(prev => ({ ...prev, status: 'error' }));
      }
    } catch (err) {
      console.error('Upload/analyze error:', err);
      setError(err.message || t('scheduleAnalysis.errors.failed'));
      setActiveAnalysis(prev => prev ? { ...prev, status: 'error' } : prev);
    } finally {
      setIsProcessing(false);
      setProgressData({ stage: '', message: '', step: 0, total_steps: 6 });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const renderUploadZone = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
          dragOver
            ? 'border-[#00D6D6] bg-[#00D6D6]/5 scale-[1.02]'
            : 'border-slate-300 hover:border-[#00D6D6] hover:bg-[#00D6D6]/5'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#00D6D6] to-[#00B4B4] flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {t('scheduleAnalysis.upload.title')}
        </h3>
        <p className="text-slate-500 mb-4">
          {t('scheduleAnalysis.upload.subtitle')}
        </p>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00D6D6] to-[#00B4B4] text-white font-medium text-sm shadow-md hover:shadow-lg transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('scheduleAnalysis.upload.button')}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          {t('scheduleAnalysis.upload.hint')}
        </p>
      </div>
    </div>
  );

  const renderProcessing = () => {
    const hasRealProgress = progressData.step > 0 && progressData.stage !== 'unknown';
    const realPercent = hasRealProgress
      ? Math.min((progressData.step / (progressData.total_steps || 6)) * 100, 100)
      : 0;
    const timePercent = Math.min((elapsedSeconds / 90) * 85, 85);
    const progressPercent = hasRealProgress ? realPercent : timePercent;

    const fallbackMessages = [
      t('scheduleAnalysis.progress.received'),
      t('scheduleAnalysis.progress.reading'),
      t('scheduleAnalysis.progress.extracting'),
      t('scheduleAnalysis.progress.analyzing'),
      t('scheduleAnalysis.progress.formatting'),
    ];
    const fallbackIdx = Math.min(Math.floor(elapsedSeconds / 18), fallbackMessages.length - 1);
    const displayMessage = hasRealProgress
      ? progressData.message
      : fallbackMessages[fallbackIdx];
    const displayStep = hasRealProgress
      ? `${t('scheduleAnalysis.processing.step')} ${progressData.step} / ${progressData.total_steps || 6}`
      : `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;

    const isThinking = fallbackIdx >= 3 || (hasRealProgress && progressData.step >= 4);

    const renderScanIcon = () => (
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 rounded-2xl bg-[#00D6D6]/8 animate-ping" style={{ animationDuration: '2.5s' }} />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D6D6] to-[#00B4B4] flex items-center justify-center shadow-lg shadow-[#00D6D6]/25">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div
            className="absolute left-0 right-0 h-0.5 bg-white/40 rounded-full"
            style={{
              animation: 'scanLine 2s ease-in-out infinite',
              top: '20%',
            }}
          />
        </div>
      </div>
    );

    const renderThinkingIcon = () => (
      <div className="relative w-20 h-20 mx-auto mb-6">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              animation: `orbitSpin ${3 + i * 0.5}s linear infinite`,
              animationDelay: `${i * -1}s`,
            }}
          >
            <div
              className="absolute rounded-full bg-[#00D6D6]"
              style={{
                width: `${6 - i}px`,
                height: `${6 - i}px`,
                top: '-3px',
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: 1 - i * 0.25,
              }}
            />
          </div>
        ))}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#00D6D6] to-[#00B4B4] flex items-center justify-center shadow-lg shadow-[#00D6D6]/30">
          <svg className="w-7 h-7 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animationDuration: '1.5s' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>
    );

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <style>{`
          @keyframes scanLine {
            0%, 100% { top: 15%; opacity: 0.3; }
            50% { top: 75%; opacity: 0.7; }
          }
          @keyframes orbitSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div className="text-center max-w-sm w-full">
          {isThinking ? renderThinkingIcon() : renderScanIcon()}

          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {isThinking ? t('scheduleAnalysis.processing.thinking') : t('scheduleAnalysis.processing.title')}
          </h3>

          <p className="text-sm text-[#00B4B4] font-medium mb-6 min-h-[40px] transition-all duration-500">
            {displayMessage}
            <span className="inline-flex ml-0.5 gap-[3px] align-baseline">
              <span className="w-1 h-1 rounded-full bg-[#00B4B4] animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.8s' }} />
              <span className="w-1 h-1 rounded-full bg-[#00B4B4] animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.8s' }} />
              <span className="w-1 h-1 rounded-full bg-[#00B4B4] animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }} />
            </span>
          </p>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00D6D6] to-[#00B4B4]"
              style={{
                width: `${Math.max(progressPercent, 5)}%`,
                transition: 'width 1s ease-out',
              }}
            />
          </div>

          <p className="text-xs text-slate-400">
            {displayStep}
          </p>

          <div className="mt-6 flex items-center justify-center">
            <img
              src="/azure-badge.jpg"
              alt="Microsoft Azure"
              className="h-6 object-contain border border-gray-200 px-3 pb-0.5 rounded-full opacity-50"
            />
          </div>
        </div>
      </div>
    );
  };

  const handleDownloadPdf = async () => {
    if (!activeAnalysisId || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const lang = i18n.language?.substring(0, 2) || 'en';
      await scheduleService.downloadPdf(activeAnalysisId, lang);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(t('scheduleAnalysis.errors.pdfFailed'));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Memoized DOMPurify sanitization — recomputes only when the raw HTML changes
  const sanitized = useMemo(() => {
    if (!activeAnalysis?.predictive_insights) return '';
    return DOMPurify.sanitize(activeAnalysis.predictive_insights, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style', 'class'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
    });
  }, [activeAnalysis?.predictive_insights]);

  const renderReport = () => {
    if (!activeAnalysis?.predictive_insights) return null;

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D6D6] to-[#00B4B4] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{activeAnalysis.filename}</h3>
              <p className="text-xs text-slate-500">
                {activeAnalysis.reference_date && `${t('scheduleAnalysis.report.refDate')}: ${activeAnalysis.reference_date}`}
                {activeAnalysis.processing_time && ` · ${activeAnalysis.processing_time.toFixed(1)}s`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:shadow-md transition-all disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {t('scheduleAnalysis.report.downloadPdf')}
            </button>
            <button
              onClick={() => {
                setActiveAnalysis(prev => ({ ...prev, predictive_insights: null, status: 'pending', filename: null }));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D6D6] to-[#00B4B4] text-white text-sm font-medium hover:shadow-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {t('scheduleAnalysis.report.newUpload')}
            </button>
          </div>
        </div>
        {navSections.length > 0 && (
          <div className="flex-shrink-0 z-10 bg-white/98 backdrop-blur-sm border-b border-slate-200 shadow-sm px-4 py-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {navSections.map(s => {
                const isActive = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleNavClick(s.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-[#00D6D6] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-[#00D6D6]/15 hover:text-[#00B4B4]'
                    }`}
                  >
                    {i18n.language?.startsWith('da') ? s.labelDa : s.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
          <div
            ref={reportContainerRef}
            className="p-6"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        </div>
      </div>
    );
  };

  const renderWelcome = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#00D6D6]/10 to-[#00B4B4]/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-[#00B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">
          {t('scheduleAnalysis.welcome.title')}
        </h2>
        <p className="text-slate-500 mb-6">
          {t('scheduleAnalysis.welcome.subtitle')}
        </p>
        <button
          onClick={handleNewAnalysis}
          disabled={isCreating}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00D6D6] to-[#00B4B4] text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {isCreating ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          {t('scheduleAnalysis.welcome.newAnalysis')}
        </button>
        <div className="mt-8 flex items-center justify-center">
          <img
            src="/azure-badge.jpg"
            alt="Microsoft Azure"
            className="h-8 object-contain border border-gray-200 px-4 pb-1 rounded-full"
          />
        </div>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#00D6D6]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-[#00D6D6] border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-slate-400">{t('common.loading')}</p>
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (!activeAnalysisId) return renderWelcome();
    if (isLoadingAnalysis) return renderLoading();
    if (isProcessing) return renderProcessing();
    if (activeAnalysis?.status === 'completed' && activeAnalysis?.predictive_insights) return renderReport();
    return renderUploadZone();
  };

  return (
    <div className="flex h-full bg-slate-50">
      <ScheduleAnalysisSidebar
        analyses={analyses}
        activeAnalysisId={activeAnalysisId}
        onSelectAnalysis={setActiveAnalysisId}
        onNewAnalysis={handleNewAnalysis}
        onDeleteAnalysis={handleDeleteAnalysis}
        onRenameAnalysis={handleRenameAnalysis}
        isLoadingList={isLoadingList}
        isCreating={isCreating}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {renderMainContent()}
      </div>
    </div>
  );
};

export default ScheduleAnalysis;
