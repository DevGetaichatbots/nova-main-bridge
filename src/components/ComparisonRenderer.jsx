import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const ComparisonRenderer = ({ content, onAddComment }) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  const parsed = useMemo(() => parseAgentResponse(content), [content]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    setActiveFilter('all');
  }, [content]);

  if (!parsed.hasTables && !parsed.hasSummary && !parsed.hasHealth) {
    return null;
  }

  return (
    <div className="comparison-renderer space-y-6">
      {parsed.tables.length > 0 && (
        <GroupedTable 
          groupedData={parsed.groupedData} 
          tables={parsed.tables}
          onAddComment={onAddComment}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      )}
      {parsed.summary && <SummarySection content={parsed.summary} />}
      {parsed.health && <HealthSection content={parsed.health} healthData={parsed.healthData} />}
    </div>
  );
};

function parseAgentResponse(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { tables: [], summary: null, health: null, healthData: null, groupedData: null, hasTables: false, hasSummary: false, hasHealth: false };
  }

  const summaryPatterns = [
    /^##\s*SUMMARY_OF_CHANGES\s*$/im,
    /^##\s*OPSUMMERING_AF_ÆNDRINGER\s*$/im,
    /^##\s*Summary\s+of\s+Changes/im,
    /^##\s*Opsummering\s+af\s+Ændringer/im
  ];
  
  const healthPatterns = [
    /^##\s*PROJECT_HEALTH\s*$/im,
    /^##\s*PROJEKTSUNDHED\s*$/im,
    /^##\s*Project\s+Health/im,
    /^##\s*Projektsundhed/im
  ];

  let summaryStart = -1;
  let healthStart = -1;

  for (const pattern of summaryPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      summaryStart = markdown.indexOf(match[0]);
      break;
    }
  }

  for (const pattern of healthPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      healthStart = markdown.indexOf(match[0]);
      break;
    }
  }

  let tablesSection = '';
  let summarySection = '';
  let healthSection = '';

  if (summaryStart === -1 && healthStart === -1) {
    tablesSection = markdown;
  } else if (summaryStart !== -1 && healthStart !== -1) {
    if (summaryStart < healthStart) {
      tablesSection = markdown.substring(0, summaryStart).trim();
      summarySection = markdown.substring(summaryStart, healthStart).trim();
      healthSection = markdown.substring(healthStart).trim();
    } else {
      tablesSection = markdown.substring(0, healthStart).trim();
      healthSection = markdown.substring(healthStart, summaryStart).trim();
      summarySection = markdown.substring(summaryStart).trim();
    }
  } else if (summaryStart !== -1) {
    tablesSection = markdown.substring(0, summaryStart).trim();
    summarySection = markdown.substring(summaryStart).trim();
  } else if (healthStart !== -1) {
    tablesSection = markdown.substring(0, healthStart).trim();
    healthSection = markdown.substring(healthStart).trim();
  }

  let healthData = null;
  const healthDataMatch = healthSection.match(/<!--HEALTH_DATA:(.*?)-->/s);
  if (healthDataMatch) {
    try {
      healthData = JSON.parse(healthDataMatch[1]);
      healthSection = healthSection.replace(/<!--HEALTH_DATA:.*?-->/s, '').trim();
    } catch (e) {}
  }

  const tables = parseMarkdownTables(tablesSection);
  const groupedData = groupRowsByCategory(tables);

  return {
    tables,
    groupedData,
    summary: summarySection || null,
    health: healthSection || null,
    healthData,
    hasTables: tables.length > 0,
    hasSummary: !!summarySection,
    hasHealth: !!healthSection
  };
}

function parseMarkdownTables(markdown) {
  if (!markdown) return [];

  const hasTable = markdown.includes('|') && 
    markdown.split('\n').some(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
  if (!hasTable) return [];

  const tables = [];
  const lines = markdown.split('\n');
  let currentTable = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isSeparatorLine = line.startsWith('|') && line.endsWith('|') && line.replace(/[\|\-\s:]/g, '').length === 0;
    const isTableRow = line.startsWith('|') && line.endsWith('|') && !isSeparatorLine;

    if (isSeparatorLine) continue;

    if (isTableRow) {
      if (!currentTable) {
        currentTable = { headers: [], rows: [], id: `tbl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      }
      const cells = line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (currentTable.headers.length === 0) {
        currentTable.headers = cells;
      } else {
        const category = detectRowCategory(cells);
        currentTable.rows.push({ cells, category });
      }
    } else if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
      currentTable = null;
    }
  }
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }
  return tables;
}

function detectRowCategory(cells) {
  const text = cells.join(' ').toLowerCase();
  if (text.includes('not present in new') || text.includes('removed') || text.includes('fjernet')) return 'removed';
  if (text.includes('not present in old') || text.includes('added') || text.includes('tilføjet')) return 'added';
  if (text.includes('moved') || text.includes('modified') || text.includes('flyttet') || text.includes('ændret')) return 'moved';
  if (text.includes('delayed') || text.includes('later') || text.includes('forsinket') || text.includes('senere')) return 'delayed';
  if (text.includes('earlier') || text.includes('accelerated') || text.includes('tidligere') || text.includes('fremskyndet')) return 'accelerated';
  if (text.includes('critical') || text.includes('kritisk')) return 'critical';
  if (text.includes('risk') || text.includes('risiko')) return 'risks';
  return 'default';
}

function groupRowsByCategory(tables) {
  if (tables.length === 0) return null;

  const groups = {
    removed: { rows: [], label: 'Removed Tasks', labelDa: 'Fjernede Opgaver', colorClass: 'text-red-500', bgClass: 'bg-red-50', borderClass: 'border-red-200' },
    added: { rows: [], label: 'Added Tasks', labelDa: 'Tilføjede Opgaver', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200' },
    moved: { rows: [], label: 'Modified Tasks', labelDa: 'Ændrede Opgaver', colorClass: 'text-amber-500', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' },
    delayed: { rows: [], label: 'Delayed Tasks', labelDa: 'Forsinkede Opgaver', colorClass: 'text-red-500', bgClass: 'bg-red-50/50', borderClass: 'border-red-200' },
    accelerated: { rows: [], label: 'Accelerated Tasks', labelDa: 'Fremskyndede Opgaver', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50/50', borderClass: 'border-emerald-200' },
    critical: { rows: [], label: 'Critical Path', labelDa: 'Kritisk Vej', colorClass: 'text-amber-600', bgClass: 'bg-amber-50/50', borderClass: 'border-amber-200' },
    risks: { rows: [], label: 'Risks', labelDa: 'Risici', colorClass: 'text-red-600', bgClass: 'bg-red-50/50', borderClass: 'border-red-200' },
    default: { rows: [], label: 'Other Tasks', labelDa: 'Andre Opgaver', colorClass: 'text-cyan-500', bgClass: 'bg-cyan-50/50', borderClass: 'border-cyan-200' }
  };

  const headers = tables[0]?.headers || [];

  tables.forEach(table => {
    table.rows.forEach(row => {
      const cat = row.category || 'default';
      if (groups[cat]) groups[cat].rows.push(row.cells);
      else groups.default.rows.push(row.cells);
    });
  });

  return { groups, headers };
}

const CategoryIcon = ({ category, className = "w-5 h-5" }) => {
  const icons = {
    removed: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M8 12h8" strokeLinecap="round"/>
      </svg>
    ),
    added: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M12 8v8M8 12h8" strokeLinecap="round"/>
      </svg>
    ),
    moved: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M8 12h8M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    delayed: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M12 6v6l3 3" strokeLinecap="round"/>
      </svg>
    ),
    accelerated: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M13 6L9 14h6l-2 6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    critical: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 22h20L12 2z" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M12 9v4M12 17h.01" strokeLinecap="round"/>
      </svg>
    ),
    risks: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
      </svg>
    ),
    default: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" className="opacity-20" fill="currentColor" stroke="none"/>
        <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round"/>
      </svg>
    )
  };
  return icons[category] || icons.default;
};

const FILTER_CATEGORIES = [
  { key: 'all', labelEn: 'All', labelDa: 'Alle' },
  { key: 'added', labelEn: 'Added', labelDa: 'Tilføjet' },
  { key: 'removed', labelEn: 'Removed', labelDa: 'Fjernet' },
  { key: 'delayed', labelEn: 'Delayed', labelDa: 'Forsinket' },
  { key: 'moved', labelEn: 'Moved', labelDa: 'Flyttet' },
];

const GroupedTable = ({ groupedData, tables, onAddComment, activeFilter = 'all', onFilterChange }) => {
  const { i18n } = useTranslation();
  const isDanish = i18n.language === 'da';

  if (!groupedData) return null;

  const { groups, headers } = groupedData;
  const totalTasks = Object.values(groups).reduce((sum, g) => sum + g.rows.length, 0);
  const categoryOrder = ['removed', 'added', 'delayed', 'accelerated', 'moved', 'critical', 'risks', 'default'];

  const getCategoryCount = (key) => {
    if (key === 'all') return totalTasks;
    return groups[key]?.rows.length || 0;
  };

  const visibleCategories = activeFilter === 'all'
    ? categoryOrder
    : categoryOrder.filter(cat => cat === activeFilter);

  const handleExportCSV = () => {
    const allRows = [];
    categoryOrder.forEach(cat => {
      if (groups[cat]?.rows.length > 0) {
        groups[cat].rows.forEach(row => allRows.push(row));
      }
    });
    const csvContent = [headers.join(','), ...allRows.map(row => row.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comparison_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (value) => {
    if (!value || value === '—' || value === '-') return <span className="text-slate-400">—</span>;
    const lower = value.toLowerCase();
    if (lower.includes('added') || lower.includes('earlier') || lower.includes('tidligere') || lower.includes('tilføjet')) {
      return <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">{value}</span>;
    }
    if (lower.includes('removed') || lower.includes('later') || lower.includes('delayed') || lower.includes('fjernet') || lower.includes('forsinket') || lower.includes('senere')) {
      return <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 border border-red-200">{value}</span>;
    }
    if (lower.includes('moved') || lower.includes('modified') || lower.includes('ændret') || lower.includes('flyttet')) {
      return <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">{value}</span>;
    }
    return <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">{value}</span>;
  };

  const isBadgeColumn = (header) => {
    const l = header.toLowerCase();
    return l.includes('status') || l.includes('difference') || l.includes('forskel') || l === 'change' || l === 'ændring';
  };

  const isWeekColumn = (header) => {
    const l = header.toLowerCase();
    return l.includes('week') || l.includes('uge') || l === '#';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-cyan-500/5 border border-cyan-100 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-cyan-50/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{isDanish ? 'Sammenligningsresultater' : 'Comparison Results'}</h3>
            <p className="text-sm text-slate-500">{totalTasks} {isDanish ? 'opgaver analyseret' : 'tasks analyzed'}</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export CSV</span>
        </button>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2 flex-wrap">
        {FILTER_CATEGORIES.map(({ key, labelEn, labelDa }) => {
          const count = getCategoryCount(key);
          const isActive = activeFilter === key;
          const isEmpty = key !== 'all' && count === 0;
          return (
            <button
              key={key}
              onClick={() => !isEmpty && onFilterChange && onFilterChange(key)}
              disabled={isEmpty}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : isEmpty
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <span>{isDanish ? labelDa : labelEn}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white/25 text-white' : isEmpty ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800">
              {headers.map((header, idx) => (
                <th key={idx} className="px-5 py-4 text-left text-xs font-bold text-white/90 uppercase tracking-wider border-r border-white/5 last:border-r-0">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map(category => {
              const group = groups[category];
              if (!group || group.rows.length === 0) return null;
              return (
                <React.Fragment key={category}>
                  <tr className={`${group.bgClass} border-b-2 ${group.borderClass}`}>
                    <td colSpan={headers.length} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={group.colorClass}><CategoryIcon category={category} /></span>
                        <span className={`text-sm font-bold uppercase tracking-wide ${group.colorClass}`}>
                          {isDanish ? group.labelDa : group.label}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${group.bgClass} ${group.colorClass} border ${group.borderClass}`}>
                          {group.rows.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-cyan-50/50 border-l-4 border-transparent hover:border-cyan-400 transition-all`}>
                      {row.map((cell, cellIdx) => {
                        const header = headers[cellIdx] || '';
                        return (
                          <td key={cellIdx} className="px-5 py-4 text-sm border-r border-slate-100 last:border-r-0">
                            {cellIdx === 0 ? (
                              <span className="font-semibold text-slate-800">{cell || '—'}</span>
                            ) : isBadgeColumn(header) ? (
                              getStatusBadge(cell)
                            ) : isWeekColumn(header) ? (
                              cell && cell !== '—' ? (
                                <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">{cell}</span>
                              ) : <span className="text-slate-400">—</span>
                            ) : (
                              <span className="text-slate-600">{cell || '—'}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 bg-gradient-to-r from-cyan-50/50 to-slate-50 border-t border-slate-100 flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Total: {totalTasks} {isDanish ? 'opgaver' : 'tasks'}</span>
        <span className="text-xs text-slate-400">{new Date().toLocaleString()}</span>
      </div>
    </div>
  );
};

const SummarySection = ({ content }) => {
  const { i18n } = useTranslation();
  const isDanish = i18n.language === 'da' || content.toLowerCase().includes('opsummering');
  const lines = content.split('\n');
  
  const renderContent = () => {
    const elements = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-2 my-3">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-600">
                <span className="text-violet-500 mt-1">•</span>
                <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-violet-700 font-semibold">$1</strong>') }} />
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '---') { flushList(); return; }
      if (trimmed.match(/^##\s*(SUMMARY|OPSUMMERING)/i)) return;

      const boldMatch = trimmed.match(/^\*\*([^*]+):\*\*$/) || trimmed.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        flushList();
        elements.push(
          <h4 key={`h-${idx}`} className="text-sm font-bold text-violet-600 uppercase tracking-wide mt-5 mb-2 pb-2 border-b border-violet-100">
            {boldMatch[1].replace(/:$/, '')}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('• ') || trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        currentList.push(trimmed.substring(2));
        return;
      }

      flushList();
      elements.push(<p key={`p-${idx}`} className="text-slate-600 my-2" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-violet-700 font-semibold">$1</strong>') }} />);
    });

    flushList();
    return elements;
  };

  return (
    <div className="bg-gradient-to-br from-violet-50/80 to-purple-50/50 rounded-2xl p-6 border border-violet-100 shadow-lg shadow-violet-500/5">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.3" fill="currentColor" stroke="none"/>
            <path d="M7 8h10M7 12h10M7 16h6" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900">
          {isDanish ? 'Opsummering af Ændringer' : 'Summary of Changes'}
        </h3>
      </div>
      <div className="text-sm">{renderContent()}</div>
    </div>
  );
};

const HealthSection = ({ content, healthData }) => {
  const { i18n } = useTranslation();
  const isDanish = i18n.language === 'da' || content.toLowerCase().includes('projektsundhed');

  let status = 'stable';
  if (healthData?.status) status = healthData.status;
  else if (content.toLowerCase().includes('high risk') || content.toLowerCase().includes('høj risiko')) status = 'high_risk';
  else if (content.toLowerCase().includes('attention') || content.toLowerCase().includes('opmærksomhed')) status = 'attention';

  const statusConfig = {
    stable: { label: isDanish ? 'Stabil' : 'Stable', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', dotClass: 'bg-emerald-500' },
    attention: { label: isDanish ? 'Kræver Opmærksomhed' : 'Attention Needed', colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', dotClass: 'bg-amber-500' },
    high_risk: { label: isDanish ? 'Høj Risiko' : 'High Risk', colorClass: 'text-red-600', bgClass: 'bg-red-50', borderClass: 'border-red-200', dotClass: 'bg-red-500' }
  };
  const config = statusConfig[status] || statusConfig.stable;

  const lines = content.split('\n');
  const renderContent = () => {
    const elements = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-2 my-3">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-600">
                <span className={config.colorClass}>•</span>
                <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>') }} />
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '---') { flushList(); return; }
      if (trimmed.match(/^##\s*(PROJECT|PROJEKT)/i)) return;
      if (trimmed.match(/^\*\*Status:\*\*/i)) return;

      const boldMatch = trimmed.match(/^\*\*([^*]+):\*\*$/) || trimmed.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        flushList();
        elements.push(
          <h4 key={`h-${idx}`} className={`text-sm font-bold uppercase tracking-wide mt-5 mb-2 pb-2 border-b ${config.colorClass} ${config.borderClass}`}>
            {boldMatch[1].replace(/:$/, '')}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('• ') || trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        currentList.push(trimmed.substring(2));
        return;
      }

      flushList();
      elements.push(<p key={`p-${idx}`} className="text-slate-600 my-2" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>') }} />);
    });

    flushList();
    return elements;
  };

  return (
    <div className={`${config.bgClass} rounded-2xl p-6 border ${config.borderClass} shadow-lg`}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-current to-current/80 flex items-center justify-center shadow-lg ${config.colorClass}`} style={{ background: `linear-gradient(135deg, currentColor, currentColor)` }}>
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {isDanish ? 'Projektsundhed' : 'Project Health'}
          </h3>
        </div>
        <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full ${config.bgClass} border-2 ${config.borderClass}`}>
          <div className={`w-3 h-3 rounded-full ${config.dotClass} animate-pulse`}></div>
          <span className={`text-sm font-bold ${config.colorClass}`}>{config.label}</span>
        </div>
      </div>

      <div className="text-sm">{renderContent()}</div>

      {healthData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-current/10">
          {healthData.delayed_count !== undefined && (
            <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="text-2xl font-bold text-red-500">{healthData.delayed_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isDanish ? 'Forsinket' : 'Delayed'}</div>
            </div>
          )}
          {healthData.accelerated_count !== undefined && (
            <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-500">{healthData.accelerated_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isDanish ? 'Fremskyndet' : 'Accelerated'}</div>
            </div>
          )}
          {healthData.added_count !== undefined && (
            <div className="text-center p-4 bg-cyan-50 rounded-xl border border-cyan-100">
              <div className="text-2xl font-bold text-cyan-500">{healthData.added_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isDanish ? 'Tilføjet' : 'Added'}</div>
            </div>
          )}
          {healthData.removed_count !== undefined && (
            <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div className="text-2xl font-bold text-amber-500">{healthData.removed_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isDanish ? 'Fjernet' : 'Removed'}</div>
            </div>
          )}
          {healthData.impact_score !== undefined && (
            <div className={`text-center p-4 ${config.bgClass} rounded-xl border ${config.borderClass}`}>
              <div className={`text-2xl font-bold ${config.colorClass}`}>{healthData.impact_score}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isDanish ? 'Score' : 'Impact'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonRenderer;
export { parseAgentResponse };
