import test from 'node:test';
import assert from 'node:assert/strict';

import {
  localizeComparisonDashboardHtml,
  localizePredictiveReportHtml,
} from '../src/utils/reportLocalization.js';

test('localizeComparisonDashboardHtml translates comparison dashboard labels to Danish', () => {
  const input = `
    <h3>Comparison Results</h3>
    <h3>Summary of Changes</h3>
    <h3>Project Health</h3>
    <span>Stable</span>
    <div>Delayed</div>
    <div>Added</div>
    <div>Removed</div>
    <div>Impact</div>
  `;

  const output = localizeComparisonDashboardHtml(input, 'da');

  assert.match(output, /Sammenligningsresultater/);
  assert.match(output, /Opsummering af Ændringer/);
  assert.match(output, /Projektsundhed/);
  assert.match(output, /Stabil/);
  assert.match(output, /Forsinket/);
  assert.match(output, /Tilføjet/);
  assert.match(output, /Fjernet/);
  assert.match(output, /Konsekvens/);
});

test('localizePredictiveReportHtml translates predictive report headings to Danish', () => {
  const input = `
    <h2>Schedule Outlook</h2>
    <h2>Biggest Risk</h2>
    <h2>Actions</h2>
    <h2>Confidence Level</h2>
    <div>PROJECT STATUS</div>
    <h2>Schedule Overview</h2>
    <h2>Management Conclusion</h2>
    <h2>Delayed Activities</h2>
    <h2>Root Cause Analysis</h2>
    <h2>Summary by Area</h2>
    <h2>Priority Actions</h2>
    <h2>Resource Assessment</h2>
    <h2>Forcing Assessment</h2>
    <div>Reference Date</div>
  `;

  const output = localizePredictiveReportHtml(input, 'da');

  assert.match(output, /Tidsplan Udsigt/);
  assert.match(output, /Største Risiko/);
  assert.match(output, /Handlinger/);
  assert.match(output, /Tillidsniveau/);
  assert.match(output, /PROJEKTSTATUS/);
  assert.match(output, /Tidsplanoversigt/);
  assert.match(output, /Ledelsesbeslutning/);
  assert.match(output, /Forsinkede aktiviteter/);
  assert.match(output, /Årsagsanalyse/);
  assert.match(output, /Resumé pr. område/);
  assert.match(output, /Prioriterede handlinger/);
  assert.match(output, /Ressourcevurdering/);
  assert.match(output, /Forceringsmuligheder/);
  assert.match(output, /Referencedato/);
});

test('localize helpers leave English content unchanged for English locale', () => {
  const comparison = '<h3>Comparison Results</h3><div>Impact</div>';
  const predictive = '<h2>Schedule Overview</h2><div>Reference Date</div>';

  assert.equal(localizeComparisonDashboardHtml(comparison, 'en'), comparison);
  assert.equal(localizePredictiveReportHtml(predictive, 'en'), predictive);
});
