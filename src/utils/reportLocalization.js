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
