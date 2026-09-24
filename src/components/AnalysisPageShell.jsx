import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScheduleAnalysisSidebar from './ScheduleAnalysisSidebar';
import { MobileHistoryBar, MobileHistorySheet } from './MobileHistory';

// Desktop: collapsible history sidebar. Mobile: History/New bar + bottom sheet.
const AnalysisPageShell = ({ sidebarProps, sidebarOpen, onOpenSidebar, errorBanner, children }) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheetAfter = (fn) => (...args) => { setSheetOpen(false); return fn(...args); };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50">
      <div className="hidden md:flex h-full flex-shrink-0">
        <ScheduleAnalysisSidebar {...sidebarProps} isOpen={sidebarOpen} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
        <MobileHistoryBar
          title={t('scheduleAnalysis.sidebar.title')}
          newLabel={t('scheduleAnalysis.sidebar.newAnalysis')}
          onOpenHistory={() => setSheetOpen(true)}
          onNew={sidebarProps.onNewAnalysis}
          newDisabled={sidebarProps.isCreating}
        />

        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="hidden md:block absolute top-4 left-4 z-20 p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {errorBanner}
        {children}
      </div>

      <MobileHistorySheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ScheduleAnalysisSidebar
          {...sidebarProps}
          isOpen
          embedded
          onSelectAnalysis={closeSheetAfter(sidebarProps.onSelectAnalysis)}
          onNewAnalysis={closeSheetAfter(sidebarProps.onNewAnalysis)}
        />
      </MobileHistorySheet>
    </div>
  );
};

export default AnalysisPageShell;
