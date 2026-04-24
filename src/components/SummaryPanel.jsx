import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SummaryPanel = ({ summary, language = 'en' }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!summary) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };

  const isDanish = language === 'da' || summary.title?.includes('Opsummering');

  return (
    <div className="w-full mt-4 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
        <div 
          className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#00D6D6]/10 to-transparent border-b border-slate-200 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00D6D6] to-[#00B8B8] flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {summary.title || (isDanish ? 'Opsummering af Ændringer' : 'Summary of Changes')}
              </h3>
              <p className="text-xs text-slate-500">
                {isDanish ? 'Version A → Version B' : 'Version A → Version B'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                copied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-[#00D6D6] hover:text-[#00D6D6]'
              } shadow-sm`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isDanish ? 'Kopieret!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{isDanish ? 'Kopier' : 'Copy'}</span>
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg 
                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-5 space-y-4">
            {summary.overview && summary.overview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#00D6D6]"></div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {isDanish ? 'Overblik' : 'Overview'}
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {summary.overview.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl font-bold text-[#00D6D6]">{item.count}</div>
                      <div className="text-xs text-slate-600 mt-1 leading-tight">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.topImpacts && summary.topImpacts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {isDanish ? 'Største Påvirkninger' : 'Top Impacts'}
                  </h4>
                </div>
                <ul className="space-y-2">
                  {summary.topImpacts.map((impact, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700">{impact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.dateShifts && summary.dateShifts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {isDanish ? 'Største Datoforskydninger' : 'Largest Date Shifts'}
                  </h4>
                </div>
                <div className="space-y-2">
                  {summary.dateShifts.map((shift, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">{shift.task}</span>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        shift.direction === 'later' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {shift.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.durationChanges && summary.durationChanges.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {isDanish ? 'Største Varighedsændringer' : 'Largest Duration Changes'}
                  </h4>
                </div>
                <div className="space-y-2">
                  {summary.durationChanges.map((change, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">{change.task}</span>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        change.change.includes('+') 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'bg-teal-100 text-teal-700'
                      }`}>
                        {change.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.rawBullets && summary.rawBullets.length > 0 && !summary.overview?.length && (
              <div className="space-y-2">
                <ul className="space-y-2">
                  {summary.rawBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-2">
                      <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-[#00D6D6]"></span>
                      <span className="text-sm text-slate-700">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const parseSummaryFromResponse = (text) => {
  if (!text) return null;
  
  const summaryMarkers = [
    '## Summary of Changes',
    '## Opsummering af Ændringer',
    '**Summary of Changes',
    '**Opsummering af Ændringer'
  ];
  
  let summaryStartIndex = -1;
  let foundMarker = '';
  
  for (const marker of summaryMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && (summaryStartIndex === -1 || idx < summaryStartIndex)) {
      summaryStartIndex = idx;
      foundMarker = marker;
    }
  }
  
  if (summaryStartIndex === -1) return null;
  
  let summaryText = text.substring(summaryStartIndex);
  
  const endMarkers = ['\n---\n', '\n\n---'];
  for (const endMarker of endMarkers) {
    const endIdx = summaryText.lastIndexOf(endMarker);
    if (endIdx > 50) {
      summaryText = summaryText.substring(0, endIdx);
    }
  }
  
  const isDanish = foundMarker.includes('Opsummering');
  
  const parsed = {
    title: isDanish ? 'Opsummering af Ændringer' : 'Summary of Changes',
    overview: [],
    topImpacts: [],
    dateShifts: [],
    durationChanges: [],
    rawBullets: [],
    plainText: summaryText.replace(/[#*]/g, '').trim()
  };
  
  const overviewMatch = summaryText.match(/\*\*(Overview|Overblik):\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  if (overviewMatch) {
    const bullets = overviewMatch[2].match(/•\s*([^\n•]+)/g);
    if (bullets) {
      bullets.forEach(bullet => {
        const cleanBullet = bullet.replace(/^•\s*/, '').trim();
        const numMatch = cleanBullet.match(/^(\d+)\s+(.+)/);
        if (numMatch) {
          parsed.overview.push({ count: numMatch[1], label: numMatch[2] });
        } else {
          parsed.rawBullets.push(cleanBullet);
        }
      });
    }
  }
  
  const impactsMatch = summaryText.match(/\*\*(Top Impacts|Største Påvirkninger):\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  if (impactsMatch) {
    const bullets = impactsMatch[2].match(/•\s*([^\n•]+)/g);
    if (bullets) {
      bullets.forEach(bullet => {
        parsed.topImpacts.push(bullet.replace(/^•\s*/, '').trim());
      });
    }
  }
  
  const dateShiftsMatch = summaryText.match(/\*\*(Largest Date Shifts|Største Datoforskydninger):\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  if (dateShiftsMatch) {
    const bullets = dateShiftsMatch[2].match(/•\s*([^\n•]+)/g);
    if (bullets) {
      bullets.forEach(bullet => {
        const cleanBullet = bullet.replace(/^•\s*/, '').trim();
        const shiftMatch = cleanBullet.match(/(.+?):\s*(?:shifted\s*)?(\d+\s*(?:days?|weeks?|dage?|uger?))\s*(earlier|later|tidligere|senere)?/i);
        if (shiftMatch) {
          parsed.dateShifts.push({
            task: shiftMatch[1].trim(),
            amount: shiftMatch[2] + (shiftMatch[3] ? ' ' + shiftMatch[3] : ''),
            direction: shiftMatch[3]?.toLowerCase().includes('earlier') || shiftMatch[3]?.toLowerCase().includes('tidligere') ? 'earlier' : 'later'
          });
        } else {
          parsed.dateShifts.push({ task: cleanBullet, amount: '', direction: 'later' });
        }
      });
    }
  }
  
  const durationMatch = summaryText.match(/\*\*(Largest Duration Changes|Største Varighedsændringer):\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  if (durationMatch) {
    const bullets = durationMatch[2].match(/•\s*([^\n•]+)/g);
    if (bullets) {
      bullets.forEach(bullet => {
        const cleanBullet = bullet.replace(/^•\s*/, '').trim();
        const durationChangeMatch = cleanBullet.match(/(.+?):\s*(?:duration changed from\s*)?(\d+)\s*(?:to|til)\s*(\d+)\s*(?:days?|dage?)?\s*\(([+-]\d+\s*(?:days?|dage?))\)/i);
        if (durationChangeMatch) {
          parsed.durationChanges.push({
            task: durationChangeMatch[1].trim(),
            from: durationChangeMatch[2],
            to: durationChangeMatch[3],
            change: durationChangeMatch[4]
          });
        } else {
          parsed.durationChanges.push({ task: cleanBullet, change: '' });
        }
      });
    }
  }
  
  if (parsed.overview.length === 0 && parsed.topImpacts.length === 0) {
    const allBullets = summaryText.match(/•\s*([^\n•]+)/g);
    if (allBullets) {
      allBullets.forEach(bullet => {
        parsed.rawBullets.push(bullet.replace(/^•\s*/, '').trim());
      });
    }
  }
  
  return parsed;
};

export const extractResponseWithoutSummary = (text) => {
  if (!text) return text;
  
  const summaryMarkers = [
    '---\n## Summary of Changes',
    '---\n## Opsummering af Ændringer',
    '\n---\n## Summary of Changes',
    '\n---\n## Opsummering af Ændringer'
  ];
  
  let cleanText = text;
  
  for (const marker of summaryMarkers) {
    const idx = cleanText.indexOf(marker);
    if (idx !== -1) {
      cleanText = cleanText.substring(0, idx).trim();
      break;
    }
  }
  
  return cleanText;
};

export default SummaryPanel;
