import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const comparisonAnalysis = fs.readFileSync(path.join(root, "src/components/ComparisonAnalysis.jsx"), "utf8");
const scheduleAnalysis = fs.readFileSync(path.join(root, "src/components/ScheduleAnalysis.jsx"), "utf8");

const scheduleRouteBlock = app.match(/path="\/schedule-analysis"[\s\S]*?<ProtectedRoute>[\s\S]*?<\/ProtectedRoute>/);
assert.ok(scheduleRouteBlock, "schedule analysis route should exist");
assert.doesNotMatch(
  scheduleRouteBlock[0],
  /h-screen flex flex-col overflow-hidden/,
  "schedule analysis route should not hard-lock the viewport height",
);
assert.match(
  scheduleRouteBlock[0],
  /min-h-screen flex flex-col/,
  "schedule analysis route should use a flexible min-height layout",
);

const comparisonRouteBlock = app.match(/path="\/comparison"[\s\S]*?<ProtectedRoute>[\s\S]*?<\/ProtectedRoute>/);
assert.ok(comparisonRouteBlock, "comparison route should exist");
assert.doesNotMatch(
  comparisonRouteBlock[0],
  /h-screen flex flex-col overflow-hidden/,
  "comparison route should not hard-lock the viewport height",
);
assert.match(
  comparisonRouteBlock[0],
  /min-h-screen flex flex-col/,
  "comparison route should use a flexible min-height layout",
);

const chatRouteBlock = app.match(/path="\/chat"[\s\S]*?<ProtectedRoute>[\s\S]*?<\/ProtectedRoute>/);
assert.ok(chatRouteBlock, "chat route should exist");
assert.doesNotMatch(
  chatRouteBlock[0],
  /h-screen flex flex-col overflow-hidden/,
  "chat route should not hard-lock the viewport height",
);
assert.match(
  chatRouteBlock[0],
  /min-h-screen flex flex-col/,
  "chat route should use a flexible min-height layout",
);

assert.match(
  app,
  /className="flex-1 min-h-0 pt-14"/,
  "viewport-constrained pages should preserve a flex child with min-h-0 below the navbar",
);

assert.doesNotMatch(
  comparisonAnalysis,
  /className="flex h-full bg-slate-50"/,
  "comparison analysis should not depend on a parent height-only chain",
);
assert.match(
  comparisonAnalysis,
  /className="flex min-h-\[calc\(100vh-3\.5rem\)\] bg-slate-50"/,
  "comparison analysis should anchor itself to the viewport below the fixed navbar",
);

assert.doesNotMatch(
  scheduleAnalysis,
  /className="flex h-full bg-slate-50"/,
  "schedule analysis should not depend on a parent height-only chain",
);
assert.match(
  scheduleAnalysis,
  /className="flex min-h-\[calc\(100vh-3\.5rem\)\] bg-slate-50"/,
  "schedule analysis should anchor itself to the viewport below the fixed navbar",
);

console.log("zoom scroll layout guards passed");
