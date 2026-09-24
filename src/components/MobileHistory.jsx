import React from 'react';
import { useTranslation } from 'react-i18next';

// Mobile-only replacement for the desktop history sidebars:
// a slim bar (History + New) and a bottom sheet holding the history list.

export const MobileHistoryBar = ({ title, newLabel, onOpenHistory, onNew, newDisabled = false }) => (
  <div className="md:hidden flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
    <button
      onClick={onOpenHistory}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
    >
      <svg className="w-5 h-5 text-[#00B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
      </svg>
      {title}
    </button>
    <button
      onClick={onNew}
      disabled={newDisabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[#1eb5ee] to-[#00B4B4] shadow-sm disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {newLabel}
    </button>
  </div>
);

export const MobileHistorySheet = ({ open, onClose, children }) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex flex-col max-h-[80vh] bg-white rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-slate-300 flex-shrink-0" />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
        <button
          onClick={onClose}
          className="flex-shrink-0 py-3 text-sm font-medium text-slate-600 border-t border-slate-200"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};
