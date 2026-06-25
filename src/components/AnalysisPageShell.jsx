import React from 'react';

const AnalysisPageShell = ({ sidebar, sidebarOpen, onOpenSidebar, errorBanner, children }) => (
  <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50">
    {sidebar}

    <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
      {!sidebarOpen && (
        <button
          onClick={onOpenSidebar}
          className="absolute top-4 left-4 z-20 p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {errorBanner}
      {children}
    </div>
  </div>
);

export default AnalysisPageShell;
