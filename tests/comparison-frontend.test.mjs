import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const servicePath = path.join(root, "src/services/comparisonService.js");
assert.equal(fs.existsSync(servicePath), true, "comparisonService.js should exist");

const service = read("src/services/comparisonService.js");
for (const method of [
  "listComparisons",
  "createComparison",
  "getComparison",
  "renameComparison",
  "deleteComparison",
  "generateDashboard",
]) {
  assert.match(service, new RegExp(`\\b${method}\\s*\\(`), `comparisonService should expose ${method}`);
}
assert.match(service, /\/api\/schedule\/comparisons/, "comparisonService should target schedule comparison API");

const publicShareService = read("src/services/publicShareService.js");
assert.match(publicShareService, /\/api\/schedule\/share\//, "public share service should target public dashboard share API");
assert.doesNotMatch(publicShareService, /fetchWithAuth/, "public share service should not use auth-aware fetch");

const componentPath = path.join(root, "src/components/ComparisonAnalysis.jsx");
assert.equal(fs.existsSync(componentPath), true, "ComparisonAnalysis.jsx should exist");
const component = read("src/components/ComparisonAnalysis.jsx");
assert.match(component, /buildDashboardShareUrl\('comparison'/, "ComparisonAnalysis should build public comparison share links");
assert.match(component, /window\.open\(shareUrl,\s*'_blank',\s*'noopener,noreferrer'\)/, "ComparisonAnalysis share action should open the public dashboard in a new tab");
assert.match(component, /onShareAnalysis=\{handleShareComparison\}/, "ComparisonAnalysis should expose share links in history");
assert.match(component, /exportDashboardPdfViaServer/, "ComparisonAnalysis should use the server-side HTML PDF exporter");
assert.match(component, /<iframe[\s\S]*srcDoc=/, "ComparisonAnalysis should render dashboard HTML in an iframe srcDoc");
assert.match(component, /sandbox="allow-scripts"/, "ComparisonAnalysis iframe should allow scripts without same-origin");
assert.doesNotMatch(component, /Use Classic Analysis|Brug Klassisk Analyse|useClassic|setUseClassic|<ChatWidget/, "ComparisonAnalysis should not expose the classic analysis toggle");
assert.match(component, /<FileComparisonModal/, "ComparisonAnalysis should reuse FileComparisonModal");
assert.match(component, /useNusf:\s*useNusf/, "ComparisonAnalysis should forward NUSF selection to dashboard generation");
assert.match(component, /<AnalysisPageShell/, "ComparisonAnalysis should use the shared analysis shell");
assert.doesNotMatch(component, /className="flex-1 overflow-y-auto bg-slate-50"/, "ComparisonAnalysis should not wrap full-page chat in an extra scroll container");

const uploadModal = read("src/components/FileComparisonModal.jsx");
assert.match(uploadModal, /useNusf,\s*\n\s*\}\);/, "FileComparisonModal should include useNusf in onFilesUploaded payload");

const app = read("src/App.jsx");
assert.match(app, /ComparisonAnalysis/, "App should import/lazy-load ComparisonAnalysis");
assert.match(app, /path="\/comparison"/, "App should register /comparison route");
assert.match(app, /path="\/share\/:type\/:id"[\s\S]*<PublicDashboardShare/, "App should register public share route outside protected chrome");

const navbar = read("src/components/Navbar.jsx");
assert.match(navbar, /to="\/comparison"/, "Navbar should link to the comparison dashboard route");

const shellPath = path.join(root, "src/components/AnalysisPageShell.jsx");
assert.equal(fs.existsSync(shellPath), true, "AnalysisPageShell.jsx should exist");
const shell = read("src/components/AnalysisPageShell.jsx");
assert.match(shell, /h-\[calc\(100vh-3\.5rem\)\]/, "AnalysisPageShell should lock the analysis view to the viewport height below the navbar");
assert.match(shell, /overflow-hidden/, "AnalysisPageShell should own overflow for sidebar and main panel");

const scheduleAnalysis = read("src/components/ScheduleAnalysis.jsx");
assert.match(scheduleAnalysis, /buildDashboardShareUrl\('schedule'/, "ScheduleAnalysis should build public schedule share links");
assert.match(scheduleAnalysis, /window\.open\(shareUrl,\s*'_blank',\s*'noopener,noreferrer'\)/, "ScheduleAnalysis share action should open the public dashboard in a new tab");
assert.match(scheduleAnalysis, /onShareAnalysis=\{handleShareAnalysis\}/, "ScheduleAnalysis should expose share links in history");
assert.match(scheduleAnalysis, /<AnalysisPageShell/, "ScheduleAnalysis should use the shared analysis shell");
assert.match(scheduleAnalysis, /exportDashboardPdfViaServer/, "ScheduleAnalysis should use the server-side dashboard PDF exporter");
assert.doesNotMatch(scheduleAnalysis, /exportDashboardPdf\(/, "ScheduleAnalysis should not use the custom structured predictive PDF exporter");
assert.match(scheduleAnalysis, /exportDashboardPdfViaServer\(\s*normalizePredictiveDashboardHtml/, "ScheduleAnalysis should normalize dashboard HTML only for PDF export");
assert.match(scheduleAnalysis, /srcDoc=\{activeAnalysis\.predictive_insights\}/, "ScheduleAnalysis should render the original dashboard HTML in the iframe");

const scheduleService = read("src/services/scheduleService.js");
assert.doesNotMatch(scheduleService, /\/api\/schedule\/export-pdf/, "scheduleService should not call the PDFShift-backed export endpoint");

const scheduleRoutes = read("Nova-Insights-Backend/routes/schedule.py");
assert.doesNotMatch(scheduleRoutes, /pdfshift/i, "schedule routes should not contain the old PDFShift dashboard export path");
assert.match(scheduleRoutes, /@schedule_bp\.route\('\/share\/analyses\/<analysis_id>'/, "schedule routes should expose public schedule share endpoint");
assert.match(scheduleRoutes, /@schedule_bp\.route\('\/share\/comparisons\/<comparison_id>'/, "schedule routes should expose public comparison share endpoint");
assert.doesNotMatch(
  scheduleRoutes.match(/def get_public_shared_analysis[\s\S]*?def download_analysis_pdf/)?.[0] || "",
  /get_current_user/,
  "public schedule share endpoint should not require auth",
);
assert.doesNotMatch(
  scheduleRoutes.match(/def get_public_shared_comparison[\s\S]*?def download_comparison_pdf/)?.[0] || "",
  /get_current_user/,
  "public comparison share endpoint should not require auth",
);

const publicShare = read("src/components/PublicDashboardShare.jsx");
assert.match(publicShare, /sandbox=\{isComparison \? 'allow-scripts' : 'allow-scripts allow-same-origin'\}/, "public share iframe should keep dashboard scripts interactive");
assert.match(publicShare, /exportDashboardPdfViaServer/, "public share view should reuse the existing server-side dashboard PDF exporter");
assert.match(publicShare, /normalizePredictiveDashboardHtml/, "public share view should normalize predictive dashboard HTML for export");
assert.match(publicShare, /Export PDF|Eksporter PDF/, "public share view should expose an export PDF action");
assert.match(publicShare, /postMessage/, "public share iframe should bridge export button clicks back to the parent page");
assert.match(publicShare, /nova-shared-export-button/, "public share iframe should inject an in-dashboard export button");
assert.doesNotMatch(publicShare, /pointer-events-none absolute right-6 top-6/, "public share view should not float the export button over the dashboard");
assert.doesNotMatch(publicShare, /sticky top-0 z-10/, "public share plain HTML view should not pin the export bar while scrolling");
assert.doesNotMatch(publicShare, /Navbar|ScheduleAnalysisSidebar|ProtectedRoute|ChatWidget/, "public share view should not render app chrome or history");

const exportPdf = read("src/utils/exportPdf.js");
assert.match(exportPdf, /export async function exportDashboardPdfViaServer/, "exportPdf should expose the server-side HTML-to-PDF helper");
assert.match(exportPdf, /export async function exportDashboardPdf/, "exportPdf should expose the structured predictive PDF helper");

const reportLocalization = read("src/utils/reportLocalization.js");
assert.match(reportLocalization, /nova-dashboard-alignment-fixes/, "reportLocalization should inject dashboard alignment fixes");
assert.match(reportLocalization, /normalizePredictiveDashboardHtml/, "reportLocalization should expose dashboard HTML normalization");

const chatWidget = read("src/components/ChatWidget.jsx");
assert.match(chatWidget, /isFullPage \? 'w-full h-full flex-1 min-h-0'/, "ChatWidget full-page mode should claim the available shell height");
assert.match(chatWidget, /flex-1 flex overflow-hidden relative \$\{isFullPage \? 'h-full min-h-0' : ''\}/, "ChatWidget full-page content area should be height-constrained");
assert.match(chatWidget, /flex-1 flex flex-col overflow-hidden \$\{isFullPage \? 'h-full min-h-0' : ''\}/, "ChatWidget full-page message column should preserve a bottom-pinned input");

console.log("comparison frontend smoke checks passed");
