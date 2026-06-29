const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceAll = (input, replacements) => {
  let output = input;
  for (const [from, to] of replacements) {
    output = output.replace(new RegExp(escapeRegExp(from), 'g'), to);
  }
  return output;
};

const COMPARISON_DASHBOARD_REPLACEMENTS_DA = [
  ['Comparison Results', 'Sammenligningsresultater'],
  ['Summary of Changes', 'Opsummering af Ændringer'],
  ['Project Health', 'Projektsundhed'],
  ['Attention Needed', 'Kræver Opmærksomhed'],
  ['High Risk', 'Høj Risiko'],
  ['Stable', 'Stabil'],
  ['Delayed', 'Forsinket'],
  ['Accelerated', 'Fremskyndet'],
  ['Added', 'Tilføjet'],
  ['Removed', 'Fjernet'],
  ['Impact', 'Konsekvens'],
];

const PREDICTIVE_REPORT_REPLACEMENTS_DA = [
  ['Schedule Outlook', 'Tidsplan Udsigt'],
  ['Biggest Risk', 'Største Risiko'],
  ['Schedule Overview', 'Tidsplanoversigt'],
  ['Management Conclusion', 'Ledelsesbeslutning'],
  ['Delayed Activities', 'Forsinkede aktiviteter'],
  ['Root Cause Analysis', 'Årsagsanalyse'],
  ['Summary by Area', 'Resumé pr. område'],
  ['Priority Actions', 'Prioriterede handlinger'],
  ['Resource Assessment', 'Ressourcevurdering'],
  ['Forcing Assessment', 'Forceringsmuligheder'],
  ['Confidence Level', 'Tillidsniveau'],
  ['PROJECT STATUS', 'PROJEKTSTATUS'],
  ['Project Status', 'Projektstatus'],
  ['Reference Date', 'Referencedato'],
  ['Confidence', 'Tillidsniveau'],
  ['Actions', 'Handlinger'],
  ['Overview', 'Overblik'],
];

export const localizeComparisonDashboardHtml = (html, language) => {
  if (!html || !language?.startsWith('da')) return html;
  return replaceAll(html, COMPARISON_DASHBOARD_REPLACEMENTS_DA);
};

export const localizePredictiveReportHtml = (html, language) => {
  if (!html || !language?.startsWith('da')) return html;
  return replaceAll(html, PREDICTIVE_REPORT_REPLACEMENTS_DA);
};

const PREDICTIVE_DASHBOARD_ALIGNMENT_CSS = `
<style id="nova-dashboard-alignment-fixes">
  span[style*="border-radius"][style*="font-weight"],
  div[style*="border-radius"][style*="font-weight"][style*="background"],
  [style*="border-radius: 6px"],
  [style*="border-radius:6px"],
  [style*="border-radius: 8px"],
  [style*="border-radius:8px"] {
    display: inline-grid !important;
    place-items: center !important;
    align-content: center !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    vertical-align: middle !important;
    white-space: nowrap !important;
    min-height: 18px !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    text-align: center !important;
    transform: translateY(0) !important;
  }

  div[style*="border-radius:50%"],
  div[style*="border-radius: 50%"],
  span[style*="border-radius:50%"],
  span[style*="border-radius: 50%"] {
    display: inline-grid !important;
    place-items: center !important;
    align-content: center !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    text-align: center !important;
    aspect-ratio: 1 / 1 !important;
    padding: 0 !important;
  }

  span[style*="border-radius"][style*="font-weight"],
  div[style*="border-radius"][style*="font-weight"][style*="background"] {
    text-shadow: 0 0 0 currentColor !important;
  }
</style>`;

export const normalizePredictiveDashboardHtml = (html, language) => {
  const localized = localizePredictiveReportHtml(html, language);
  if (!localized || localized.includes('nova-dashboard-alignment-fixes')) return localized;

  if (localized.includes('</head>')) {
    return localized.replace('</head>', `${PREDICTIVE_DASHBOARD_ALIGNMENT_CSS}</head>`);
  }

  return `${PREDICTIVE_DASHBOARD_ALIGNMENT_CSS}${localized}`;
};
