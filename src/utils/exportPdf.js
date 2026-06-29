import jsPDF from 'jspdf';
import { AGENT_BASE_URL } from '../services/chatService';

// RAG server renders the dashboard HTML to a flawless single-wide-page vector
// PDF via headless Chromium. Override with VITE_AGENT_BASE_URL for local testing
// (e.g. point at a locally-running RAG server).
const PDF_EXPORT_BASE_URL = import.meta.env.VITE_AGENT_BASE_URL || AGENT_BASE_URL;

// Send the exact HTML being displayed to the server and download the returned
// PDF silently. SVG charts stay vector, text selectable, colours preserved.
export async function exportDashboardPdfViaServer(html, filename = 'dashboard.pdf') {
  if (!html) throw new Error('No HTML provided for PDF export');

  // Hard client-side ceiling so the button can never spin forever, even if the
  // server stalls. The server's own render guard is ~90s; give it some slack.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120000);

  let res;
  try {
    res = await fetch(`${PDF_EXPORT_BASE_URL}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename: safePdfFilename(filename) }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('PDF export timed out');
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch { /* non-JSON error body */ }
    throw new Error(`PDF export failed: ${detail}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safePdfFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── colours ────────────────────────────────────────────────────────────────
const C = {
  dark:     [15,  23,  42],
  muted:    [100, 116, 139],
  light:    [241, 245, 249],
  border:   [226, 232, 240],
  white:    [255, 255, 255],
  blue:     [37,  99,  235],
  red:      [220, 38,  38],
  amber:    [180, 83,  9],
  cyan:     [14,  116, 144],
  green:    [5,   150, 105],
  redBg:    [254, 226, 226],
  amberBg:  [254, 243, 199],
  cyanBg:   [207, 250, 254],
  brand:    [30,  181, 238],
};

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;
const MR = 14;
const MT = 14;
const CW = PAGE_W - ML - MR;

// ── helpers ────────────────────────────────────────────────────────────────
function setFill(doc, rgb)   { doc.setFillColor(...rgb); }
function setDraw(doc, rgb)   { doc.setDrawColor(...rgb); }
function setColor(doc, rgb)  { doc.setTextColor(...rgb); }
function setFont(doc, w='normal') { doc.setFont('helvetica', w); }

function text(doc, str, x, y, opts={}) {
  doc.text(String(str ?? ''), x, y, opts);
}

function rect(doc, x, y, w, h, style='F') {
  doc.rect(x, y, w, h, style);
}

// draw a filled rounded rectangle (jspdf native roundedRect)
function rrect(doc, x, y, w, h, r, style='F') {
  doc.roundedRect(x, y, w, h, r, r, style);
}

// priority colour
function priColor(p='') {
  if (p.includes('CRITICAL')) return { text: C.red,   bg: C.redBg   };
  if (p.includes('IMPORTANT')) return { text: C.amber, bg: C.amberBg };
  return                               { text: C.cyan,  bg: C.cyanBg  };
}

function priLabel(p='') {
  if (p.includes('CRITICAL'))  return 'CRITICAL';
  if (p.includes('IMPORTANT')) return 'IMPORTANT';
  return 'MONITOR';
}

function safePdfFilename(filename, fallback = 'dashboard.pdf') {
  const base = String(filename || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim() || fallback.replace(/\.pdf$/i, '');
  return `${base}.pdf`;
}

// ── page management ────────────────────────────────────────────────────────
function newPage(doc) {
  doc.addPage();
  return MT;
}

function checkY(doc, y, need=20) {
  if (y + need > PAGE_H - 14) return newPage(doc);
  return y;
}

// ── section header ─────────────────────────────────────────────────────────
function sectionHeader(doc, y, title, iconColor=C.blue) {
  y = checkY(doc, y, 12);
  setFill(doc, iconColor);
  rect(doc, ML, y, 3, 7, 'F');
  setFont(doc, 'bold');
  setColor(doc, C.dark);
  doc.setFontSize(9);
  text(doc, title.toUpperCase(), ML + 5, y + 5.5);
  return y + 12;
}

// ── table helper ───────────────────────────────────────────────────────────
function drawTable(doc, y, cols, rows, { rowH = 7, headerBg = C.light } = {}) {
  const totalW = cols.reduce((a,c) => a + c.w, 0);
  const startX = ML;

  // header
  y = checkY(doc, y, rowH + 4);
  setFill(doc, headerBg);
  rect(doc, startX, y, totalW, rowH + 1, 'F');
  setFont(doc, 'bold');
  setColor(doc, C.muted);
  doc.setFontSize(7);
  let cx = startX + 2;
  cols.forEach(col => {
    text(doc, col.label.toUpperCase(), cx, y + 5);
    cx += col.w;
  });
  y += rowH + 1;

  // rows
  rows.forEach((row, i) => {
    const maxLines = cols.reduce((max, col, ci) => {
      const val = String(row[ci] ?? '');
      const lines = doc.splitTextToSize(val, col.w - 4);
      return Math.max(max, lines.length);
    }, 1);
    const rh = Math.max(rowH, maxLines * 4 + 3);
    y = checkY(doc, y, rh);

    if (i % 2 === 0) {
      setFill(doc, [248, 250, 252]);
      rect(doc, startX, y, totalW, rh, 'F');
    }

    setFont(doc, 'normal');
    setColor(doc, C.dark);
    doc.setFontSize(8);
    cx = startX + 2;
    cols.forEach((col, ci) => {
      const val = String(row[ci] ?? '');
      if (col.badge) {
        const { text: tc, bg } = priColor(val);
        const lbl = priLabel(val);
        const bw = 18, bh = 4;
        setFill(doc, bg);
        rrect(doc, cx, y + 1.5, bw, bh, 1, 'F');
        setColor(doc, tc);
        setFont(doc, 'bold');
        doc.setFontSize(6.5);
        text(doc, lbl, cx + bw/2, y + 4.5, { align: 'center' });
        setFont(doc, 'normal');
        setColor(doc, C.dark);
        doc.setFontSize(8);
      } else {
        const lines = doc.splitTextToSize(val, col.w - 4);
        lines.forEach((ln, li) => text(doc, ln, cx, y + 4.5 + li * 4));
      }
      cx += col.w;
    });

    // bottom border
    setDraw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.line(startX, y + rh, startX + totalW, y + rh);

    y += rh;
  });

  return y + 4;
}

// ── bullet list ────────────────────────────────────────────────────────────
function bulletList(doc, y, items, color=C.dark) {
  doc.setFontSize(8.5);
  setFont(doc, 'normal');
  items.forEach(item => {
    y = checkY(doc, y, 8);
    setFill(doc, color);
    doc.circle(ML + 2, y + 1.5, 1, 'F');
    setColor(doc, C.dark);
    const lines = doc.splitTextToSize(String(item), CW - 7);
    lines.forEach((ln, i) => text(doc, ln, ML + 6, y + (i * 4.5)));
    y += lines.length * 4.5 + 2;
  });
  return y;
}

// ── KPI pill ───────────────────────────────────────────────────────────────
function kpiRow(doc, y, kpis) {
  const pillW = CW / kpis.length - 2;
  let x = ML;
  kpis.forEach(({ label, value, color = C.blue }) => {
    setFill(doc, C.white);
    setDraw(doc, C.border);
    doc.setLineWidth(0.3);
    rrect(doc, x, y, pillW, 18, 2, 'FD');

    setColor(doc, color);
    setFont(doc, 'bold');
    doc.setFontSize(16);
    text(doc, String(value), x + pillW / 2, y + 9, { align: 'center' });

    setColor(doc, C.muted);
    setFont(doc, 'normal');
    doc.setFontSize(7);
    text(doc, label.toUpperCase(), x + pillW / 2, y + 14, { align: 'center' });

    x += pillW + 2;
  });
  return y + 22;
}

// ── status badge ───────────────────────────────────────────────────────────
function statusBadge(doc, y, status, risk) {
  const isRisk = risk === 'HIGH' || status === 'AT_RISK';
  const bg = isRisk ? C.redBg : C.cyanBg;
  const fg = isRisk ? C.red   : C.green;
  const label = status?.replace('_', ' ') ?? '';
  setFill(doc, bg);
  rrect(doc, ML, y, 40, 8, 2, 'F');
  setColor(doc, fg);
  setFont(doc, 'bold');
  doc.setFontSize(9);
  text(doc, label, ML + 20, y + 5.5, { align: 'center' });
  return y + 12;
}

// ── main export ─────────────────────────────────────────────────────────────
export async function exportDashboardPdf(html, filename = 'dashboard.pdf') {
  // 1. extract __pdData from HTML
  const match = html.match(/window\.__pdData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) throw new Error('No __pdData found in HTML');
  const d = JSON.parse(match[1]);

  const ins  = d.insight_data         || {};
  const ov   = d.schedule_overview    || {};
  const acts = d.delayed_activities   || [];
  const rca  = d.root_cause_analysis  || [];
  const exec = d.executive_actions    || [];
  const areas= d.summary_by_area      || [];
  const conc = d.management_conclusion|| '';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── PAGE 1 ──────────────────────────────────────────────────────────────

  // header bar
  setFill(doc, C.dark);
  rect(doc, 0, 0, PAGE_W, 22, 'F');
  setFill(doc, C.brand);
  rect(doc, 0, 0, 4, 22, 'F');

  setColor(doc, C.white);
  setFont(doc, 'bold');
  doc.setFontSize(13);
  text(doc, ov.schedule_name || ins.schedule_name || 'Predictive Dashboard', ML + 2, 10);

  setFont(doc, 'normal');
  doc.setFontSize(8);
  setColor(doc, [148, 163, 184]);
  text(doc, `Reference date: ${ins.reference_date || ''}   ·   Generated by Nova Insights`, ML + 2, 17);

  let y = 28;

  // status + KPIs
  y = statusBadge(doc, y, ins.project_status, ins.risk_level);

  y = kpiRow(doc, y, [
    { label: 'Total Activities', value: ins.total_activities ?? '-',  color: C.blue  },
    { label: 'Delayed',          value: ins.delayed_count    ?? '-',  color: C.amber },
    { label: 'Critical Now',     value: ins.critical_count   ?? '-',  color: C.red   },
    { label: 'Root Causes',      value: ins.root_cause_count ?? '-',  color: C.muted },
    { label: 'Areas Affected',   value: ins.areas_affected   ?? '-',  color: C.cyan  },
  ]);

  // management conclusion
  y = sectionHeader(doc, y, 'Management Conclusion', C.blue);
  setFill(doc, [239, 246, 255]);
  const concLines = doc.splitTextToSize(conc, CW - 6);
  rect(doc, ML, y - 2, CW, concLines.length * 5 + 6, 'F');
  setColor(doc, C.dark);
  setFont(doc, 'normal');
  doc.setFontSize(8.5);
  concLines.forEach((ln, i) => text(doc, ln, ML + 3, y + 3 + i * 5));
  y += concLines.length * 5 + 10;

  // critical findings
  if (ins.critical_findings?.length) {
    y = sectionHeader(doc, y, 'Critical Findings', C.red);
    y = bulletList(doc, y, ins.critical_findings, C.red);
  }

  // consequences
  if (ins.consequences_if_no_action?.length) {
    y = sectionHeader(doc, y, 'Consequences if No Action', C.amber);
    y = bulletList(doc, y, ins.consequences_if_no_action, C.amber);
  }

  // ── PAGE 2 — Executive Actions ──────────────────────────────────────────
  if (exec.length) {
    y = newPage(doc);
    y = sectionHeader(doc, y, 'Executive Actions', C.blue);
    y = drawTable(doc, y,
      [
        { label: '#',          w: 8  },
        { label: 'Action',     w: 80 },
        { label: 'Responsible',w: 45 },
        { label: 'Deadline',   w: 49 },
      ],
      exec.map(a => [a.rank, a.action, a.responsible, a.deadline]),
    );

    // root cause analysis
    if (rca.length) {
      y = sectionHeader(doc, y, 'Root Cause Analysis', C.red);
      y = drawTable(doc, y,
        [
          { label: 'Task',             w: 55 },
          { label: 'Problem',          w: 40 },
          { label: 'Days Overdue',     w: 22 },
          { label: 'Why It Matters',   w: 65 },
        ],
        rca.map(r => [r.human_label || r.task_name, r.problem_type, r.days_overdue, r.why_it_matters]),
      );
    }
  }

  // ── PAGE 3 — Delayed Activities ─────────────────────────────────────────
  if (acts.length) {
    y = newPage(doc);
    y = sectionHeader(doc, y, `Delayed Activities (${acts.length})`, C.amber);
    y = drawTable(doc, y,
      [
        { label: 'Activity',     w: 58 },
        { label: 'Area',         w: 22 },
        { label: 'Trade',        w: 16 },
        { label: 'Days Overdue', w: 20 },
        { label: 'Type',         w: 24 },
        { label: 'Priority',     w: 24, badge: true },
      ],
      acts.map(a => [
        a.human_label || a.task_name,
        a.area,
        a.trade_code,
        a.days_overdue,
        a.task_type,
        a.priority,
      ]),
    );
  }

  // ── Summary by area ─────────────────────────────────────────────────────
  if (areas.length) {
    y = checkY(doc, y, 30);
    y = sectionHeader(doc, y, 'Summary by Area', C.cyan);
    y = drawTable(doc, y,
      [
        { label: 'Area',      w: 30 },
        { label: 'Delayed',   w: 18 },
        { label: 'Critical',  w: 18 },
        { label: 'Important', w: 20 },
        { label: 'Summary',   w: 96 },
      ],
      areas.map(a => [a.area, a.delayed_count, a.critical_count, a.important_count, a.summary]),
    );
  }

  // ── footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setFill(doc, C.light);
    rect(doc, 0, PAGE_H - 8, PAGE_W, 8, 'F');
    setColor(doc, C.muted);
    setFont(doc, 'normal');
    doc.setFontSize(7);
    text(doc, 'Nova Insights — Predictive Dashboard', ML, PAGE_H - 3);
    text(doc, `Page ${i} of ${pageCount}`, PAGE_W - MR, PAGE_H - 3, { align: 'right' });
  }

  doc.save(safePdfFilename(filename));
}

async function captureDocumentToPdf(doc2, filename) {
  const { default: html2pdf } = await import('html2pdf.js');
  const exportWidthPx = Math.max(doc2.documentElement.scrollWidth, doc2.body.scrollWidth, 1440);
  const exportHeightPx = Math.max(doc2.documentElement.scrollHeight, doc2.body.scrollHeight, 1200);
  const pxToMm = 0.264583;
  const pageWidthMm = exportWidthPx * pxToMm;
  const pageHeightMm = exportHeightPx * pxToMm;

  await html2pdf()
    .set({
      filename: safePdfFilename(filename),
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        width: exportWidthPx,
        height: exportHeightPx,
        windowWidth: exportWidthPx,
        windowHeight: exportHeightPx,
        onclone: (clonedDoc) => {
          clonedDoc.head.innerHTML = doc2.head.innerHTML;
        },
      },
      jsPDF: {
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
      },
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(doc2.documentElement)
    .save();
}

function waitForIframeLoad(iframe) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('PDF render timed out')), 15000);
    iframe.onload = () => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        window.clearTimeout(timeout);
        resolve();
      }));
    };
  });
}

async function waitForDocumentAssets(doc2) {
  const fontReady = doc2.fonts?.ready?.catch?.(() => undefined) || Promise.resolve();
  const imageReady = Array.from(doc2.images || []).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  await Promise.race([
    Promise.all([fontReady, ...imageReady]),
    new Promise(resolve => window.setTimeout(resolve, 3000)),
  ]);
}

async function waitForStableLayout(doc2) {
  let lastHeight = 0;
  let stableFrames = 0;
  for (let i = 0; i < 30 && stableFrames < 3; i += 1) {
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    const nextHeight = doc2.body.scrollHeight;
    if (Math.abs(nextHeight - lastHeight) < 2) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      lastHeight = nextHeight;
    }
  }
}

function normalizeCaptureBadges(doc2) {
  const shortBadgeText = /^(?:\d+\s*)?(?:critical|important|monitor|design|vvs|client|coordination|bygherre|milestone)$/i;

  doc2.querySelectorAll('span, div').forEach(el => {
    const textValue = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!textValue || textValue.length > 32) return;

    const style = el.getAttribute('style') || '';
    const computed = doc2.defaultView?.getComputedStyle(el);
    const radius = computed?.borderRadius || '';
    const hasRoundedShape = style.includes('border-radius') || radius !== '0px';
    const hasBadgePaint = style.includes('background') || style.includes('border') || computed?.backgroundColor !== 'rgba(0, 0, 0, 0)';
    if (!hasRoundedShape || !hasBadgePaint) return;

    const rect = el.getBoundingClientRect();
    const isCircle = /^\d+$/.test(textValue) && Math.abs(rect.width - rect.height) <= 6 && rect.width <= 42;
    const isBadge = shortBadgeText.test(textValue);
    if (!isCircle && !isBadge) return;

    const targetHeight = isCircle
      ? Math.max(Math.round(rect.height), Math.round(rect.width), 24)
      : Math.max(Math.round(rect.height), 18);

    Object.assign(el.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      lineHeight: `${targetHeight}px`,
      height: `${targetHeight}px`,
      minHeight: `${targetHeight}px`,
      paddingTop: '0',
      paddingBottom: '0',
      textAlign: 'center',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    });

    if (isCircle) {
      const size = `${targetHeight}px`;
      el.style.width = size;
      el.style.minWidth = size;
      el.style.borderRadius = '50%';
    }
  });
}

export async function exportHtmlToPdf(html, filename = 'dashboard.pdf') {
  if (!html) throw new Error('No HTML provided for PDF export');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1440px';
  iframe.style.height = '2000px';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    const loaded = waitForIframeLoad(iframe);
    iframe.srcdoc = html;
    await loaded;

    const doc2 = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc2) throw new Error('Cannot access PDF export document');

    await waitForDocumentAssets(doc2);
    await waitForStableLayout(doc2);
    normalizeCaptureBadges(doc2);
    await waitForStableLayout(doc2);
    iframe.style.height = `${Math.max(doc2.body.scrollHeight, 1200)}px`;
    await new Promise(resolve => window.requestAnimationFrame(() => resolve()));
    await captureDocumentToPdf(doc2, filename);
  } finally {
    iframe.remove();
  }
}

// health dashboard display iframe fallback
export async function exportIframeToPdf(iframeEl, filename = 'dashboard.pdf') {
  const doc2 = iframeEl.contentDocument || iframeEl.contentWindow?.document;
  if (!doc2) throw new Error('Cannot access iframe document');
  await captureDocumentToPdf(doc2, filename);
}
