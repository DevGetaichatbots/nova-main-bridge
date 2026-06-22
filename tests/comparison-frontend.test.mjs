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

const uploadModal = read("src/components/FileComparisonModal.jsx");
assert.match(uploadModal, /useNusf,\s*\n\s*\}\);/, "FileComparisonModal should include useNusf in onFilesUploaded payload");

const app = read("src/App.jsx");
assert.match(app, /ComparisonAnalysis/, "App should import/lazy-load ComparisonAnalysis");
assert.match(app, /path="\/comparison"/, "App should register /comparison route");

const navbar = read("src/components/Navbar.jsx");
assert.match(navbar, /to="\/comparison"/, "Navbar should link to the comparison dashboard route");

console.log("comparison frontend smoke checks passed");
