# Analysis Shared Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timeline comparison, health dashboard, and schedule risk use the same full-height shell so the sidebar stays full-height, main content scrolls correctly, and full-page chat keeps its input pinned to the bottom.

**Architecture:** Introduce a small shared page-shell component that owns viewport height, sidebar placement, and main-panel sizing. Reuse it in `ComparisonAnalysis.jsx` and `ScheduleAnalysis.jsx`, and remove the extra scroll wrapper around full-page `ChatWidget` in the comparison report path so only the chat widget owns message scrolling.

**Tech Stack:** React, JSX, Tailwind utility classes, Node test runner

---

### Task 1: Add regression coverage for the shared shell contract

**Files:**
- Modify: `tests/comparison-frontend.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Assert for shared shell usage and full-page chat placement**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Create the shared analysis shell

**Files:**
- Create: `src/components/AnalysisPageShell.jsx`

- [ ] **Step 1: Add a reusable shell component with fixed viewport height**
- [ ] **Step 2: Include sidebar slot, collapsed-sidebar button slot, and main content slot**
- [ ] **Step 3: Keep the shell `overflow-hidden` with `min-w-0` / `min-h-0` main panel sizing**

### Task 3: Migrate schedule risk and health dashboard to the shared shell

**Files:**
- Modify: `src/components/ComparisonAnalysis.jsx`
- Modify: `src/components/ScheduleAnalysis.jsx`

- [ ] **Step 1: Replace duplicated outer layout wrappers with `AnalysisPageShell`**
- [ ] **Step 2: Preserve the existing sidebar toggle behavior**
- [ ] **Step 3: Keep dashboard/report content inside `flex-1 min-h-0` regions**

### Task 4: Remove the extra scroll owner around full-page chat

**Files:**
- Modify: `src/components/ComparisonAnalysis.jsx`

- [ ] **Step 1: Stop wrapping full-page `ChatWidget` in an extra `overflow-y-auto` container**
- [ ] **Step 2: Render dashboard content in a scrollable container, but render `ChatWidget` directly in the shell body**
- [ ] **Step 3: Verify this keeps the input bar pinned to the bottom while messages scroll internally**

### Task 5: Verify

**Files:**
- Test: `tests/comparison-frontend.test.mjs`
- Test: `tests/support-form.test.mjs`
- Test: `tests/locale-headings.test.mjs`

- [ ] **Step 1: Run the updated comparison frontend test**
- [ ] **Step 2: Run the support-form regression test**
- [ ] **Step 3: Run the locale-heading regression test**
