import React from 'react';
import { useTranslation } from 'react-i18next';

const NusfToggle = ({ enabled, onChange, className = '' }) => {
  const { i18n } = useTranslation();
  const isDanish = i18n.language?.startsWith('da');

  const label = isDanish ? 'NUSF v2 pipeline' : 'NUSF v2 pipeline';
  const description = isDanish
    ? 'Brug næste generation NUSF-behandling'
    : 'Use next-generation NUSF processing';
  const badgeText = isDanish ? 'Beta' : 'Beta';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
        style={{
          backgroundColor: enabled ? '#1eb5ee' : '#cbd5e1',
        }}
      >
        <span
          className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          style={{
            transform: enabled ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </button>

      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold" style={{ color: '#1c2631' }}>
            {label}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
            style={{
              backgroundColor: 'rgba(30, 181, 238, 0.12)',
              color: '#1eb5ee',
            }}
          >
            {badgeText}
          </span>
        </div>
        <span className="text-xs" style={{ color: '#64748b' }}>
          {description}
        </span>
      </div>
    </div>
  );
};

export default NusfToggle;
