import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const MiniSpinner = () => (
  <svg className="w-4 h-4 animate-spin text-[#00D6D6]" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ScheduleAnalysisSidebar = ({
  analyses = [],
  activeAnalysisId,
  onSelectAnalysis,
  onNewAnalysis,
  onDeleteAnalysis,
  onRenameAnalysis,
  isLoadingList,
  isCreating,
  isOpen,
  onToggle,
}) => {
  const { t } = useTranslation();
  const [deletingId, setDeletingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const handleDelete = async (e, analysisId) => {
    e.stopPropagation();
    setDeletingId(analysisId);
    try {
      await onDeleteAnalysis(analysisId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartRename = (e, analysis) => {
    e.stopPropagation();
    setRenamingId(analysis.analysis_id);
    setRenameValue(analysis.title || '');
  };

  const handleSaveRename = async (analysisId) => {
    if (!renameValue.trim()) return;
    setIsSavingRename(true);
    try {
      await onRenameAnalysis(analysisId, renameValue.trim());
    } finally {
      setIsSavingRename(false);
      setRenamingId(null);
    }
  };

  const handleRenameKeyDown = (e, analysisId) => {
    if (e.key === 'Enter') handleSaveRename(analysisId);
    if (e.key === 'Escape') setRenamingId(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-2 h-2 rounded-full bg-[#00D6D6] flex-shrink-0" />
        );
      case 'processing':
        return (
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
        );
      case 'error':
        return (
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        );
      default:
        return (
          <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
        );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    if (days === 0) return t('scheduleAnalysis.sidebar.today');
    if (days === 1) return t('scheduleAnalysis.sidebar.yesterday');
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
  };

  if (!isOpen) return null;

  return (
    <div className="w-72 h-full flex flex-col bg-white border-r border-slate-200 flex-shrink-0">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00D6D6] to-[#00B4B4] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800">{t('scheduleAnalysis.sidebar.title')}</h2>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <button
          onClick={onNewAnalysis}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00D6D6] to-[#00B4B4] text-white font-medium text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isCreating ? (
            <>
              <MiniSpinner />
              <span>{t('scheduleAnalysis.sidebar.creating')}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{t('scheduleAnalysis.sidebar.newAnalysis')}</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-8">
            <MiniSpinner />
          </div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">{t('scheduleAnalysis.sidebar.empty')}</p>
          </div>
        ) : (
          analyses.map((analysis) => {
            const isActive = analysis.analysis_id === activeAnalysisId;
            const isDeleting = deletingId === analysis.analysis_id;
            const isRenaming = renamingId === analysis.analysis_id;

            return (
              <div
                key={analysis.analysis_id}
                onClick={() => !isDeleting && onSelectAnalysis(analysis.analysis_id)}
                className={`group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                  isDeleting ? 'opacity-50 line-through' : ''
                } ${
                  isActive
                    ? 'bg-[#00D6D6]/10 border border-[#00D6D6]/30 shadow-sm'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {getStatusIcon(analysis.status)}
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, analysis.analysis_id)}
                          autoFocus
                          className="flex-1 text-sm px-2 py-0.5 rounded border border-[#00D6D6]/50 focus:outline-none focus:ring-1 focus:ring-[#00D6D6] bg-white"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveRename(analysis.analysis_id); }}
                          disabled={isSavingRename}
                          className="p-0.5 rounded hover:bg-[#00D6D6]/15"
                        >
                          {isSavingRename ? <MiniSpinner /> : (
                            <svg className="w-3.5 h-3.5 text-[#00B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                          className="p-0.5 rounded hover:bg-red-100"
                        >
                          <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-[#00B4B4]' : 'text-slate-700'}`}>
                        {analysis.title || t('scheduleAnalysis.sidebar.untitled')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {analysis.filename && (
                        <p className="text-xs text-slate-400 truncate max-w-[120px]">{analysis.filename}</p>
                      )}
                      <span className="text-xs text-slate-400">{formatDate(analysis.created_at)}</span>
                    </div>
                  </div>

                  {!isRenaming && (
                    <div className={`flex items-center gap-0.5 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                      <button
                        onClick={(e) => handleStartRename(e, analysis)}
                        className="p-1 rounded-lg hover:bg-[#00D6D6]/15 transition-colors"
                        title={t('scheduleAnalysis.sidebar.rename')}
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, analysis.analysis_id)}
                        disabled={isDeleting}
                        className="p-1 rounded-lg hover:bg-red-100 transition-colors"
                        title={t('scheduleAnalysis.sidebar.delete')}
                      >
                        {isDeleting ? <MiniSpinner /> : (
                          <svg className="w-3.5 h-3.5 text-slate-500 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{analyses.length} {t('scheduleAnalysis.sidebar.totalAnalyses')}</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleAnalysisSidebar;
