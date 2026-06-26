import jsPDF from 'jspdf';

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
function hex2rgb(h) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return [r,g,b];
}

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

  doc.save(filename);
}

// health dashboard — still use iframe capture as it's fully static HTML
export async function exportIframeToPdf(iframeEl, filename = 'dashboard.pdf') {
  const { default: html2canvas } = await import('html2canvas');
  const doc2 = iframeEl.contentDocument || iframeEl.contentWindow?.document;
  if (!doc2) throw new Error('Cannot access iframe document');

  const canvas = await html2canvas(doc2.body, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scale: 2,
    scrollX: 0,
    scrollY: 0,
    width: doc2.body.scrollWidth,
    height: doc2.body.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const pw = 210, ph = 297;
  const iw = pw;
  const ih = (canvas.height * pw) / canvas.width;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  let remaining = ih;
  let srcY = 0;

  while (remaining > 0) {
    const sliceH = Math.min(ph, remaining);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = (sliceH / ih) * canvas.height;
    const ctx = sliceCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, srcY * (canvas.height / ih), canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pw, sliceH);
    remaining -= ph;
    srcY += ph;
    if (remaining > 0) pdf.addPage();
  }

  pdf.save(filename);
}
