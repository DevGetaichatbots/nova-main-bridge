
// src/components/ChatWidget.jsx

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { chatService } from "../services/chatService";
import DOMPurify from "dompurify";

import { parseGeneralTaskData } from "../utils/dataParser";
import { normalizeApiResponse } from "../services/openAIService";
import { normalizeGuestApiResponse } from "../services/GuestOpenAIService";
import DataTable from "./DataTable";
import ReactMarkdown from "react-markdown";
import FileComparisonModal from "./FileComparisonModal";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { postWithAuth, getWithAuth, putWithAuth } from "../utils/authApi";
import { parseSummaryFromResponse, extractResponseWithoutSummary } from "./SummaryPanel";
import { generateComparisonPDF } from "../utils/pdfGenerator";
import ComparisonRenderer, { parseAgentResponse } from "./ComparisonRenderer";

// =================================================================
// CSV EXPORT UTILITY FUNCTION
// =================================================================
// Format plain-text bot responses into readable markdown
const formatBotText = (text) => {
  if (!text || typeof text !== 'string') return text;

  // If text already has markdown indicators, return as-is
  if (/[*#`\[\]]/.test(text)) return text;

  let t = text.trim();

  // Normalize line endings; collapse more than 2 newlines
  t = t.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // If no paragraph breaks at all and text is long, split on sentences
  if (!t.includes('\n') && t.length > 200) {
    // Split after sentence-ending punctuation followed by space + capital letter
    t = t.replace(/([.!?])\s+(?=[A-ZÆØÅ])/g, '$1\n\n');
  }

  // Convert ALL-CAPS section headers (e.g. "ASSESSMENT:", "SUMMARY") → bold
  t = t.replace(/^([A-ZÆØÅ][A-ZÆØÅ\s\-]{3,}):?\s*$/gm, (m) => `**${m.trim()}**`);

  // Wrap parenthetical examples (e.g., ...) in italics
  t = t.replace(/\(e\.g\.[^)]+\)/g, (m) => `*${m}*`);

  // Lines starting with – or • or · → markdown bullets
  t = t.replace(/^[–•·]\s+/gm, '- ');

  return t;
};

// =================================================================
const handleCsvExport = (button) => {
  try {
    const buttonId = button.id || button.getAttribute('data-id');
    let csvDataDiv, csvFilenameDiv;
    
    if (buttonId) {
      const id = buttonId.replace('exportBtn_', '');
      csvDataDiv = document.getElementById(`csvData_${id}`);
      csvFilenameDiv = document.getElementById(`csvFilename_${id}`);
    }
    
    if (!csvDataDiv) {
      const container = button.closest('.html-content-container') || button.parentElement;
      csvDataDiv = container?.querySelector('[id^="csvData_"]');
      csvFilenameDiv = container?.querySelector('[id^="csvFilename_"]');
    }
    
    if (!csvDataDiv) {
      console.error('CSV data not found');
      alert('CSV data not available');
      return;
    }
    
    const base64Data = csvDataDiv.textContent || csvDataDiv.innerText;
    const filename = csvFilenameDiv ? (csvFilenameDiv.textContent || csvFilenameDiv.innerText || 'export.csv') : 'export.csv';
    
    let csvContent;
    try {
      const jsonData = JSON.parse(atob(base64Data));
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        const headers = Object.keys(jsonData[0]);
        const csvRows = [headers.join(',')];
        jsonData.forEach(row => {
          const values = headers.map(header => {
            const val = row[header] ?? '';
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(','));
        });
        csvContent = csvRows.join('\n');
      } else {
        csvContent = atob(base64Data);
      }
    } catch (e) {
      csvContent = atob(base64Data);
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ CSV exported successfully:', filename);
  } catch (error) {
    console.error('CSV export error:', error);
    alert('Failed to export CSV: ' + error.message);
  }
};

// =================================================================
// HELPER: Extract summary text from HTML content
// =================================================================
const extractSummaryFromHtml = (htmlContent) => {
  if (!htmlContent) return null;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  const summaryMarkers = ['Summary of Changes', 'Sammenfatning af ændringer', 'Overview:', 'Overblik:'];
  let summaryText = '';
  let foundSummary = false;
  
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el) => {
    const text = el.textContent || '';
    if (summaryMarkers.some(marker => text.includes(marker))) {
      foundSummary = true;
    }
  });
  
  if (foundSummary) {
    const fullText = tempDiv.innerText || tempDiv.textContent || '';
    const summaryIndex = Math.max(
      fullText.indexOf('Summary of Changes'),
      fullText.indexOf('Sammenfatning af ændringer'),
      fullText.indexOf('• Summary'),
      fullText.indexOf('• Sammenfatning')
    );
    
    if (summaryIndex > -1) {
      summaryText = fullText.substring(summaryIndex).trim();
    } else {
      const overviewIndex = Math.max(
        fullText.indexOf('Overview:'),
        fullText.indexOf('Overblik:')
      );
      if (overviewIndex > -1) {
        summaryText = fullText.substring(overviewIndex).trim();
      }
    }
  }
  
  return summaryText || null;
};

// =================================================================
// AVAILABLE ANNOTATION TAGS
// =================================================================
const ANNOTATION_TAGS = [
  { id: 'bygherre', label: 'Bygherre', labelEn: 'Client' },
  { id: 'design_change', label: 'Design ændring', labelEn: 'Design change' },
  { id: 'awaiting', label: 'Afventer afklaring', labelEn: 'Awaiting clarification' },
  { id: 'reviewed', label: 'Gennemgået', labelEn: 'Reviewed' },
  { id: 'meeting', label: 'Møde', labelEn: 'Meeting' },
  { id: 'internal', label: 'Intern', labelEn: 'Internal' }
];

// =================================================================
// HELPER: Extract only table content from HTML (excluding summary)
// =================================================================
const extractTableOnlyFromHtml = (containerElement) => {
  if (!containerElement) return '';
  
  const tables = containerElement.querySelectorAll('table');
  if (tables.length === 0) return '';
  
  const formattedParts = [];
  tables.forEach((table) => {
    const rows = table.querySelectorAll('tr');
    const tableRows = [];
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      const cellTexts = [];
      cells.forEach((cell) => {
        let cellText = cell.innerText.trim().replace(/\s+/g, ' ');
        cellTexts.push(cellText);
      });
      if (cellTexts.length > 0) {
        tableRows.push(cellTexts.join('\t'));
      }
    });
    
    if (tableRows.length > 0) {
      formattedParts.push(tableRows.join('\n'));
    }
  });
  
  return formattedParts.join('\n\n');
};

// =================================================================
// INLINE ANNOTATION INPUT COMPONENT
// =================================================================
const AnnotationInput = memo(({ taskKey, taskName, existingAnnotations, onSave, language, sessionId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  const handleSave = async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      await onSave(taskKey, taskName, text.trim(), selectedTags);
      setText('');
      setSelectedTags([]);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save annotation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  if (!isEditing) {
    return (
      <div className="min-w-[180px]">
        {existingAnnotations && existingAnnotations.length > 0 ? (
          <div className="space-y-1.5">
            {existingAnnotations.slice(0, 2).map((ann, idx) => (
              <div key={ann.id || idx} className="text-xs">
                <div className="flex flex-wrap gap-1 mb-0.5">
                  {ann.tags?.map(tagId => {
                    const tag = ANNOTATION_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className="inline-block px-1.5 py-0.5 bg-[#00D6D6]/20 text-[#00D6D6] rounded text-[10px] font-medium">
                        [{language === 'da' ? tag.label : tag.labelEn}]
                      </span>
                    ) : null;
                  })}
                </div>
                <span className="text-gray-700">{ann.text}</span>
                {ann.authorName && (
                  <span className="text-gray-400 ml-1">- {ann.authorName}</span>
                )}
              </div>
            ))}
            {existingAnnotations.length > 2 && (
              <span className="text-[10px] text-gray-400">+{existingAnnotations.length - 2} {language === 'da' ? 'mere' : 'more'}</span>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-[#00D6D6] hover:underline mt-1"
            >
              + {language === 'da' ? 'Tilføj' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-gray-400 hover:text-[#00D6D6] flex items-center gap-1 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {language === 'da' ? 'Tilføj kommentar' : 'Add comment'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[200px] space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={language === 'da' ? 'Skriv kommentar...' : 'Write comment...'}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-[#00D6D6] focus:ring-1 focus:ring-[#00D6D6] outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
              setText('');
              setSelectedTags([]);
            }
          }}
          autoFocus
        />
      </div>
      
      <div className="flex flex-wrap gap-1">
        {ANNOTATION_TAGS.map(tag => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              selectedTags.includes(tag.id)
                ? 'bg-[#00D6D6] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {language === 'da' ? tag.label : tag.labelEn}
          </button>
        ))}
      </div>
      
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={!text.trim() || isSaving}
          className="px-2 py-1 text-[10px] bg-[#00D6D6] text-white rounded hover:bg-[#00B8B8] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '...' : (language === 'da' ? 'Gem' : 'Save')}
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setText('');
            setSelectedTags([]);
          }}
          className="px-2 py-1 text-[10px] bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
        >
          {language === 'da' ? 'Annuller' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.taskKey === nextProps.taskKey &&
    prevProps.language === nextProps.language &&
    prevProps.sessionId === nextProps.sessionId &&
    prevProps.existingAnnotations === nextProps.existingAnnotations;
});

AnnotationInput.displayName = 'AnnotationInput';

// Navigation sections that correspond to the 10 sections html_formatter.py can emit.
const SECTION_DEFINITIONS = [
  { id: 'section-data-trust',          labelEn: 'Analysis Basis',        labelDa: 'Analysegrundlag' },
  { id: 'section-executive-overview',  labelEn: 'Executive Overview',   labelDa: 'Ledelsesoverblik' },
  { id: 'section-biggest-risk',        labelEn: 'Biggest Risk',          labelDa: 'Største Risiko' },
  { id: 'section-estimated-impact',    labelEn: 'Estimated Impact',      labelDa: 'Estimeret Konsekvens' },
  { id: 'section-confidence-level',    labelEn: 'Confidence Level',      labelDa: 'Tillidsniveau' },
  { id: 'section-recommended-actions', labelEn: 'Recommended Actions',   labelDa: 'Anbefalede Handlinger' },
  { id: 'section-root-cause',          labelEn: 'Root Cause Analysis',   labelDa: 'Årsagsanalyse' },
  { id: 'section-comparison',          labelEn: 'Comparison Tables',     labelDa: 'Sammenligningsresultater' },
  { id: 'section-impact',              labelEn: 'Impact Assessment',     labelDa: 'Konsekvensvurdering' },
  { id: 'section-summary',             labelEn: 'Summary of Changes',    labelDa: 'Opsummering af Ændringer' },
  { id: 'section-health',              labelEn: 'Project Health',        labelDa: 'Projektsundhed' },
];

// =================================================================
// MEMOIZED HTML MESSAGE COMPONENT (prevents re-render on input change)
// =================================================================
const HtmlMessageContent = memo(({ htmlContent, messageId, language = 'en', sessionId, annotations = {}, onAnnotationSave, onAnnotationUpdate, user, sessionTitle, uploadedFileNames, onTableSectionsParsed, onNavReady, precomputedData = null }) => {
  const containerRef = useRef(null);
  const [tableCopied, setTableCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [tableSections, setTableSections] = useState([]);
  const [contentBlocks, setContentBlocks] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    setActiveFilter('all');
  }, [htmlContent]);

  const toggleRowExpand = (taskKey) => {
    setExpandedRows(prev => ({ ...prev, [taskKey]: !prev[taskKey] }));
  };
  
  const summaryText = useMemo(() => extractSummaryFromHtml(htmlContent), [htmlContent]);
  const hasSummary = !!summaryText;
  
  // Professional pulse icon SVG to replace heart emojis
  const PROFESSIONAL_HEALTH_ICON = `<span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:linear-gradient(135deg,#00D6D6 0%,#00B8B8 100%);border-radius:12px;box-shadow:0 4px 12px rgba(0,214,214,0.3);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>`;

  useEffect(() => {
    // If precomputed data from a previous parse exists, use it immediately — skip expensive DOM work
    if (precomputedData) {
      setTableSections(precomputedData.tableSections || []);
      setContentBlocks(precomputedData.contentBlocks || []);
      // Still notify the parent so collectedTableSections stays current for this session
      // (no DOM work — we're just passing already-computed references)
      if (onTableSectionsParsed && precomputedData.tableSections?.length > 0) {
        onTableSectionsParsed(messageId, precomputedData.tableSections, null, precomputedData.contentBlocks);
      }
      return;
    }

    console.log('📊 HtmlMessageContent useEffect triggered for message:', messageId);
    console.log('📊 htmlContent length:', htmlContent?.length);
    console.log('📊 onTableSectionsParsed defined:', !!onTableSectionsParsed);
    
    if (!htmlContent) {
      console.log('📊 No htmlContent, returning early');
      return;
    }
    
    const tempDiv = document.createElement('div');
    // Replace heart emojis with professional icon for Project Health
    let processedHtml = htmlContent
      .replace(/💛/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/💚/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/❤️/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/🧡/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/💜/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/🩷/g, PROFESSIONAL_HEALTH_ICON)
      .replace(/❤/g, PROFESSIONAL_HEALTH_ICON);
    tempDiv.innerHTML = processedHtml;
    
    tempDiv.querySelectorAll('style').forEach(s => s.remove());
    
    const allTables = tempDiv.querySelectorAll('table');
    console.log('📊 Tables found:', allTables.length, 'in message:', messageId);
    if (allTables.length === 0) {
      console.log('📊 No tables found, showing all content as HTML');
      const fullHtml = tempDiv.innerHTML.trim();
      if (fullHtml && fullHtml.replace(/<[^>]*>/g, '').trim().length > 0) {
        setContentBlocks([{ type: 'html', html: fullHtml }]);
      }
      return;
    }
    
    const sections = [];
    const seenRowKeys = new Set();
    let globalRowIndex = 0;
    
    allTables.forEach((table, tableIdx) => {
      // Tables inside section-data-trust pass through as raw HTML — don't extract them
      if (table.closest && table.closest('[id="section-data-trust"]')) return;

      const tableHeaders = [];
      const tableRows = [];
      
      const headerRow = table.querySelector('thead tr, tr:first-child');
      if (headerRow) {
        headerRow.querySelectorAll('th, td').forEach(cell => {
          tableHeaders.push(cell.innerText.trim());
        });
      }
      
      if (tableHeaders.length === 0) return;

      let groupName = '';
      const catSection = table.closest('.category-section');
      if (catSection) {
        const headingDiv = catSection.querySelector('h3, h4, [style*="font-weight"]');
        if (headingDiv) {
          groupName = headingDiv.innerText.replace(/\d+$/, '').trim();
        }
      }
      
      const bodyRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      bodyRows.forEach(row => {
        const cells = [];
        row.querySelectorAll('td').forEach(cell => {
          cells.push(cell.innerHTML);
        });
        if (cells.length > 0 && cells.length <= tableHeaders.length) {
          const cellTexts = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
          const isPlaceholderRow = cellTexts.every(t => t === '...' || t === '…' || t === '');
          if (isPlaceholderRow) return;

          while (cells.length < tableHeaders.length) {
            cells.push('<span style="color:#94a3b8;">—</span>');
          }
          const taskNameCell = row.querySelector('td:first-child');
          const taskName = taskNameCell ? taskNameCell.innerText.trim() : '';
          const allCellTexts = cellTexts.join('|');
          
          if (!seenRowKeys.has(allCellTexts)) {
            seenRowKeys.add(allCellTexts);
            const taskKey = `row_${globalRowIndex}_${allCellTexts.substring(0, 80)}`;
            tableRows.push({ cells, taskName, taskKey });
            globalRowIndex++;
          }
        }
      });
      
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        sections.push({ sectionIdx: tableIdx, headers: tableHeaders, rows: tableRows, groupName });
      }
    });
    
    const blocks = [];
    let allNonTableHtml = '';
    let pendingHtml = '';

    const flushHtml = () => {
      const clean = pendingHtml.replace(/<[^>]*>/g, '').trim();
      if (clean.length > 0) {
        blocks.push({ type: 'html', html: pendingHtml });
        allNonTableHtml += pendingHtml;
      }
      pendingHtml = '';
    };

    const agentResponse = tempDiv.querySelector('.agent-response') || tempDiv;
    const childNodes = Array.from(agentResponse.children);
    let tableInserted = false;

    childNodes.forEach(node => {
      if (node.tagName === 'STYLE') return;
      const cl = node.classList || { contains: () => false };

      const isDataTrustSection = node.id === 'section-data-trust';
      const isTableContent = !isDataTrustSection && (
        cl.contains('comparison-results') ||
        cl.contains('category-section') ||
        (node.querySelector && node.querySelector('table'))
      );

      if (isTableContent) {
        if (!tableInserted && sections.length > 0) {
          flushHtml();
          blocks.push({ type: 'tables' });
          tableInserted = true;
        }
        return;
      }

      if (node.tagName === 'H3') {
        const h3Text = (node.innerText || '').trim().toLowerCase();
        if (h3Text.includes('comparison results') || h3Text.includes('sammenligningsresultater')) return;
      }

      pendingHtml += node.outerHTML;
    });
    flushHtml();

    if (sections.length > 0 && !tableInserted) {
      blocks.push({ type: 'tables' });
    }

    console.log('📊 Setting table sections:', sections.length, 'content blocks:', blocks.length, 'for message:', messageId);
    setTableSections(sections);
    setContentBlocks(blocks);
    
    if (onTableSectionsParsed && sections.length > 0) {
      console.log('📊 Calling onTableSectionsParsed with', sections.length, 'sections for message:', messageId);
      onTableSectionsParsed(messageId, sections, allNonTableHtml.trim() || null, blocks);
    } else {
      console.log('📊 NOT calling onTableSectionsParsed - callback:', !!onTableSectionsParsed, 'sections:', sections.length);
    }
  }, [htmlContent, messageId, onTableSectionsParsed, precomputedData]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const buttons = containerRef.current.querySelectorAll('button');
    buttons.forEach(button => {
      const buttonText = button.textContent || button.innerText || '';
      if (buttonText.toLowerCase().includes('export') && buttonText.toLowerCase().includes('csv')) {
        button.style.cursor = 'pointer';
        button.onclick = (e) => {
          e.preventDefault();
          handleCsvExport(button);
        };
      }
    });
  }, [htmlContent, messageId, tableSections]);

  useEffect(() => {
    if (!containerRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const found = SECTION_DEFINITIONS.filter(s =>
        containerRef.current.querySelector(`[id="${s.id}"]`)
      );
      if (found.length > 0 && onNavReady) {
        onNavReady(messageId, found, containerRef.current);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [contentBlocks, messageId, onNavReady]);

  const handleCopyTable = async () => {
    if (!containerRef.current) return;
    
    const textToCopy = extractTableOnlyFromHtml(containerRef.current);
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setTableCopied(true);
        setTimeout(() => setTableCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy table:', err);
      }
    }
  };
  
  const handleCopySummary = async () => {
    if (!summaryText) return;
    
    try {
      await navigator.clipboard.writeText(summaryText);
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };
  
  const hasTable = htmlContent && htmlContent.includes('<table');
  const commentsHeader = language === 'da' ? 'KOMMENTARER' : 'COMMENTS';
  const resultsLabel = language === 'da' ? 'Resultater' : 'Results';
  const tasksLabel = language === 'da' ? 'opgaver' : 'tasks';
  const totalEntriesLabel = language === 'da' ? 'I alt:' : 'Total:';
  const entriesLabel = language === 'da' ? 'poster' : 'entries';
  const exportLabel = language === 'da' ? 'Eksporter til CSV' : 'Export to CSV';
  const pdfLabel = language === 'da' ? 'Download PDF' : 'Download PDF';
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const handleExportCsv = (section) => {
    if (!section || !section.rows || section.rows.length === 0) return;
    
    const headers = [...section.headers, commentsHeader];
    const csvRows = [headers.join(',')];
    
    section.rows.forEach(row => {
      const cellTexts = row.cells.map(cellHtml => {
        const temp = document.createElement('div');
        temp.innerHTML = cellHtml;
        return `"${(temp.innerText || '').replace(/"/g, '""').trim()}"`;
      });
      const annotation = annotations[row.taskKey]?.[0]?.comment || '';
      cellTexts.push(`"${annotation.replace(/"/g, '""')}"`);
      csvRows.push(cellTexts.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const isValidDbMessageId = typeof messageId === 'number' || (typeof messageId === 'string' && /^\d+$/.test(messageId));
  
  const handleExportPdf = async () => {
    if (isGeneratingPdf || !sessionId || !messageId || !isValidDbMessageId) {
      console.log('📄 Cannot generate PDF: isGenerating=', isGeneratingPdf, 'sessionId=', sessionId, 'messageId=', messageId, 'isValidDbId=', isValidDbMessageId);
      return;
    }
    
    setIsGeneratingPdf(true);
    try {
      console.log('📄 Calling server-side PDF generation for session:', sessionId, 'message:', messageId);
      await chatService.downloadMessagePdf(sessionId, messageId, language);
      console.log('📄 Message PDF download completed successfully');
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert(language === 'da' 
        ? 'Der opstod en fejl ved generering af PDF. Prøv igen.'
        : 'Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  
  // Group configuration for different task categories
  const groupConfig = {
    'Removed': { 
      color: 'bg-red-500', 
      bgColor: 'bg-red-50', 
      borderColor: 'border-red-200',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      labelEn: 'Removed Tasks',
      labelDa: 'Fjernede opgaver'
    },
    'Added': { 
      color: 'bg-green-500', 
      bgColor: 'bg-green-50', 
      borderColor: 'border-green-200',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      labelEn: 'Added Tasks',
      labelDa: 'Tilføjede opgaver'
    },
    'Later': { 
      color: 'bg-amber-500', 
      bgColor: 'bg-amber-50', 
      borderColor: 'border-amber-200',
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      labelEn: 'Delayed Tasks',
      labelDa: 'Forsinkede opgaver'
    },
    'Earlier': { 
      color: 'bg-emerald-500', 
      bgColor: 'bg-emerald-50', 
      borderColor: 'border-emerald-200',
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      labelEn: 'Accelerated Tasks',
      labelDa: 'Fremskyndede opgaver'
    },
    'Modified': { 
      color: 'bg-blue-500', 
      bgColor: 'bg-blue-50', 
      borderColor: 'border-blue-200',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      labelEn: 'Modified Tasks',
      labelDa: 'Ændrede opgaver'
    },
    'Other': { 
      color: 'bg-gray-500', 
      bgColor: 'bg-gray-50', 
      borderColor: 'border-gray-200',
      icon: (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      labelEn: 'Other Tasks',
      labelDa: 'Andre opgaver'
    }
  };

  // Function to extract difference value from row
  const extractDifferenceValue = (row, headers) => {
    const classifyText = (text) => {
      const t = text.toLowerCase();
      if (t.includes('removed') || t.includes('fjernet') || t.includes('not in new') || t.includes('ikke i ny')) return 'Removed';
      if (t.includes('added') || t.includes('tilføjet') || t.includes('not in old') || t.includes('ikke i gammel') || t.includes('not present in old')) return 'Added';
      if (t.includes('later') || t.includes('senere') || t.includes('delayed') || t.includes('forsinket')) return 'Later';
      if (t.includes('earlier') || t.includes('tidligere') || t.includes('accelerated') || t.includes('fremskyndet')) return 'Earlier';
      if (t.includes('modified') || t.includes('ændret') || t.includes('changed') || t.includes('scope') || t.includes('duration change')) return 'Modified';
      return null;
    };

    const diffIndex = headers.findIndex(h => {
      const hl = h.toLowerCase();
      return hl.includes('difference') || hl.includes('forskel') || hl.includes('diff') ||
             hl.includes('change type') || hl.includes('risk if intentional') || hl.includes('ændringstype');
    });
    
    if (diffIndex !== -1 && row.cells[diffIndex]) {
      const temp = document.createElement('div');
      temp.innerHTML = row.cells[diffIndex];
      const result = classifyText(temp.innerText.trim());
      if (result) return result;
    }

    for (let i = 0; i < row.cells.length; i++) {
      if (i === diffIndex) continue;
      const temp = document.createElement('div');
      temp.innerHTML = row.cells[i];
      const cellText = temp.innerText.trim();
      const result = classifyText(cellText);
      if (result) return result;
    }
    
    return 'Other';
  };

  // Function to group rows by difference
  const groupRowsByDifference = (rows, headers) => {
    const groups = {};
    const groupOrder = ['Removed', 'Added', 'Later', 'Earlier', 'Modified', 'Other'];
    
    rows.forEach(row => {
      const diffValue = extractDifferenceValue(row, headers);
      if (!groups[diffValue]) {
        groups[diffValue] = [];
      }
      groups[diffValue].push(row);
    });
    
    // Return groups in order, only include non-empty groups
    return groupOrder
      .filter(key => groups[key] && groups[key].length > 0)
      .map(key => ({ groupName: key, rows: groups[key] }));
  };

  const renderGroupedTable = (groupName, rows, headers, sectionIdx) => {
    const config = groupConfig[groupName] || groupConfig['Other'];
    const groupLabel = language === 'da' ? config.labelDa : config.labelEn;
    
    return (
      <div key={`${sectionIdx}-${groupName}`} className={`mb-6 rounded-xl border ${config.borderColor} overflow-hidden`}>
        <div className={`${config.bgColor} px-4 py-3 flex items-center gap-3 border-b ${config.borderColor}`}>
          <div className={`w-8 h-8 ${config.bgColor} rounded-lg flex items-center justify-center`}>
            {config.icon}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#1c2631]">{groupLabel}</span>
            <span className={`px-2 py-0.5 ${config.color} text-white text-xs font-semibold rounded-full`}>
              {rows.length}
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm bg-white">
            <thead>
              <tr className="bg-[#2d3b47] text-white">
                {headers.map((header, hIdx) => (
                  <th key={hIdx} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                    {header}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                  {commentsHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const taskAnnotations = annotations[row.taskKey] || [];
                const isExpanded = expandedRows[row.taskKey];
                
                return (
                  <React.Fragment key={rIdx}>
                    <tr 
                      data-task-key={row.taskKey}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 ${rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      {row.cells.map((cellHtml, cIdx) => (
                        <td key={cIdx} className="px-3 py-2.5" dangerouslySetInnerHTML={{ __html: cellHtml }} />
                      ))}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleRowExpand(row.taskKey)}
                          className="flex items-center gap-1 text-[#00D6D6] hover:text-[#00B8B8] text-xs font-medium transition-colors"
                        >
                          {taskAnnotations.length > 0 ? (
                            <>
                              <span className="w-4 h-4 bg-[#00D6D6] text-white rounded-full flex items-center justify-center text-[10px]">
                                {taskAnnotations.length}
                              </span>
                              <span>{language === 'da' ? 'Vis' : 'View'}</span>
                            </>
                          ) : (
                            <>
                              <span>+</span>
                              <span>{language === 'da' ? 'Tilføj kommentar' : 'Add comment'}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#00D6D6]/5">
                        <td colSpan={row.cells.length + 1} className="px-4 py-3">
                          <div className="space-y-2">
                            {taskAnnotations.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {taskAnnotations.map((ann, annIdx) => {
                                  const isOwner = user?.email === ann.authorEmail;
                                  const isEditing = editingAnnotation?.id === ann.id;
                                  
                                  return (
                                    <div key={annIdx} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                      {isEditing ? (
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {ANNOTATION_TAGS.map(tag => (
                                              <button
                                                key={tag.id}
                                                onClick={() => {
                                                  const newTags = editingAnnotation.tags.includes(tag.id)
                                                    ? editingAnnotation.tags.filter(t => t !== tag.id)
                                                    : [...editingAnnotation.tags, tag.id];
                                                  setEditingAnnotation(prev => ({ ...prev, tags: newTags }));
                                                }}
                                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                                  editingAnnotation.tags.includes(tag.id)
                                                    ? 'bg-[#00D6D6] text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                              >
                                                {language === 'da' ? tag.label : tag.labelEn}
                                              </button>
                                            ))}
                                          </div>
                                          <textarea
                                            value={editingAnnotation.text}
                                            onChange={(e) => setEditingAnnotation(prev => ({ ...prev, text: e.target.value }))}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D6D6]"
                                            rows={2}
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={async () => {
                                                if (!editingAnnotation.text.trim()) return;
                                                try {
                                                  await onAnnotationUpdate(ann.id, editingAnnotation.text, editingAnnotation.tags);
                                                  setEditingAnnotation(null);
                                                } catch (err) {
                                                  console.error('Failed to update:', err);
                                                }
                                              }}
                                              className="px-3 py-1 bg-[#00D6D6] text-white text-xs font-medium rounded-lg"
                                            >
                                              {language === 'da' ? 'Gem' : 'Save'}
                                            </button>
                                            <button
                                              onClick={() => setEditingAnnotation(null)}
                                              className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg"
                                            >
                                              {language === 'da' ? 'Annuller' : 'Cancel'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex items-start justify-between">
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              {ann.tags?.map(tagId => {
                                                const tag = ANNOTATION_TAGS.find(t => t.id === tagId);
                                                return tag ? (
                                                  <span key={tagId} className="inline-block px-2 py-0.5 bg-[#00D6D6]/20 text-[#00D6D6] rounded text-[10px] font-medium">
                                                    {language === 'da' ? tag.label : tag.labelEn}
                                                  </span>
                                                ) : null;
                                              })}
                                            </div>
                                            {isOwner && (
                                              <button
                                                onClick={() => setEditingAnnotation({ id: ann.id, text: ann.text, tags: ann.tags || [] })}
                                                className="text-gray-400 hover:text-[#00D6D6] transition-colors p-1"
                                              >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                          <p className="text-sm text-gray-800">{ann.text}</p>
                                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                            {ann.authorName && <span>— {ann.authorName}</span>}
                                            {ann.createdAt && (
                                              <span>{new Date(ann.createdAt).toLocaleDateString(language === 'da' ? 'da-DK' : 'en-US')}</span>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            <AnnotationInput
                              taskKey={row.taskKey}
                              taskName={row.taskName}
                              existingAnnotations={[]}
                              onSave={async (taskKey, taskName, text, tags) => {
                                await onAnnotationSave(taskKey, taskName, text, tags);
                              }}
                              language={language}
                              sessionId={sessionId}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const replaceHeartEmojis = (html) => html
    .replace(/💛/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/💚/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/❤️/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/🧡/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/💜/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/🩷/g, PROFESSIONAL_HEALTH_ICON)
    .replace(/❤/g, PROFESSIONAL_HEALTH_ICON);

  const HTML_FILTER_CATEGORIES = [
    { key: 'all', labelEn: 'All', labelDa: 'Alle' },
    { key: 'Added', labelEn: 'Added', labelDa: 'Tilføjet' },
    { key: 'Removed', labelEn: 'Removed', labelDa: 'Fjernet' },
    { key: 'Later', labelEn: 'Delayed', labelDa: 'Forsinket' },
    { key: 'Modified', labelEn: 'Moved', labelDa: 'Flyttet' },
  ];

  const allGroupedData = useMemo(() => {
    const resolveGroupName = (name) => {
      if (!name) return 'Other';
      const lower = name.toLowerCase();
      if (lower.includes('removed') || lower.includes('fjernet')) return 'Removed';
      if (lower.includes('added') || lower.includes('tilføj')) return 'Added';
      if (lower.includes('later') || lower.includes('delayed') || lower.includes('forsink') || lower.includes('senere')) return 'Later';
      if (lower.includes('earlier') || lower.includes('accelerat') || lower.includes('fremskynde') || lower.includes('tidligere')) return 'Earlier';
      if (lower.includes('modified') || lower.includes('ændre') || lower.includes('changed')) return 'Modified';
      return 'Other';
    };
    return tableSections.map(section => {
      const sectionGroupName = section.groupName ? resolveGroupName(section.groupName) : null;
      return sectionGroupName
        ? [{ groupName: sectionGroupName, rows: section.rows }]
        : groupRowsByDifference(section.rows, section.headers);
    });
  }, [tableSections]);

  const groupCounts = useMemo(() => {
    const counts = { all: 0 };
    allGroupedData.forEach(gd => {
      gd.forEach(g => {
        counts[g.groupName] = (counts[g.groupName] || 0) + g.rows.length;
        counts.all += g.rows.length;
      });
    });
    return counts;
  }, [allGroupedData]);

  const renderTableBlock = () => {
    if (tableSections.length === 0) return null;
    const firstSection = tableSections[0];
    const totalTasks = tableSections.reduce((sum, s) => sum + s.rows.length, 0);

    return (
      <div id="section-comparison" className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00D6D6]/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#1c2631]">{resultsLabel}</span>
              <span className="text-sm text-gray-500">{totalTasks} {tasksLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isGeneratingPdf || !isValidDbMessageId}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d3b47] hover:bg-[#1c2631] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isValidDbMessageId ? (language === 'da' ? 'PDF er tilgængelig efter besked er gemt' : 'PDF available after message is saved') : pdfLabel}
            >
              {isGeneratingPdf ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              {pdfLabel}
            </button>
            <button
              onClick={() => handleExportCsv(firstSection)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00D6D6] hover:bg-[#00C4C4] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exportLabel}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          {HTML_FILTER_CATEGORIES.map(({ key, labelEn, labelDa }) => {
            const count = groupCounts[key] ?? 0;
            const isActive = activeFilter === key;
            const isEmpty = key !== 'all' && count === 0;
            return (
              <button
                key={key}
                onClick={() => !isEmpty && setActiveFilter(key)}
                disabled={isEmpty}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#00D6D6] text-white shadow-md'
                    : isEmpty
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#00D6D6] hover:text-[#00D6D6] hover:bg-[#00D6D6]/5'
                }`}
              >
                <span>{language === 'da' ? labelDa : labelEn}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/25 text-white' : isEmpty ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {tableSections.map((section, idx) => {
          const groupedData = activeFilter === 'all'
            ? allGroupedData[idx] || []
            : (allGroupedData[idx] || []).filter(g => g.groupName === activeFilter);
          return groupedData.map(group => renderGroupedTable(group.groupName, group.rows, section.headers, idx));
        })}

        <div className="flex items-center justify-between mt-2 px-1 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>{totalEntriesLabel} {totalTasks} {entriesLabel}</span>
          </div>
          <span className="text-xs text-gray-400">Last updated: {new Date().toLocaleDateString(language === 'da' ? 'da-DK' : 'en-US', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}</span>
        </div>
      </div>
    );
  };
  
  const renderContentBlocks = () => {
    return (
      <div className="space-y-6">
        {contentBlocks.map((block, blockIdx) => {
          if (block.type === 'tables') {
            return <React.Fragment key={`block-tables-${blockIdx}`}>{renderTableBlock()}</React.Fragment>;
          }
          const cleaned = block.html.replace(/^[\s\n]*<br\s*\/?>/gi, '').trim();
          if (!cleaned) return null;
          return (
            <div 
              key={`block-html-${blockIdx}`}
              className="html-content-container w-full overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: replaceHeartEmojis(cleaned) }}
            />
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="relative">
      {contentBlocks.length > 0 ? (
        <div ref={containerRef}>
          {renderContentBlocks()}
        </div>
      ) : (
        <div 
          ref={containerRef}
          className="html-content-container w-full overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: replaceHeartEmojis(htmlContent) }}
        />
      )}
      <div className="flex justify-end gap-2 mt-3">
        {hasTable && (
          <button
            onClick={handleCopyTable}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              tableCopied 
                ? 'bg-green-500 text-white' 
                : 'bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20 border border-[#00D6D6]/30'
            }`}
            title={tableCopied ? (language === 'da' ? 'Kopieret!' : 'Copied!') : (language === 'da' ? 'Kopier tabeldata' : 'Copy table data')}
          >
            {tableCopied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{language === 'da' ? 'Tabel kopieret' : 'Table copied'}</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>{language === 'da' ? 'Kopier tabel' : 'Copy table'}</span>
              </>
            )}
          </button>
        )}
        {hasSummary && (
          <button
            onClick={handleCopySummary}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              summaryCopied 
                ? 'bg-green-500 text-white' 
                : 'bg-white text-[#1c2631] hover:bg-gray-50 border border-gray-300'
            }`}
            title={summaryCopied ? (language === 'da' ? 'Kopieret!' : 'Copied!') : (language === 'da' ? 'Kopier sammenfatning' : 'Copy summary')}
          >
            {summaryCopied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{language === 'da' ? 'Sammenfatning kopieret' : 'Summary copied'}</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{language === 'da' ? 'Kopier sammenfatning' : 'Copy summary'}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.htmlContent !== nextProps.htmlContent) return false;
  if (prevProps.messageId !== nextProps.messageId) return false;
  if (prevProps.language !== nextProps.language) return false;
  if (prevProps.sessionId !== nextProps.sessionId) return false;
  if (prevProps.annotations !== nextProps.annotations) return false;
  if (prevProps.onTableSectionsParsed !== nextProps.onTableSectionsParsed) return false;
  if (prevProps.precomputedData !== nextProps.precomputedData) return false;
  return true;
});

HtmlMessageContent.displayName = 'HtmlMessageContent';

// =================================================================
// GERMAN TIMEZONE GREETING FUNCTION
// =================================================================
const getGermanTimezoneGreeting = (t) => {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const hour = germanTime.getHours();
  
  if (hour >= 5 && hour < 12) {
    return t('chat.greetingMorning');
  } else if (hour >= 12 && hour < 18) {
    return t('chat.greetingAfternoon');
  } else {
    return t('chat.greetingEvening');
  }
};

// =================================================================
// MEMOIZED MESSAGE ITEM COMPONENT (prevents blinking on input change)
// =================================================================
const MessageItem = memo(({ msg, isMinimized, isMobile, t, language = 'en', sessionId, annotations = {}, onAnnotationSave, onAnnotationUpdate, user, sessionTitle, uploadedFileNames, onTableSectionsParsed, onNavReady, precomputedData = null, precomputedDataPredictive = null }) => {
  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  const parsedSummary = msg.type !== 'user' && msg.text ? parseSummaryFromResponse(msg.text) : null;
  const displayText = parsedSummary ? extractResponseWithoutSummary(msg.text) : msg.text;

  const handleCopy = async () => {
    let textToCopy = '';
    
    if (msg.isHtml && msg.htmlContent) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = msg.htmlContent;
      
      const styleTags = tempDiv.querySelectorAll('style');
      styleTags.forEach(tag => tag.remove());
      
      const tables = tempDiv.querySelectorAll('table');
      if (tables.length > 0) {
        const formattedParts = [];
        
        tables.forEach((table) => {
          const rows = table.querySelectorAll('tr');
          const tableRows = [];
          
          rows.forEach((row) => {
            const cells = row.querySelectorAll('th, td');
            const cellTexts = [];
            cells.forEach((cell) => {
              let cellText = cell.innerText.trim().replace(/\s+/g, ' ');
              cellTexts.push(cellText);
            });
            if (cellTexts.length > 0) {
              tableRows.push(cellTexts.join('\t'));
            }
          });
          
          if (tableRows.length > 0) {
            formattedParts.push(tableRows.join('\n'));
          }
        });
        
        textToCopy = formattedParts.join('\n\n');
      } else {
        textToCopy = tempDiv.innerText || tempDiv.textContent || '';
      }
    } else if (msg.text) {
      textToCopy = displayText || msg.text;
    }
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleCopySummary = async () => {
    if (!parsedSummary) return;
    
    let summaryText = '';
    const langPrefix = language === 'da' ? 'Sammenfatning af ændringer' : 'Summary of Changes';
    summaryText += `• ${langPrefix} (Version A → Version B)\n\n`;
    
    if (parsedSummary.overview && parsedSummary.overview.length > 0) {
      summaryText += language === 'da' ? 'Overblik:\n' : 'Overview:\n';
      parsedSummary.overview.forEach(item => {
        summaryText += `  ${item}\n`;
      });
      summaryText += '\n';
    }
    
    if (parsedSummary.topImpacts && parsedSummary.topImpacts.length > 0) {
      summaryText += language === 'da' ? 'Vigtigste påvirkninger:\n' : 'Top Impacts:\n';
      parsedSummary.topImpacts.forEach(item => {
        summaryText += `  ${item}\n`;
      });
      summaryText += '\n';
    }
    
    if (parsedSummary.dateShifts && parsedSummary.dateShifts.length > 0) {
      summaryText += language === 'da' ? 'Datoændringer:\n' : 'Date Shifts:\n';
      parsedSummary.dateShifts.forEach(item => {
        summaryText += `  ${item}\n`;
      });
      summaryText += '\n';
    }
    
    if (parsedSummary.durationChanges && parsedSummary.durationChanges.length > 0) {
      summaryText += language === 'da' ? 'Varighedsændringer:\n' : 'Duration Changes:\n';
      parsedSummary.durationChanges.forEach(item => {
        summaryText += `  ${item}\n`;
      });
    }
    
    if (parsedSummary.rawBullets && parsedSummary.rawBullets.length > 0 && !parsedSummary.overview?.length) {
      parsedSummary.rawBullets.forEach(item => {
        summaryText += `  ${item}\n`;
      });
    }
    
    if (summaryText.trim()) {
      try {
        await navigator.clipboard.writeText(summaryText.trim());
        setSummaryCopied(true);
        setTimeout(() => setSummaryCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy summary:', err);
      }
    }
  };

  // Special rendering for file-info message type
  if (msg.type === "file-info") {
    return (
      <div className="flex w-full justify-center animate-message-in my-2">
        <div className="w-full max-w-[95%] p-4 rounded-xl bg-gradient-to-r from-[#00D6D6]/10 to-[#00D6D6]/5 border-2 border-[#00D6D6]/40 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#00D6D6] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[#00D6D6] font-bold text-lg">{t('chat.filesUploadedTitle')}</span>
          </div>
          <div className="space-y-2 ml-10">
            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2 border border-[#00D6D6]/20">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                <span className="text-xs text-slate-500 font-medium">{t('chat.oldSchedule')}:</span>
                <p className="text-slate-700 font-semibold text-sm truncate">{msg.oldFileName || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2 border border-[#00D6D6]/20">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                <span className="text-xs text-slate-500 font-medium">{t('chat.newSchedule')}:</span>
                <p className="text-slate-700 font-semibold text-sm truncate">{msg.newFileName || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showCopyButton = !msg.isInitial && !msg.isTable && (msg.text || msg.htmlContent);

  return (
    <div
      className={`flex w-full animate-message-in ${msg.type === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className={`relative group ${msg.type === "user" ? "max-w-[75%]" : "max-w-[95%]"}`}>
        <div
          className={`p-4 rounded-2xl shadow-lg border transition-all duration-300 leading-relaxed ${isMinimized && !isMobile ? "text-sm" : "text-base"} ${
            msg.type === "user"
              ? "text-white border-[#00D6D6]/50"
              : msg.isError
                ? "bg-red-500/10 text-red-700 border-red-400/40"
                : msg.isSuccess
                  ? "bg-[#29dd6b]/10 text-green-700 border-[#29dd6b]/40"
                  : "text-slate-600 border-[#00D6D6]/20"
          }`}
          style={
            msg.type === "user"
              ? { background: "#00D6D6" }
              : { background: "#ffffff" }
          }
        >
          {msg.isComparison ? (
            <ComparisonRenderer 
              content={msg.comparisonContent}
              onAddComment={(taskId, comment) => {
                if (onAnnotationSave) onAnnotationSave(taskId, comment);
              }}
            />
          ) : msg.isHtml ? (
            <HtmlMessageContent 
              htmlContent={msg.htmlContent} 
              messageId={msg.dbId || msg.id} 
              language={language} 
              sessionId={sessionId}
              annotations={annotations}
              onAnnotationSave={onAnnotationSave}
              onAnnotationUpdate={onAnnotationUpdate}
              user={user}
              sessionTitle={sessionTitle}
              uploadedFileNames={uploadedFileNames}
              onTableSectionsParsed={onTableSectionsParsed}
              onNavReady={onNavReady}
              precomputedData={precomputedData}
            />
          ) : msg.isInitial ? (
            <div className="markdown-content">
              <p>
                {t('chat.welcomeGreeting')}{" "}
                <span style={{ color: "#00D6D6", fontWeight: "600" }}>
                  Nova
                </span>
                . {t('chat.welcomeDescription')}
              </p>
              <p>
                <strong>📁 {t('chat.uploadInfoTitle')}</strong>
              </p>
              <ul>
                <li>
                  {t('chat.uploadInfoLine1')} <strong>{t('chat.uploadInfoOneFile')}</strong>
                </li>
                <li>{t('chat.uploadInfoLine2')}</li>
                <li>{t('chat.uploadInfoLine3')}</li>
                <li>{t('chat.uploadInfoLine4')}</li>
              </ul>
              <p>{t('chat.howCanIHelp')}</p>
            </div>
          ) : msg.type === "user" ? (
            <div className="whitespace-pre-wrap break-words">
              {msg.text}
            </div>
          ) : (
            <div className="space-y-4">
              {parsedSummary && (parsedSummary.overview?.length > 0 || parsedSummary.topImpacts?.length > 0 || parsedSummary.rawBullets?.length > 0) && (
                <div className="relative bg-gradient-to-br from-[#00D6D6]/5 to-[#00D6D6]/10 rounded-xl p-4 border border-[#00D6D6]/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00D6D6]"></div>
                      <h4 className="font-semibold text-[#1c2631] text-sm">
                        {language === 'da' ? 'Sammenfatning af ændringer' : 'Summary of Changes'} (Version A → Version B)
                      </h4>
                    </div>
                    <button
                      onClick={handleCopySummary}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                        summaryCopied 
                          ? 'bg-green-500 text-white' 
                          : 'bg-white/80 text-[#00D6D6] hover:bg-white border border-[#00D6D6]/30'
                      }`}
                      title={summaryCopied ? t('common.success') : (language === 'da' ? 'Kopier sammenfatning' : 'Copy summary')}
                    >
                      {summaryCopied ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{language === 'da' ? 'Kopieret' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{language === 'da' ? 'Kopier' : 'Copy'}</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-sm text-slate-700">
                    {parsedSummary.overview && parsedSummary.overview.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800 mb-1">{language === 'da' ? 'Overblik:' : 'Overview:'}</p>
                        <ul className="list-none space-y-0.5 ml-2">
                          {parsedSummary.overview.map((item, idx) => (
                            <li key={idx} className="text-slate-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {parsedSummary.topImpacts && parsedSummary.topImpacts.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800 mb-1">{language === 'da' ? 'Vigtigste påvirkninger:' : 'Top Impacts:'}</p>
                        <ul className="list-none space-y-0.5 ml-2">
                          {parsedSummary.topImpacts.map((item, idx) => (
                            <li key={idx} className="text-slate-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {parsedSummary.dateShifts && parsedSummary.dateShifts.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800 mb-1">{language === 'da' ? 'Datoændringer:' : 'Date Shifts:'}</p>
                        <ul className="list-none space-y-0.5 ml-2">
                          {parsedSummary.dateShifts.map((item, idx) => (
                            <li key={idx} className="text-slate-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {parsedSummary.durationChanges && parsedSummary.durationChanges.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800 mb-1">{language === 'da' ? 'Varighedsændringer:' : 'Duration Changes:'}</p>
                        <ul className="list-none space-y-0.5 ml-2">
                          {parsedSummary.durationChanges.map((item, idx) => (
                            <li key={idx} className="text-slate-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {parsedSummary.rawBullets && parsedSummary.rawBullets.length > 0 && !parsedSummary.overview?.length && (
                      <ul className="list-none space-y-0.5 ml-2">
                        {parsedSummary.rawBullets.map((item, idx) => (
                          <li key={idx} className="text-slate-600">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              
              {displayText && displayText.trim() && (
                <div className="markdown-content">
                  <ReactMarkdown>{formatBotText(displayText)}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {msg.predictiveInsights && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#00D6D6]" />
                <span className="text-sm font-bold text-[#1c2631]">
                  {language === 'da' ? 'Nova Predictive Analysis' : 'Nova Predictive Analysis'}
                </span>
              </div>
              <HtmlMessageContent
                htmlContent={msg.predictiveInsights}
                messageId={`${msg.dbId || msg.id}-predictive`}
                language={language}
                sessionId={sessionId}
                annotations={annotations}
                onAnnotationSave={onAnnotationSave}
                onAnnotationUpdate={onAnnotationUpdate}
                user={user}
                sessionTitle={sessionTitle}
                uploadedFileNames={uploadedFileNames}
                onTableSectionsParsed={onTableSectionsParsed}
                onNavReady={onNavReady}
                precomputedData={precomputedDataPredictive}
              />
            </div>
          )}
        </div>
        
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className={`absolute -bottom-2 ${msg.type === "user" ? "right-2" : "left-2"} opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg ${
              copied 
                ? 'bg-green-500 text-white' 
                : msg.type === "user" 
                  ? 'bg-white/90 text-[#00D6D6] hover:bg-white' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            } shadow-md`}
            title={copied ? t('common.success') : t('chat.copyMessage')}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.msg !== nextProps.msg) return false;
  if (prevProps.isMinimized !== nextProps.isMinimized) return false;
  if (prevProps.isMobile !== nextProps.isMobile) return false;
  if (prevProps.language !== nextProps.language) return false;
  if (prevProps.sessionId !== nextProps.sessionId) return false;
  if (prevProps.annotations !== nextProps.annotations) return false;
  return true;
});

MessageItem.displayName = 'MessageItem';

// =================================================================
// HELPER FUNCTIONS (Cleaned up and kept for fallback logic)
// =================================================================

/**
 * Extracts introductory text that might appear before a Markdown table in OpenAI's response.
 * @param {string} markdownText - The full response from OpenAI.
 * @returns {{intro: string}} - An object containing the introductory text.
 */
const extractContentAboveTable = (markdownText) => {
  if (!markdownText) return { intro: "" };
  const tableStartIndex = markdownText.indexOf("| ID |");
  if (tableStartIndex !== -1) {
    let introText = markdownText.substring(0, tableStartIndex).trim();
    introText = introText.replace(/## 📊 Task Analysis Overview/g, "").trim();
    return { intro: introText };
  }
  return { intro: markdownText };
};

/**
 * A scoring-based function to determine if a text response likely contains task data
 * and should be formatted, used as a fallback if direct parsing fails.
 * @param {string} text - The API response text.
 * @returns {boolean} - True if the text likely contains data.
 */
const isFileDataResponse = (text) => {
  // This complex function is kept as a fallback for non-structured API responses.
  // The primary logic will now bypass this for the new API format.
  if (!text) return false;
  const lowerCaseText = text.toLowerCase();

  const isUserChoicePrompt =
    /please tell me which files|choose|option [a-d]|let me know your choice/i.test(
      lowerCaseText,
    );
  if (isUserChoicePrompt) return false;

  if (lowerCaseText.includes("|") && lowerCaseText.includes("---")) return true;

  const hasTaskKeywords =
    /task|opgave|entydigit|ansvarlig|montage|installation/i.test(lowerCaseText);
  const hasDateKeywords = /date|dato|duration|dage/i.test(lowerCaseText);
  const hasComparisonKeywords =
    /added|removed|modified|tilføjede|fjernede|modificerede/i.test(
      lowerCaseText,
    );

  return hasTaskKeywords && (hasDateKeywords || hasComparisonKeywords);
};

/**
 * Parses a Markdown table into a structured array of task objects.
 * This is used only after getting a formatted response from OpenAI.
 * @param {string} markdownText - The Markdown string containing the table.
 * @returns {Array} - An array of task objects.
 */
const parseUnifiedTableFromMarkdown = (markdownText) => {
  if (!markdownText || !markdownText.includes("|")) return [];
  const lines = markdownText
    .split("\n")
    .filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split("|")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  // Use flexible headers to match the new OpenAI prompt
  const getIndex = (keys) => {
    for (const key of keys) {
      const index = headers.indexOf(key);
      if (index !== -1) return index;
    }
    return -1;
  };

  const idIndex = getIndex(["id"]);
  const nameIndex = getIndex(["task name"]);
  const statusIndex = getIndex(["status"]);
  const start1Index = getIndex(["file 1 start date", "2023 start date"]);
  const end1Index = getIndex(["file 1 end date", "2023 end date"]);
  const duration1Index = getIndex(["file 1 duration", "2023 duration"]);
  const start2Index = getIndex(["file 2 start date", "2024 start date"]);
  const end2Index = getIndex(["file 2 end date", "2024 end date"]);
  const duration2Index = getIndex(["file 2 duration", "2024 duration"]);
  const filenameIndex = getIndex(["filename"]);

  if (idIndex === -1 || nameIndex === -1) return [];

  return lines
    .slice(2)
    .map((rowLine) => {
      const cells = rowLine
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length >= headers.length) {
        return {
          id: cells[idIndex] || "N/A",
          taskName: cells[nameIndex] || "N/A",
          status: statusIndex !== -1 ? cells[statusIndex] : "N/A",
          startDate2023: start1Index !== -1 ? cells[start1Index] : "N/A",
          endDate2023: end1Index !== -1 ? cells[end1Index] : "N/A",
          duration2023: duration1Index !== -1 ? cells[duration1Index] : "N/A",
          startDate2024: start2Index !== -1 ? cells[start2Index] : "N/A",
          endDate2024: end2Index !== -1 ? cells[end2Index] : "N/A",
          duration2024: duration2Index !== -1 ? cells[duration2Index] : "N/A",
          filename: filenameIndex !== -1 ? cells[filenameIndex] : "N/A",
        };
      }
      return null;
    })
    .filter(Boolean);
};

const ChatWidget = ({
  sessionId,
  user,
  onEndSession,
  pendingUploadResult,
  onUploadResultProcessed,
  getSessionFileCount,
  shouldAutoOpen = false,
  tableSessionIds = {},
  onFilesUploaded,
  onSessionChange,
  isFullPage = false,
}) => {
  const { t, i18n } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [statusText, setStatusText] = useState(t('chat.readyToCompare'));
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [currentActiveFile, setCurrentActiveFile] = useState(null);
  const [isFileProcessing, setIsFileProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [uploadedFileNames, setUploadedFileNames] = useState({ old: null, new: null });
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const isManualSessionSwitchRef = React.useRef(false);
  const currentTargetSessionIdRef = React.useRef(null);
  const fetchAbortControllerRef = React.useRef(null);
  const msgDbIdRef = useRef({});
  const [updatedSessionInfo, setUpdatedSessionInfo] = useState(null);
  const [sidebarForceUpdateKey, setSidebarForceUpdateKey] = useState(0);
  const [annotations, setAnnotations] = useState({});
  const [isGeneratingFullPdf, setIsGeneratingFullPdf] = useState(false);
  const [showPdfConfirmModal, setShowPdfConfirmModal] = useState(false);
  const [collectedTableSections, setCollectedTableSections] = useState({});  // Collected from HtmlMessageContent components

  // NOTE: The state setters `setAddedTasks`, `setRemovedTasks`, `setModifiedTasks`, `setAllTasks`
  // are assumed to be managed by a parent component or a context, as they are not defined here.
  // For this snippet, we'll just log their intended usage.
  const setAddedTasks = (tasks) =>
    console.log("Simulating setAddedTasks:", tasks);
  const setRemovedTasks = (tasks) =>
    console.log("Simulating setRemovedTasks:", tasks);
  const setModifiedTasks = (tasks) =>
    console.log("Simulating setModifiedTasks:", tasks);
  const setAllTasks = (tasks) => console.log("Simulating setAllTasks:", tasks);

  const getInitialMessage = (hasFilesUploaded = false) => {
    const greeting = getGermanTimezoneGreeting(t);
    const uploadPrompt = t('chat.uploadFilesPrompt');
    
    return {
      id: `msg-initial-${Date.now()}`,
      type: "bot",
      text: hasFilesUploaded 
        ? `${greeting}\n\n${t('chat.filesUploadedMessage')}`
        : `${greeting}\n\n${uploadPrompt}`,
      isInitial: true,
    };
  };

  const [messages, setMessages] = useState(() => {
    if (sessionId) {
      const storageKey = `chatMessages_${sessionId}`;
      const savedMessages = localStorage.getItem(storageKey);
      if (savedMessages) {
        try {
          return JSON.parse(savedMessages);
        } catch (e) {
          console.error("Error parsing saved messages:", e);
        }
      }
    }
    return [getInitialMessage()];
  });
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastMessageRef = useRef(null);

  const [chatNavSections, setChatNavSections] = useState([]);
  const [chatNavActiveId, setChatNavActiveId] = useState(null);
  const chatNavRegistryRef = useRef({});
  const chatNavActiveMessageRef = useRef(null);
  // Persistent cache of parsed HTML → table sections + content blocks, keyed by messageId
  // Never cleared on session switch so revisiting a session is instant
  const parsedContentCache = useRef({});
  // Persistent cache of formatted messages arrays, keyed by sessionId.
  // Populated on first API load and updated when leaving a session.
  // Revisits use this cache directly — zero API call, zero DOMPurify cost.
  const sessionMessagesCache = useRef({});

  const handleNavReady = useCallback((msgId, sections, containerEl) => {
    chatNavRegistryRef.current[msgId] = { sections, containerEl };
    chatNavActiveMessageRef.current = msgId;
    setChatNavSections(sections);
    setChatNavActiveId(sections[0]?.id || null);
  }, []);

  const handleChatNavClick = useCallback((sectionId) => {
    const activeId = chatNavActiveMessageRef.current;
    const entry = chatNavRegistryRef.current[activeId];
    if (!entry) return;
    const el = entry.containerEl?.querySelector(`[id="${sectionId}"]`);
    if (!el) return;
    setChatNavActiveId(sectionId);
    const scrollEl = document.getElementById('chat-scroll-container');
    if (scrollEl) {
      const offset = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top - 8;
      scrollEl.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    chatNavRegistryRef.current = {};
    chatNavActiveMessageRef.current = null;
    setChatNavSections([]);
    setChatNavActiveId(null);
  }, [sessionId]);

  useEffect(() => {
    const scrollEl = document.getElementById('chat-scroll-container');
    if (!scrollEl) return;
    const onScroll = () => {
      const activeId = chatNavActiveMessageRef.current;
      const entry = chatNavRegistryRef.current[activeId];
      if (!entry) return;
      const { sections, containerEl } = entry;
      if (!containerEl) return;
      const containerTop = scrollEl.getBoundingClientRect().top;
      let nextActiveId = sections[0]?.id;
      for (const s of sections) {
        const el = containerEl.querySelector(`[id="${s.id}"]`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop <= 40) nextActiveId = s.id;
      }
      setChatNavActiveId(nextActiveId);
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [chatNavSections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const saveAndTrackMessage = async (msgId, sendSessionId, senderType, content, contentType, isHtml, metadata) => {
    const result = await chatService.saveMessageToDatabase(sendSessionId, senderType, content, contentType, isHtml, metadata);
    if (result && result.success && result.message && result.message.id) {
      const dbId = result.message.id;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, dbId } : m));
      msgDbIdRef.current[msgId] = dbId;
    }
  };

  // Function to save messages to localStorage
  const saveMessagesToStorage = (messagesToSave, sessionId) => {
    if (!sessionId) return;

    try {
      const storageKey = `chatMessages_${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
      console.log(
        "💾 Chat messages saved to localStorage:",
        messagesToSave.length,
        "messages",
      );
    } catch (error) {
      console.error("Error saving chat messages:", error);
    }
  };

  // Function to load messages from localStorage
  const loadMessagesFromStorage = (loadSessionId) => {
    if (!loadSessionId) return [getInitialMessage()];

    try {
      const storageKey = `chatMessages_${loadSessionId}`;
      const savedMessages = localStorage.getItem(storageKey);

      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        console.log(
          "📂 Loaded chat messages from localStorage:",
          parsedMessages.length,
          "messages",
        );
        return parsedMessages;
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }

    return [getInitialMessage()];
  };

  // Function to clear messages from storage
  const clearMessagesFromStorage = (sessionId) => {
    if (!sessionId) return;

    try {
      const storageKey = `chatMessages_${sessionId}`;
      localStorage.removeItem(storageKey);
      console.log(
        "🗑️ Chat messages cleared from localStorage for session:",
        sessionId,
      );
    } catch (error) {
      console.error("Error clearing chat messages:", error);
    }
  };

  // Fetch annotations for the current session
  const fetchAnnotations = useCallback(async (fetchSessionId) => {
    if (!fetchSessionId || !user) return;
    
    try {
      const rawResponse = await getWithAuth(`/api/chat/sessions/${fetchSessionId}/annotations`);
      const response = await rawResponse.json();
      if (response.success && response.annotations) {
        setAnnotations(response.annotations);
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
    }
  }, [user]);

  // Save an annotation for a task
  const handleAnnotationSave = useCallback(async (taskKey, taskName, text, tags) => {
    if (!sessionId || !user) {
      throw new Error('Session or user not available');
    }
    
    try {
      const rawResponse = await postWithAuth(`/api/chat/sessions/${sessionId}/annotations`, {
        taskKey,
        taskName,
        text,
        tags
      });
      
      const response = await rawResponse.json();
      console.log('📝 POST response:', response);
      
      if (response.success && response.annotation) {
        console.log('✅ Annotation saved, fetching updated list...');
        
        try {
          const annotationsRaw = await getWithAuth(`/api/chat/sessions/${sessionId}/annotations`);
          const annotationsResponse = await annotationsRaw.json();
          console.log('📋 Fetched annotations:', annotationsResponse);
          if (annotationsResponse.success && annotationsResponse.annotations) {
            setAnnotations(annotationsResponse.annotations);
          }
        } catch (fetchErr) {
          console.error('Error fetching annotations after save:', fetchErr);
        }
        
        return response.annotation;
      }
    } catch (error) {
      console.error('Error saving annotation:', error);
      throw error;
    }
  }, [sessionId, user]);

  // Update an existing annotation
  const handleAnnotationUpdate = useCallback(async (annotationId, text, tags) => {
    if (!sessionId || !user) {
      throw new Error('Session or user not available');
    }
    
    try {
      const rawResponse = await putWithAuth(`/api/chat/annotations/${annotationId}`, {
        text,
        tags
      });
      
      const response = await rawResponse.json();
      console.log('📝 PUT response:', response);
      
      if (response.success) {
        console.log('✅ Annotation updated, fetching updated list...');
        
        try {
          const annotationsRaw = await getWithAuth(`/api/chat/sessions/${sessionId}/annotations`);
          const annotationsResponse = await annotationsRaw.json();
          if (annotationsResponse.success && annotationsResponse.annotations) {
            setAnnotations(annotationsResponse.annotations);
          }
        } catch (fetchErr) {
          console.error('Error fetching annotations after update:', fetchErr);
        }
        
        return response.annotation;
      } else {
        throw new Error(response.error || 'Failed to update annotation');
      }
    } catch (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
  }, [sessionId, user]);

  // Callback for HtmlMessageContent to report its parsed table sections
  // Also stores the full parsed result in parsedContentCache so revisiting a session is instant
  const handleTableSectionsParsed = useCallback((messageId, sections, summaryHtml, contentBlocks) => {
    console.log('📄 Table sections parsed from message:', messageId, 'sections:', sections.length);
    setCollectedTableSections(prev => ({
      ...prev,
      [messageId]: { sections, summaryHtml }
    }));
    // Cache the expensive parse result — never evicted; keyed by messageId across all sessions
    parsedContentCache.current[messageId] = {
      tableSections: sections,
      contentBlocks: contentBlocks || [],
    };
  }, []);

  // Clear the session-specific layout state when switching sessions.
  // parsedContentCache (the ref) is never cleared — HtmlMessageContent will
  // instantly refill collectedTableSections from the cache without any DOM work.
  useEffect(() => {
    setCollectedTableSections({});
  }, [sessionId]);

  // Helper to parse HTML content into table sections
  const parseHtmlToTableSections = useCallback((htmlContent) => {
    if (!htmlContent) return { sections: [], summary: null };
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.querySelectorAll('style').forEach(s => s.remove());
    
    const allTables = tempDiv.querySelectorAll('table');
    if (allTables.length === 0) return { sections: [], summary: null };
    
    let combinedHeaders = [];
    const combinedRows = [];
    let globalRowIndex = 0;
    
    allTables.forEach((table) => {
      const headerRow = table.querySelector('thead tr, tr:first-child');
      if (headerRow && combinedHeaders.length === 0) {
        headerRow.querySelectorAll('th, td').forEach(cell => {
          combinedHeaders.push(cell.innerText.trim());
        });
      }
      
      const bodyRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      bodyRows.forEach(row => {
        const cells = [];
        row.querySelectorAll('td').forEach(cell => {
          cells.push(cell.innerHTML);
        });
        if (cells.length > 0) {
          const taskNameCell = row.querySelector('td:first-child');
          const taskName = taskNameCell ? taskNameCell.innerText.trim() : '';
          const taskKey = `task_${globalRowIndex}_${taskName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`;
          combinedRows.push({ cells, taskName, taskKey });
          globalRowIndex++;
        }
      });
    });
    
    const sections = [];
    if (combinedHeaders.length > 0 && combinedRows.length > 0) {
      sections.push({ sectionIdx: 0, headers: combinedHeaders, rows: combinedRows });
    }
    
    let summaryContent = null;
    const cloneDiv = document.createElement('div');
    cloneDiv.innerHTML = tempDiv.innerHTML;
    cloneDiv.querySelectorAll('table').forEach(t => t.remove());
    const nonTableHtml = cloneDiv.innerHTML.trim();
    if (nonTableHtml && nonTableHtml.replace(/<[^>]*>/g, '').trim().length > 0) {
      summaryContent = nonTableHtml;
    }
    
    return { sections, summary: summaryContent };
  }, []);

  // Handler for "Download All" PDF button - uses server-side PDF generation from database
  const handleDownloadAllPdf = useCallback(async () => {
    console.log('📄 handleDownloadAllPdf called - using server-side generation');
    console.log('📄 isGeneratingFullPdf:', isGeneratingFullPdf);
    console.log('📄 sessionId:', sessionId);
    
    if (isGeneratingFullPdf || !sessionId) {
      console.log('📄 Already generating or no session, returning');
      return;
    }
    
    setIsGeneratingFullPdf(true);
    try {
      console.log('📄 Calling server-side PDF generation for session:', sessionId);
      await chatService.downloadSessionPdf(sessionId, i18n.language);
      console.log('📄 PDF download completed successfully');
    } catch (error) {
      console.error('Full PDF generation failed:', error);
      alert(i18n.language === 'da' 
        ? 'Der opstod en fejl ved generering af PDF. Prøv igen.'
        : 'Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingFullPdf(false);
    }
  }, [isGeneratingFullPdf, sessionId, i18n.language]);

  // Check if there are any HTML messages with potential tables OR collected table sections
  const hasTablesInMessages = useMemo(() => {
    // Check collected sections first
    const hasCollectedSections = Object.keys(collectedTableSections).length > 0;
    
    // Also check if any messages are HTML (they likely contain tables)
    const hasHtmlMessages = messages.some(msg => msg.isHtml && msg.htmlContent);
    
    const result = hasCollectedSections || hasHtmlMessages;
    console.log('📊 hasTablesInMessages check:', result, 'collected:', hasCollectedSections, 'htmlMessages:', hasHtmlMessages);
    return result;
  }, [collectedTableSections, messages]);

  // Fetch annotations when session changes
  useEffect(() => {
    if (sessionId && user) {
      fetchAnnotations(sessionId);
    } else {
      setAnnotations({});
    }
  }, [sessionId, user, fetchAnnotations]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    if (lastMsg.type === 'user') {
      scrollToBottom();
    } else {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [messages]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      saveMessagesToStorage(messages, sessionId);
    }
  }, [messages, sessionId]);


  useEffect(() => {
    if (
      pendingUploadResult &&
      pendingUploadResult.success &&
      sessionId
    ) {
      // This logic remains the same as your original file
    }
  }, [
    pendingUploadResult,
    sessionId,
    onUploadResultProcessed,
  ]);

  // Track previous sessionId to detect changes
  const prevSessionIdRef = React.useRef(sessionId);
  const activeSessionIdRef = React.useRef(sessionId);
  
  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Cycle status messages while a query is in flight so the UI never looks frozen
  useEffect(() => {
    if (!isLoading) {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      return;
    }

    const cycleMessages = [
      "Analyzing your schedules\u2026",
      "Comparing changes between versions\u2026",
      "Identifying delays and additions\u2026",
      "Generating comparison report\u2026",
      "Processing large document data\u2026",
      "Cross-referencing schedule entries\u2026",
      "Building detailed change analysis\u2026",
      "Finalizing results\u2026",
      "Still working — complex queries take longer\u2026",
      "Almost there — preparing your response\u2026",
    ];
    let idx = 0;
    setStatusText(cycleMessages[0]);

    loadingTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, cycleMessages.length - 1);
      setStatusText(cycleMessages[idx]);
    }, 10000);

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      setStatusText(t('chat.readyToCompare'));
    }, 360000);

    return () => {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
      clearTimeout(safetyTimer);
    };
  }, [isLoading]);

  // Handle session changes - ONLY when sessionId actually changes
  useEffect(() => {
    // Session ended - clear state and show initial message
    if (!sessionId && prevSessionIdRef.current) {
      setMessages([getInitialMessage()]);
      setCurrentActiveFile(null);
      setFilesUploaded(false);
      setUploadedFileNames({ old: null, new: null });
      setIsLoading(false);
      setStatusText(t('chat.readyToCompare'));
      prevSessionIdRef.current = null;
      console.log("🔄 Session ended, cleared state");
      return;
    }
    
    // No session and no previous session - ensure initial message is shown
    if (!sessionId && !prevSessionIdRef.current && messages.length === 0) {
      setMessages([getInitialMessage()]);
      return;
    }

    // Session changed - load messages for new session
    // Skip if this is a manual session switch (handleSelectSession handles it)
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId;
      
      // If manual session switch is in progress, skip - handleSelectSession handles everything
      if (isManualSessionSwitchRef.current) {
        console.log("🔄 Manual session switch in progress, skipping useEffect");
        return;
      }
      
      console.log("🔄 Session changing from:", prevSessionIdRef.current, "to:", sessionId);
      
      // Always clear any in-flight loading state when session changes
      setIsLoading(false);
      setStatusText(t('chat.readyToCompare'));

      const savedMessages = loadMessagesFromStorage(sessionId);
      if (!pendingUploadResult) {
        setMessages(savedMessages);
      }
      setCurrentActiveFile(null);
      
      // Check if saved messages contain file-info
      const hasFileInfoMessage = savedMessages.some(msg => msg.type === 'file-info');
      
      if (hasFileInfoMessage) {
        setFilesUploaded(true);
        // Try to restore file names from the file-info message
        const fileInfoMsg = savedMessages.find(msg => msg.type === 'file-info');
        if (fileInfoMsg) {
          setUploadedFileNames({
            old: fileInfoMsg.oldFileName || null,
            new: fileInfoMsg.newFileName || null
          });
        }
        console.log("🔄 Restored files uploaded state from messages");
      } else {
        // Only reset if this is truly a new session with no files
        setFilesUploaded(false);
        setUploadedFileNames({ old: null, new: null });
        console.log("🔄 New session, files not uploaded yet");
      }
    }
  }, [sessionId]); // Only depend on sessionId, not user
  
  // Sync filesUploaded state with messages to catch any missed updates
  useEffect(() => {
    if (sessionId) {
      const hasFileInfoInMessages = messages.some(msg => msg.type === 'file-info');
      
      // If messages say files are uploaded, but state says no, fix it
      if (hasFileInfoInMessages && !filesUploaded) {
        console.log("🔧 Syncing filesUploaded state from messages");
        setFilesUploaded(true);
      }
    }
  }, [sessionId, messages, filesUploaded]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsMinimized(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-open ChatWidget when shouldAutoOpen is true
  useEffect(() => {
    if (shouldAutoOpen && !isOpen) {
      setIsOpen(true);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [shouldAutoOpen]);

  useEffect(() => {
    const isMaximized = isOpen && (!isMinimized || isMobile);

    if (isMaximized) {
      document.body.style.overflow = "hidden";
      // Also hide the scrollbar on the html element
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    };
  }, [isOpen, isMinimized, isMobile]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !resizeRef.current) return;
      
      const diff = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + diff, 180), 400);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);


  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  // Sessions loaded — do NOT auto-select anything on initial page load.
  // The welcome card is shown with no session highlighted; the user picks one.
  const handleSessionsLoaded = useCallback((_loadedSessions) => {
    // intentionally empty — selection is driven entirely by user clicks
  }, []);

  const analyzeUserIntent = (userInput) => {
    const lowerInput = userInput.toLowerCase();
    const isTaskDetailRequest = /tell me|show me|details of|what is/i.test(
      lowerInput,
    );
    const isComparisonRequest = /compare|sammenlign|difference/i.test(
      lowerInput,
    );
    const isUserResponse = /option [ab]|choice [ab]|file [12]/i.test(
      lowerInput,
    );
    return {
      expectsStructuredData:
        (isTaskDetailRequest || isComparisonRequest) && !isUserResponse,
    };
  };

  const ensureSessionExists = async (sid) => {
    if (!sid || !user) return;
    try {
      const now = new Date();
      const ts = now.toLocaleString('da-DK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const res = await postWithAuth('/api/chat/sessions', { sessionId: sid, title: `Chat ${ts}` });
      if (res.ok) {
        console.log('📝 Session auto-created in DB:', sid);
      }
      // 409 = already exists, that is fine — messages will save correctly
    } catch (err) {
      console.warn('⚠️ Could not ensure session in DB:', err.message);
    }
  };

  // FINAL & REBUILT HANDLE-SEND LOGIC
  // Uses new webhook API with FormData (query + vs_table)
  // Handles both HTML and Markdown/plain text responses
  // Saves messages to database for persistence
  // =================================================================
  const handleSend = async () => {
    if (!sessionId || !inputValue.trim() || isLoading) return;
    
    // Read-only users cannot send messages
    if (user?.role === 'read_only_user') return;

    const userMessageText = inputValue.trim();
    const sendSessionId = sessionId;
    const userMessage = {
      id: `msg-user-${Date.now()}`,
      type: "user",
      text: userMessageText,
    };
    setInputValue("");
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Ensure session exists in DB then save user message with dbId tracking
    await ensureSessionExists(sendSessionId);
    const userMsgSaveResult = await chatService.saveMessageToDatabase(sendSessionId, 'user', userMessageText, 'text', false, {});
    if (userMsgSaveResult?.success && userMsgSaveResult?.message?.id) {
      setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, dbId: userMsgSaveResult.message.id } : m));
    }

    const isStillSameSession = () => activeSessionIdRef.current === sendSessionId;

    try {
      // Use tableSessionIds from props (populated from database via App.jsx)
      const currentTableSessionIds = tableSessionIds;
      console.log("🔑 Using table session IDs for query:", currentTableSessionIds);

      // Get current language from i18n
      const currentLanguage = i18n.language?.substring(0, 2) || 'da';
      
      const response = await chatService.sendFollowUpQuery(
        userMessageText,
        sendSessionId,
        currentTableSessionIds || {},
        currentLanguage,
      );

      console.log("🌐 API Response received");
      console.log("📊 isHtmlTable:", response.isHtmlTable);
      console.log("📝 Output length:", response.output?.length, "first 200:", response.output?.substring(0, 200));
      console.log("🔮 predictive_insights exists:", !!response.predictiveInsights, "status:", response.predictiveStatus);

      if (!isStillSameSession()) {
        console.log("⚠️ Session changed during request. Saving to DB only.");
        const switchMeta = {};
        if (response.isHtmlTable) switchMeta.tableCount = response.tableCount || 0;
        if (response.predictiveStatus === 'success' && response.predictiveInsights) switchMeta.predictive_insights = response.predictiveInsights;
        chatService.saveMessageToDatabase(sendSessionId, 'bot', response.output || '', response.isHtmlTable ? 'html' : 'text', !!response.isHtmlTable, switchMeta);
        setIsLoading(false);
        setStatusText("");
        return;
      }

      const rawOutput = response.output || '';
      const isHtml = response.isHtmlTable;

      let predictiveContent = null;
      const hasPredictive = response.predictiveStatus === 'success' && response.predictiveInsights;
      if (hasPredictive) {
        predictiveContent = DOMPurify.sanitize(response.predictiveInsights, { ADD_TAGS: ['style'], ADD_ATTR: ['style', 'class'] });
      }

      const botMsgId = `msg-bot-${Date.now()}`;
      let botMessage;
      let saveContentType = 'text';
      let saveIsHtml = false;
      let saveMeta = {};
      if (hasPredictive) saveMeta.predictive_insights = response.predictiveInsights;

      try {
        if (!rawOutput.trim()) {
          botMessage = { id: botMsgId, type: "bot", text: t('chat.emptyResponse') };
        } else if (isHtml) {
          const sanitizedHtml = DOMPurify.sanitize(rawOutput, { ADD_TAGS: ["style"], ADD_ATTR: ["style", "class"] });
          botMessage = {
            id: botMsgId, type: "bot", isHtml: true, htmlContent: sanitizedHtml,
            tableCount: response.tableCount || 0, predictiveLoading: false, predictiveInsights: predictiveContent,
          };
          saveContentType = 'html';
          saveIsHtml = true;
          saveMeta.tableCount = response.tableCount || 0;
        } else {
          const hasMarkdownTable = rawOutput.includes("|") && rawOutput.includes("---");
          const isComparisonResponse = hasMarkdownTable && (
            rawOutput.includes('## SUMMARY_OF_CHANGES') || rawOutput.includes('## OPSUMMERING_AF_ÆNDRINGER') ||
            rawOutput.includes('## PROJECT_HEALTH') || rawOutput.includes('## PROJEKTSUNDHED') ||
            rawOutput.toLowerCase().includes('## summary of changes') || rawOutput.toLowerCase().includes('## project health')
          );

          if (isComparisonResponse) {
            botMessage = { id: botMsgId, type: "bot", isComparison: true, comparisonContent: rawOutput, predictiveLoading: false, predictiveInsights: predictiveContent };
            saveContentType = 'comparison';
            saveMeta.isComparison = true;
          } else if (hasMarkdownTable) {
            const parsedData = parseGeneralTaskData(rawOutput);
            if (parsedData.length > 0) {
              botMessage = { id: botMsgId, type: "bot", isTable: true, tableData: parsedData, predictiveLoading: false, predictiveInsights: predictiveContent };
              saveContentType = 'markdown';
              saveMeta.hasTable = true;
              saveMeta.rowCount = parsedData.length;
            } else {
              botMessage = { id: botMsgId, type: "bot", text: rawOutput, predictiveLoading: false, predictiveInsights: predictiveContent };
            }
          } else {
            botMessage = { id: botMsgId, type: "bot", text: rawOutput, predictiveLoading: false, predictiveInsights: predictiveContent };
          }
        }
      } catch (renderErr) {
        console.error("⚠️ Error processing response, showing raw:", renderErr);
        botMessage = { id: botMsgId, type: "bot", text: rawOutput || t('chat.emptyResponse') };
      }

      console.log("✅ Rendering bot message:", botMsgId, "type:", botMessage.isHtml ? 'html' : botMessage.isComparison ? 'comparison' : botMessage.isTable ? 'table' : 'text');
      setMessages((prev) => [...prev, botMessage]);
      saveAndTrackMessage(botMsgId, sendSessionId, 'bot', rawOutput, saveContentType, saveIsHtml, saveMeta);
    } catch (error) {
      console.error("Error in handleSend:", error);
      const errorMessage = `Error: ${error.message}`;
      chatService.saveMessageToDatabase(sendSessionId, 'bot', errorMessage, 'text', false, { isError: true });
      if (!isStillSameSession()) {
        setIsLoading(false);
        setStatusText("");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-error-${Date.now()}`,
          type: "bot",
          text: errorMessage,
          isError: true,
        },
      ]);
    } finally {
      if (isStillSameSession()) {
        setIsLoading(false);
        setStatusText("Klar til sammenligning");
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggle = () => {
    setIsAnimating(true);
    setIsOpen(!isOpen);
    setTimeout(() => setIsAnimating(false), 400);
  };

  const handleClose = () => {
    setIsAnimating(true);
    setIsOpen(false);
    setIsMinimized(false);
    setTimeout(() => setIsAnimating(false), 400);
  };

  // Function to handle session end - clear messages from storage
  const handleSessionEnd = () => {
    if (sessionId) {
      clearMessagesFromStorage(sessionId);
      setMessages([initialMessage]);
    }
    if (onEndSession) {
      onEndSession();
    }
  };

  const handleMinimize = () => {
    if (isMobile) return;
    setIsMinimized(!isMinimized);
  };

  const handleFileModalOpen = () => {
    // Check if user is logged in
    if (!user) {
      // Show login prompt for non-logged-in users
      setShowLoginPrompt(true);
      return;
    }

    // Read-only users cannot upload files
    if (user.role === 'read_only_user') {
      return;
    }

    // For logged-in users: Check file count limit
    if (getSessionFileCount && getSessionFileCount() >= 2) {
      alert(
        "Session file limit reached. Please end the current session to upload new files.",
      );
      return;
    }
    setIsFileModalOpen(true);
  };
  const handleFileModalClose = (result) => {
    setIsFileModalOpen(false);
    if (result && result.success && window.refreshSavedFiles) {
      window.refreshSavedFiles();
    }
  };

  const handleNewChat = async () => {
    // Generate new session ID first
    const newSessionId = `session_${[...Array(20)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    console.log('🆕 Creating new chat session:', newSessionId);
    
    // Capture current session info for background save
    const currentSessionId = sessionId;
    const currentFileNames = { ...uploadedFileNames };
    
    // STEP 1: Create new session in database FIRST (must complete before sidebar refresh)
    if (user) {
      try {
        const now = new Date();
        const timestamp = now.toLocaleString('da-DK', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        await postWithAuth('/api/chat/sessions', {
          sessionId: newSessionId,
          title: `Chat ${timestamp}`
        });
        console.log('📝 New session created in database:', newSessionId);
      } catch (error) {
        console.error('Error creating new session:', error);
      }
    }
    
    // STEP 2: Batch all UI state updates together for smooth transition
    setIsLoading(false);
    setStatusText("");
    setFilesUploaded(false);
    setUploadedFileNames({ old: null, new: null });
    setMessages([getInitialMessage(false)]);
    
    // Notify parent to change to new session
    if (onSessionChange) {
      onSessionChange(newSessionId, null);
    }
    
    // STEP 3: Refresh sidebar to show new session
    setSidebarRefreshTrigger(prev => prev + 1);
    
    // STEP 4: Save old session in background (non-blocking)
    if (currentSessionId && user) {
      (async () => {
        try {
          let sessionTitle;
          if (currentFileNames.old && currentFileNames.new) {
            const oldName = currentFileNames.old.replace(/\.[^/.]+$/, "").slice(0, 20);
            const newName = currentFileNames.new.replace(/\.[^/.]+$/, "").slice(0, 20);
            sessionTitle = `📄 ${oldName} ↔ ${newName}`;
          } else {
            const now = new Date();
            const timestamp = now.toLocaleString('da-DK', { 
              day: '2-digit', 
              month: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            sessionTitle = `Chat ${timestamp}`;
          }
          
          try {
            await putWithAuth(`/api/chat/sessions/${currentSessionId}`, {
              title: sessionTitle,
              oldFileName: currentFileNames.old,
              newFileName: currentFileNames.new
            });
          } catch (putError) {
            if (putError.status === 404) {
              await postWithAuth('/api/chat/sessions', {
                sessionId: currentSessionId,
                title: sessionTitle,
                oldFileName: currentFileNames.old,
                newFileName: currentFileNames.new
              });
            }
          }
          // Refresh sidebar again after old session is saved with proper title
          setSidebarRefreshTrigger(prev => prev + 1);
        } catch (error) {
          console.error('Error saving current session:', error);
        }
      })();
    }
  };

  const handleSelectSession = async (session) => {
    // Keep sidebar open for smooth navigation between chats
    // Only close on mobile for better UX
    if (isMobile) {
      setIsSidebarOpen(false);
    }
    
    // Save the current session's messages before leaving (captures any new messages sent)
    if (sessionId && messages.length > 1) {
      sessionMessagesCache.current[sessionId] = messages;
    }

    if (session.session_id === sessionId) return;
    
    // CRITICAL: Ensure widget stays open during session switching
    // This prevents the widget from closing when switching between chats
    if (!isOpen) {
      setIsOpen(true);
    }
    
    // Save as last viewed session for this user (persists across page reloads)
    if (user?.id) {
      localStorage.setItem(`lastViewedSession_${user.id}`, session.session_id);
    }
    
    // Track which session is the intended target (for race-condition guard)
    currentTargetSessionIdRef.current = session.session_id;

    // Abort any previous in-flight fetch so it cannot overwrite this selection
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    // Mark as manual session switch to prevent useEffect interference
    isManualSessionSwitchRef.current = true;
    
    // Clear any in-flight loading state from previous session
    setIsLoading(false);
    setStatusText("");

    // Only show the loading skeleton on first visit — revisits use cached messages instantly
    const hasCachedMessages = !!(sessionMessagesCache.current[session.session_id]?.length);
    setIsLoadingSession(!hasCachedMessages);
    
    // Note: Sessions are saved to database in real-time, no need to save on switch
    
    try {
      // Immediately set session context (files, names) for instant UI update
      const hasFiles = session.old_file_name && session.new_file_name;
      setFilesUploaded(hasFiles);
      
      if (hasFiles) {
        setUploadedFileNames({
          old: session.old_file_name,
          new: session.new_file_name
        });
      } else {
        setUploadedFileNames({ old: null, new: null });
      }
      
      // Notify parent about session change with table IDs from database
      const tableIds = session.old_session_id && session.new_session_id ? {
        oldSessionId: session.old_session_id,
        newSessionId: session.new_session_id
      } : null;
      
      if (onSessionChange) {
        onSessionChange(session.session_id, tableIds);
      }

      // Revisit fast-path: serve from cache with zero network/DOMPurify cost
      if (hasCachedMessages) {
        setMessages(sessionMessagesCache.current[session.session_id]);
        return; // finally block still runs and clears isLoadingSession / manual-switch flag
      }
      
      // First visit — fetch messages from backend
      const response = await getWithAuth(`/api/chat/sessions/${session.session_id}/messages`, {
        signal: abortController.signal
      });
      const data = await response.json();

      // If the user has already clicked a different session, discard this result
      if (currentTargetSessionIdRef.current !== session.session_id) {
        return;
      }

      if (data.success && data.messages) {
        const formattedMessages = data.messages
          .filter(msg => msg.content_type !== 'file-info')
          .map(msg => {
            const base = {
              id: `msg-${msg.sender_type}-${msg.id}`,
              dbId: msg.id,
              type: msg.sender_type === 'user' ? 'user' : 'bot',
            };

            if (msg.sender_type === 'user') {
              return { ...base, text: msg.content };
            }

            const ct = msg.content_type || 'text';

            if (ct === 'html' || msg.is_html) {
              const sanitized = DOMPurify.sanitize(msg.content || '', {
                ADD_TAGS: ['style'],
                ADD_ATTR: ['style', 'class'],
              });
              const rawPredictive = msg.metadata?.predictive_insights || null;
              const sanitizedPredictive = rawPredictive
                ? DOMPurify.sanitize(rawPredictive, { ADD_TAGS: ['style'], ADD_ATTR: ['style', 'class'] })
                : null;
              return {
                ...base,
                isHtml: true,
                htmlContent: sanitized,
                tableCount: msg.metadata?.tableCount || 0,
                predictiveLoading: false,
                predictiveInsights: sanitizedPredictive,
              };
            }

            if (ct === 'comparison') {
              const rawPredComp = msg.metadata?.predictive_insights || null;
              const sanPredComp = rawPredComp
                ? DOMPurify.sanitize(rawPredComp, { ADD_TAGS: ['style'], ADD_ATTR: ['style', 'class'] })
                : null;
              return {
                ...base,
                isComparison: true,
                comparisonContent: msg.content,
                predictiveLoading: false,
                predictiveInsights: sanPredComp,
              };
            }

            if (ct === 'markdown') {
              const parsed = parseGeneralTaskData(msg.content || '');
              const rawPredMd = msg.metadata?.predictive_insights || null;
              const sanPredMd = rawPredMd
                ? DOMPurify.sanitize(rawPredMd, { ADD_TAGS: ['style'], ADD_ATTR: ['style', 'class'] })
                : null;
              if (parsed.length > 0) {
                return { ...base, isTable: true, tableData: parsed, predictiveLoading: false, predictiveInsights: sanPredMd };
              }
              return { ...base, text: msg.content, predictiveLoading: false, predictiveInsights: sanPredMd };
            }

            return { ...base, text: msg.content };
          });
        
        // Build message list with file info if session has files
        let finalMessages;
        if (hasFiles) {
          const fileInfoMessage = {
            id: `msg-files-${Date.now()}`,
            type: "file-info",
            oldFileName: session.old_file_name,
            newFileName: session.new_file_name,
            timestamp: new Date().toISOString()
          };
          
          if (formattedMessages.length === 0) {
            const readyMessage = {
              id: `msg-ready-${Date.now()}`,
              type: "bot",
              text: t('chat.filesReadyToCompare'),
              isInitial: false
            };
            finalMessages = [getInitialMessage(true), fileInfoMessage, readyMessage];
          } else {
            finalMessages = [getInitialMessage(true), fileInfoMessage, ...formattedMessages];
          }
        } else {
          if (formattedMessages.length === 0) {
            finalMessages = [getInitialMessage(false)];
          } else {
            finalMessages = [getInitialMessage(false), ...formattedMessages];
          }
        }
        setMessages(finalMessages);
        // Store in cache so revisits are instant (zero API + DOMPurify cost)
        sessionMessagesCache.current[session.session_id] = finalMessages;
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        // A newer session was selected — silently ignore this stale fetch
        return;
      }
      if (error.message !== 'Unauthorized') {
        console.error('Error loading session:', error);
      }
    } finally {
      // Only clear loading state if this session is still the current target
      if (currentTargetSessionIdRef.current === session.session_id) {
        setIsLoadingSession(false);
        isManualSessionSwitchRef.current = false;
      }
    }
  };

  const saveCurrentSessionToBackend = async (refreshSidebar = false) => {
    if (!user || !sessionId || messages.length <= 1) return;
    
    try {
      const messagesToSave = messages.filter(msg => !msg.isInitial);
      
      for (const msg of messagesToSave) {
        await postWithAuth(`/api/chat/sessions/${sessionId}/messages`, {
          senderType: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.isHtml ? msg.htmlContent : msg.text,
          contentType: msg.isTable ? 'table' : 'text',
          isHtml: msg.isHtml || false,
        });
      }
      
      console.log('✅ Session saved with', messagesToSave.length, 'messages');
      
      if (refreshSidebar) {
        setSidebarRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      if (error.message !== 'Unauthorized') {
        console.error('Error saving messages to backend:', error);
      }
    }
  };

  const extractAllTasks = () => {
    return messages
      .filter((msg) => msg.isTable)
      .flatMap((msg) => msg.tableData);
  };

  // Business days calculation function
  const calculateStartDateDifference = (startDate1, startDate2) => {
    if (
      !startDate1 ||
      !startDate2 ||
      startDate1 === "N/A" ||
      startDate2 === "N/A"
    ) {
      return "N/A";
    }

    try {
      // Enhanced date parsing function
      const parseDate = (dateStr) => {
        if (!dateStr || dateStr === "N/A" || dateStr.trim() === "") return null;

        const cleanStr = dateStr.trim();

        // Try different date formats
        const formats = [
          // DD-MM-YYYY
          /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
          // DD/MM/YYYY
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
          // YYYY-MM-DD
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        ];

        let day, month, year;

        // Format 1: DD-MM-YYYY
        if (formats[0].test(cleanStr)) {
          const parts = cleanStr.split("-");
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          year = parseInt(parts[2]);
        }
        // Format 2: DD/MM/YYYY
        else if (formats[1].test(cleanStr)) {
          const parts = cleanStr.split("/");
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          year = parseInt(parts[2]);
        }
        // Format 3: YYYY-MM-DD
        else if (formats[2].test(cleanStr)) {
          const parts = cleanStr.split("-");
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          day = parseInt(parts[2]);
        } else {
          // Try direct parsing as fallback
          const testDate = new Date(cleanStr);
          if (!isNaN(testDate.getTime())) {
            return testDate;
          }
          return null;
        }

        // Create and validate the date
        const dateObj = new Date(year, month, day);

        // Validate that the date is reasonable
        if (dateObj.getFullYear() < 1900 || dateObj.getFullYear() > 2100) {
          return null;
        }

        // Validate that the constructed date matches our input
        if (
          dateObj.getDate() !== day ||
          dateObj.getMonth() !== month ||
          dateObj.getFullYear() !== year
        ) {
          return null;
        }

        return dateObj;
      };

      const date1 = parseDate(startDate1);
      const date2 = parseDate(startDate2);

      if (!date1 || !date2) return "N/A";
      if (date1.getTime() === date2.getTime()) return "No change";

      // Calculate business days (excluding Sundays only)
      let startDate = date1 > date2 ? new Date(date2) : new Date(date1);
      let endDate = date1 > date2 ? new Date(date1) : new Date(date2);
      let businessDays = 0;

      while (startDate < endDate) {
        const dayOfWeek = startDate.getDay();
        if (dayOfWeek !== 0) {
          // 0 = Sunday, exclude only Sunday
          businessDays++;
        }
        startDate.setDate(startDate.getDate() + 1);
      }

      const isPositive = date2.getTime() > date1.getTime();
      return isPositive
        ? `+${businessDays} business days`
        : `-${businessDays} business days`;
    } catch (error) {
      console.error(
        "Business days calculation error:",
        error,
        "Dates:",
        startDate1,
        startDate2,
      );
      return "N/A";
    }
  };

  const generateExcelAttachment = () => {
    // Your existing function
  };

  const sendEmail = () => {
    // Your existing function
  };

  return (
    <>
      {/* Floating Chat Button - Only show when not in full page mode */}
      {!isFullPage && (!isOpen || isMinimized) && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleToggle}
            data-chat-toggle="true"
            className={`relative group text-white rounded-xl p-4 shadow-2xl transition-all duration-500 transform hover:scale-105 cursor-pointer ${
              isAnimating ? "animate-bounce" : ""
            }`}
            style={{
              background: "#00D6D6",
              boxShadow: "0 10px 30px rgba(0, 214, 214, 0.4)",
            }}
          >
            {sessionId && (
              <div
                className="absolute inset-0 rounded-xl animate-ping opacity-30"
                style={{
                  background: "#00D6D6",
                }}
              ></div>
            )}
            <div className="relative flex items-center justify-center">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {sessionId && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-3 h-3 bg-[#00D6D6] rounded-full animate-pulse shadow-lg">
                    <div className="w-3 h-3 bg-[#00D6D6] rounded-full animate-ping opacity-75"></div>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Chat Window - Always visible in full page mode */}
      {(isFullPage || isOpen) && (
        <div
          className={`${isFullPage ? 'w-full h-full' : 'fixed z-50'} flex flex-col transition-all duration-500 transform ${
            isFullPage || isOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-8"
          } ${
            !isFullPage && isMinimized && !isMobile
              ? "bottom-20 right-6 w-[450px] h-[450px] rounded-2xl max-h-[calc(100vh-10rem)]"
              : !isFullPage ? "inset-0 rounded-none" : ""
          }`}
          style={{
            background: !isFullPage && isMinimized && !isMobile
              ? "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)"
              : "linear-gradient(145deg, rgba(240, 253, 253, 0.98) 0%, rgba(230, 250, 250, 0.98) 100%)",
            backdropFilter: isFullPage ? "none" : "blur(10px)",
            boxShadow: !isFullPage && isMinimized
              ? "0 25px 50px rgba(0, 0, 0, 0.15), 0 0 40px rgba(0, 214, 214, 0.2)"
              : "none",
          }}
        >
          {/* Header - Hide in full page mode since navbar already has the logo */}
          {!isFullPage && (
          <div
            className={`px-6 py-4 flex justify-between items-center border-b border-[#00D6D6]/30 flex-shrink-0 ${
              isMinimized && !isMobile ? "rounded-t-2xl" : "rounded-none"
            }`}
            style={{
              background: "transparent",
            }}
          >
            <div className="flex items-center min-w-0">
              <img
                src="/NordicLogo2.png"
                alt="Nordic AI Group Logo"
                className="h-12 w-auto object-contain flex-shrink-0"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Export Chat Button */}
              {messages.length > 1 && (
                <button
                  onClick={() => {
                    // Helper function to extract clean text from HTML
                    const extractCleanText = (htmlContent) => {
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = htmlContent;
                      
                      // Remove style tags
                      const styleTags = tempDiv.querySelectorAll('style');
                      styleTags.forEach(tag => tag.remove());
                      
                      // Check for tables
                      const tables = tempDiv.querySelectorAll('table');
                      if (tables.length > 0) {
                        const formattedParts = [];
                        tables.forEach((table) => {
                          const rows = table.querySelectorAll('tr');
                          const tableRows = [];
                          rows.forEach((row) => {
                            const cells = row.querySelectorAll('th, td');
                            const cellTexts = [];
                            cells.forEach((cell) => {
                              cellTexts.push(cell.innerText.trim().replace(/\s+/g, ' '));
                            });
                            if (cellTexts.length > 0) {
                              tableRows.push(cellTexts.join(' | '));
                            }
                          });
                          if (tableRows.length > 0) {
                            formattedParts.push(tableRows.join('\n'));
                          }
                        });
                        return formattedParts.join('\n\n');
                      }
                      return tempDiv.innerText || tempDiv.textContent || '';
                    };

                    // Build export data
                    const exportData = {
                      exportedAt: new Date().toISOString(),
                      sessionId: sessionId,
                      files: {
                        oldFile: uploadedFileNames.old || null,
                        newFile: uploadedFileNames.new || null
                      },
                      messages: messages
                        .filter(msg => !msg.isInitial)
                        .map((msg, index) => {
                          let content = '';
                          
                          if (msg.type === 'file-info') {
                            content = `Files Uploaded: Old - ${msg.oldFileName}, New - ${msg.newFileName}`;
                          } else if (msg.isHtml && msg.htmlContent) {
                            content = extractCleanText(msg.htmlContent);
                          } else if (msg.text) {
                            content = msg.text;
                          }
                          
                          return {
                            id: index + 1,
                            sender: msg.type === 'user' ? 'user' : 'assistant',
                            content: content,
                            timestamp: msg.timestamp || null
                          };
                        })
                    };

                    // Create and download file
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `chat-export-${sessionId || 'session'}-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-all duration-300 group cursor-pointer"
                  title={t('chat.exportChat')}
                >
                  <svg
                    className="w-5 h-5 text-[#1c2631]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </button>
              )}
              {/* Hide minimize/close buttons in full page mode */}
              {!isFullPage && !isMobile && (
                <button
                  onClick={handleMinimize}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-all duration-300 group cursor-pointer"
                  title={isMinimized ? t('chat.maximize') : t('chat.minimize')}
                >
                  {isMinimized ? (
                    <svg
                      className="w-5 h-5 text-[#1c2631]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-[#1c2631]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5m0-4.5h4.5m-4.5 0l5.5 5.5"
                      />
                    </svg>
                  )}
                </button>
              )}
              {!isFullPage && (
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-all duration-300 group cursor-pointer"
                >
                  <svg
                    className="w-5 h-5 text-[#1c2631]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Main Content Area with Sidebar */}
          <div className={`flex-1 flex overflow-hidden relative ${isFullPage ? 'h-full' : ''}`}>
            {/* Chat History Sidebar - Only show for logged-in users */}
            {user && !isMinimized && !isMobile && (
              <ChatHistorySidebar
                isOpen={isSidebarOpen}
                onToggle={handleSidebarToggle}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                activeSessionId={sessionId}
                user={user}
                isReadOnly={user?.role === 'read_only_user'}
                sidebarWidth={sidebarWidth}
                onWidthChange={setSidebarWidth}
                isResizing={isResizing}
                onResizeStart={handleResizeStart}
                refreshTrigger={sidebarRefreshTrigger}
                onSessionsLoaded={handleSessionsLoaded}
                updatedSessionInfo={updatedSessionInfo}
                forceUpdateKey={sidebarForceUpdateKey}
              />
            )}

            {/* Messages Area */}
            <div className={`flex-1 flex flex-col overflow-hidden ${isFullPage ? 'h-full' : ''}`}>
              {/* Download All PDF Button - Fixed below header */}
              {hasTablesInMessages && !isLoadingSession && (
                <div className="flex justify-end px-6 py-2 border-b border-gray-100 bg-white/80">
                  <button
                    onClick={() => setShowPdfConfirmModal(true)}
                    disabled={isGeneratingFullPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d3b47] hover:bg-[#1c2631] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                    title={i18n.language === 'da' ? 'Download Komplet PDF' : 'Download Complete PDF'}
                  >
                    {isGeneratingFullPdf ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {i18n.language === 'da' ? 'Komplet PDF' : 'Complete PDF'}
                  </button>
                </div>
              )}

              {chatNavSections.length > 0 && (
                <div className="flex-shrink-0 bg-white/98 backdrop-blur-sm border-b border-slate-200 shadow-sm px-4 py-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {chatNavSections.map(s => {
                      const isActive = chatNavActiveId === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleChatNavClick(s.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                            isActive
                              ? 'bg-[#00D6D6] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-[#00D6D6]/15 hover:text-[#00B4B4]'
                          }`}
                        >
                          {i18n.language === 'da' ? s.labelDa : s.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                id="chat-scroll-container"
                className={`flex-1 overflow-y-auto custom-chat-scrollbar ${isMinimized && !isMobile ? "px-4 py-4" : "px-6 py-6"}`}
                style={{ minHeight: 0 }}
              >
                <div className="w-full space-y-6">
                  {/* Skeleton Loading during session switch */}
                  {isLoadingSession ? (
                    <div className="animate-pulse space-y-6">
                      {/* File info skeleton */}
                      <div className="bg-[#00D6D6]/5 rounded-2xl p-6 border border-[#00D6D6]/20">
                        <div className="h-5 bg-[#00D6D6]/15 rounded w-48 mb-4"></div>
                        <div className="space-y-3">
                          <div className="h-12 bg-white/50 rounded-xl"></div>
                          <div className="h-12 bg-white/50 rounded-xl"></div>
                        </div>
                      </div>
                      {/* Bot message skeleton 1 */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00D6D6]/20 flex-shrink-0"></div>
                        <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#00D6D6]/10 space-y-2">
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-full"></div>
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-4/5"></div>
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-3/4"></div>
                        </div>
                      </div>
                      {/* User message skeleton 1 */}
                      <div className="flex items-start gap-3 justify-end">
                        <div className="bg-[#00D6D6]/10 rounded-2xl p-4 max-w-[70%] space-y-2">
                          <div className="h-4 bg-[#00D6D6]/20 rounded-lg w-48"></div>
                        </div>
                      </div>
                      {/* Bot message skeleton 2 */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00D6D6]/20 flex-shrink-0"></div>
                        <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#00D6D6]/10 space-y-2">
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-3/4"></div>
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-1/2"></div>
                        </div>
                      </div>
                      {/* User message skeleton 2 */}
                      <div className="flex items-start gap-3 justify-end">
                        <div className="bg-[#00D6D6]/10 rounded-2xl p-4 max-w-[70%] space-y-2">
                          <div className="h-4 bg-[#00D6D6]/20 rounded-lg w-32"></div>
                        </div>
                      </div>
                      {/* Bot message skeleton 3 - table skeleton */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00D6D6]/20 flex-shrink-0"></div>
                        <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#00D6D6]/10 space-y-3">
                          <div className="h-4 bg-[#00D6D6]/10 rounded-lg w-40"></div>
                          <div className="h-24 bg-[#00D6D6]/5 rounded-lg w-full"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isLastBotMsg = msg.type !== 'user' && idx === messages.length - 1;
                        const msgKey = msg.dbId || msg.id;
                        return (
                          <div key={`${msg.id}_${Object.keys(annotations).length}_${Object.values(annotations).reduce((sum, arr) => sum + (arr?.length || 0), 0)}`} ref={isLastBotMsg ? lastMessageRef : null}>
                          <MessageItem
                              msg={msg}
                              isMinimized={isMinimized}
                              isMobile={isMobile}
                              t={t}
                              language={i18n.language}
                              sessionId={sessionId}
                              annotations={annotations}
                              onAnnotationSave={handleAnnotationSave}
                              onAnnotationUpdate={handleAnnotationUpdate}
                              user={user}
                              sessionTitle={uploadedFileNames?.old && uploadedFileNames?.new ? `${uploadedFileNames.old} vs ${uploadedFileNames.new}` : 'Comparison Report'}
                              uploadedFileNames={uploadedFileNames}
                              onTableSectionsParsed={handleTableSectionsParsed}
                              onNavReady={handleNavReady}
                              precomputedData={parsedContentCache.current[msgKey] || null}
                              precomputedDataPredictive={parsedContentCache.current[`${msgKey}-predictive`] || null}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}

                  {isLoading && !isLoadingSession && (
                    <div className="flex items-start justify-start px-6 py-4">
                      <div className="rounded-2xl border border-[#00D6D6]/30 bg-gradient-to-br from-[#00D6D6]/5 to-[#00D6D6]/10 p-4 max-w-sm w-full">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#00D6D6] animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-[#00D6D6] animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-[#00D6D6] animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm font-semibold text-[#00D6D6]">Nova AI</span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          {statusText}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          This may take up to a few minutes for complex queries
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
          <div
            className={`border-t border-[#00D6D6]/30 ${isMinimized && !isMobile ? "p-3 rounded-b-2xl" : "px-6 py-6 rounded-none"}`}
            style={{
              background:
                "linear-gradient(145deg, rgba(0, 214, 214, 0.08) 0%, rgba(112, 211, 213, 0.05) 100%)",
            }}
          >
            <div className="w-full">
              <div className="flex space-x-2 relative z-10">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    user?.role === 'read_only_user'
                      ? t('chat.readOnlyPlaceholder')
                      : !filesUploaded
                        ? t('chat.uploadFilesFirst')
                        : sessionId
                          ? t('chat.askMePlaceholder')
                          : t('chat.startSessionPlaceholder')
                  }
                  className={`flex-1 rounded-xl bg-white border border-[#00D6D6]/30 text-[#1c2631] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50 focus:border-[#00D6D6] disabled:cursor-not-allowed disabled:bg-gray-100 transition-all ${isMinimized && !isMobile ? "p-3 text-sm" : "p-4 text-base"}`}
                  disabled={isLoading || !sessionId || !filesUploaded || user?.role === 'read_only_user'}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim() || !sessionId || !filesUploaded || user?.role === 'read_only_user'}
                  className={`rounded-xl text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 ${isMinimized && !isMobile ? "p-2.5" : "p-4"}`}
                  style={{
                    background:
                      isLoading || !inputValue.trim() || !filesUploaded || user?.role === 'read_only_user' ? "#94a3b8" : "#00D6D6",
                  }}
                >
                  <svg
                    className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {isLoading ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    )}
                  </svg>
                </button>
                {/* Only show upload button if user is logged in and not read-only */}
                {user && user.role !== 'read_only_user' && (
                  <button
                    onClick={handleFileModalOpen}
                    disabled={isLoading || !sessionId}
                    className={`rounded-xl text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isMinimized && !isMobile ? "p-2.5" : "p-4"}`}
                    style={{
                      background: isLoading || !sessionId ? "#94a3b8" : "#00D6D6",
                    }}
                    title={t('chat.uploadFiles')}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L15.172 7z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}

      <FileComparisonModal
        isOpen={isFileModalOpen}
        onClose={handleFileModalClose}
        sessionId={sessionId}
        user={user}
        getSessionFileCount={getSessionFileCount}
        onFilesUploaded={async (result) => {
          console.log("✅ Files uploaded callback triggered:", result);
          setIsFileModalOpen(false);
          setFilesUploaded(true);
          
          // Store uploaded file names
          setUploadedFileNames({
            old: result?.oldFileName || null,
            new: result?.newFileName || null
          });
          
          // Add a prominent message showing uploaded files
          const fileInfoMessage = {
            id: `msg-files-${Date.now()}`,
            type: "file-info",
            oldFileName: result?.oldFileName,
            newFileName: result?.newFileName,
            timestamp: new Date().toISOString()
          };
          
          const readyMessage = {
            id: `msg-ready-${Date.now()}`,
            type: "bot",
            text: t('chat.filesReadyToCompare'),
            isInitial: false
          };
          
          setMessages(prev => [...prev, fileInfoMessage, readyMessage]);
          
          if (sessionId && user && result) {
            try {
              const fileInfoContent = `Files Uploaded: Old Schedule - ${result?.oldFileName || 'N/A'}, New Schedule - ${result?.newFileName || 'N/A'}`;
              const fileInfoSave = await chatService.saveMessageToDatabase(sessionId, 'bot', fileInfoContent, 'file-info', false, {
                oldFileName: result?.oldFileName,
                newFileName: result?.newFileName
              });
              if (fileInfoSave?.success && fileInfoSave?.message?.id) {
                setMessages(prev => prev.map(m => m.id === fileInfoMessage.id ? { ...m, dbId: fileInfoSave.message.id } : m));
              }
              
              const readySave = await chatService.saveMessageToDatabase(sessionId, 'bot', t('chat.filesReadyToCompare'), 'text', false, {});
              if (readySave?.success && readySave?.message?.id) {
                setMessages(prev => prev.map(m => m.id === readyMessage.id ? { ...m, dbId: readySave.message.id } : m));
              }
              
              // Use full file names from the upload result (backend already updates the title)
              const sessionTitle = `📄 ${result.oldFileName || 'Old'} ↔ ${result.newFileName || 'New'}`;
              
              // Update session with file info (backend already set the title during upload)
              await putWithAuth(`/api/chat/sessions/${sessionId}`, {
                title: sessionTitle,
                oldSessionId: result.oldSessionId,
                newSessionId: result.newSessionId,
                oldFileName: result.oldFileName,
                newFileName: result.newFileName
              });
              console.log('📝 Session updated with file info:', sessionTitle);
              
              // Immediately update sidebar with new session info (optimistic update)
              // Include timestamp to force React to recognize as new object
              const updateInfo = {
                sessionId: sessionId,
                title: sessionTitle,
                oldFileName: result.oldFileName,
                newFileName: result.newFileName,
                timestamp: Date.now()
              };
              console.log('🔄 Sending optimistic update for sidebar:', sessionId, sessionTitle);
              setUpdatedSessionInfo(updateInfo);
              setSidebarForceUpdateKey(prev => prev + 1);
              setSidebarRefreshTrigger(prev => prev + 1);
            } catch (error) {
              console.error('Error updating session with file info:', error);
            }
          }
          
          if (onFilesUploaded) {
            onFilesUploaded(result);
          }
        }}
      />

      {/* PDF Download Confirmation Modal */}
      {showPdfConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-[#2d3b47] to-[#1c2631] px-6 py-4">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {i18n.language === 'da' ? 'Download Komplet PDF' : 'Download Complete PDF'}
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-600 text-sm mb-4">
                {i18n.language === 'da' 
                  ? 'Dette vil generere en komplet PDF-rapport med alle sammenligningstabeller, resuméer og kommentarer fra denne chatsession.'
                  : 'This will generate a complete PDF report with all comparison tables, summaries, and comments from this chat session.'}
              </p>
              <div className="bg-[#00D6D6]/10 rounded-lg p-3 border border-[#00D6D6]/20">
                <div className="flex items-center gap-2 text-sm text-[#1c2631]">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{i18n.language === 'da' ? 'PDF-filen vil blive downloadet til din enhed.' : 'The PDF file will be downloaded to your device.'}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowPdfConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {i18n.language === 'da' ? 'Annuller' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setShowPdfConfirmModal(false);
                  handleDownloadAllPdf();
                }}
                disabled={isGeneratingFullPdf}
                className="px-4 py-2 text-sm font-medium text-white bg-[#00D6D6] hover:bg-[#00C4C4] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isGeneratingFullPdf ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {i18n.language === 'da' ? 'Genererer...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {i18n.language === 'da' ? 'Download PDF' : 'Download PDF'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes message-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-message-in { animation: message-in 0.4s ease-out; animation-fill-mode: both; }

        /* Custom Chat Scrollbar */
        .custom-chat-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 214, 214, 0.1);
          border-radius: 10px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 214, 214, 0.4);
          border-radius: 10px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 214, 214, 0.6);
        }

        .markdown-content p { margin-bottom: 0.5rem; }
        .markdown-content h2, .markdown-content h3 { font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #1c2631; }
        .task-data-container { max-width: 100%; overflow-x: auto; }
      `}</style>
    </>
  );
};

export default ChatWidget;
