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

const componentPath = path.join(root, "src/components/ComparisonAnalysis.jsx");
assert.equal(fs.existsSync(componentPath), true, "ComparisonAnalysis.jsx should exist");
const component = read("src/components/ComparisonAnalysis.jsx");
assert.match(component, /<iframe[\s\S]*srcDoc=/, "ComparisonAnalysis should render dashboard HTML in an iframe srcDoc");
assert.match(component, /sandbox="allow-scripts"/, "ComparisonAnalysis iframe should allow scripts without same-origin");
assert.match(component, /<ChatWidget[\s\S]*oldSessionId=/, "ComparisonAnalysis should expose classic chat fallback with stored session IDs");
assert.match(component, /<FileComparisonModal/, "ComparisonAnalysis should reuse FileComparisonModal");
assert.match(component, /useNusf:\s*useNusf/, "ComparisonAnalysis should forward NUSF selection to dashboard generation");
assert.match(component, /<AnalysisPageShell/, "ComparisonAnalysis should use the shared analysis shell");
assert.doesNotMatch(component, /className="flex-1 overflow-y-auto bg-slate-50"/, "ComparisonAnalysis should not wrap full-page chat in an extra scroll container");

const uploadModal = read("src/components/FileComparisonModal.jsx");
assert.match(uploadModal, /useNusf,\s*\n\s*\}\);/, "FileComparisonModal should include useNusf in onFilesUploaded payload");

const app = read("src/App.jsx");
assert.match(app, /ComparisonAnalysis/, "App should import/lazy-load ComparisonAnalysis");
assert.match(app, /path="\/comparison"/, "App should register /comparison route");

const navbar = read("src/components/Navbar.jsx");
assert.match(navbar, /to="\/comparison"/, "Navbar should link to the comparison dashboard route");

const shellPath = path.join(root, "src/components/AnalysisPageShell.jsx");
assert.equal(fs.existsSync(shellPath), true, "AnalysisPageShell.jsx should exist");
const shell = read("src/components/AnalysisPageShell.jsx");
assert.match(shell, /h-\[calc\(100vh-3\.5rem\)\]/, "AnalysisPageShell should lock the analysis view to the viewport height below the navbar");
assert.match(shell, /overflow-hidden/, "AnalysisPageShell should own overflow for sidebar and main panel");

const scheduleAnalysis = read("src/components/ScheduleAnalysis.jsx");
assert.match(scheduleAnalysis, /<AnalysisPageShell/, "ScheduleAnalysis should use the shared analysis shell");

console.log("comparison frontend smoke checks passed");
