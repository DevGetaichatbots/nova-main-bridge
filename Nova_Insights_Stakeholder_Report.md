# Nova Insights — Technical Status Report

**Date:** March 9, 2026
**Prepared by:** Nordic AI Group ApS Development Team

---

## 1. Current System Capabilities

Nova Insights is a construction schedule comparison platform powered by Microsoft Azure. Below is what the system can do today.

### Core Comparison Engine

| Capability | Status | Details |
|:---|:---:|:---|
| Compare two large project schedules | ✅ Live | PDF upload, Azure Document Intelligence OCR extraction |
| Detect added tasks | ✅ Live | Cross-references unique IDs and task names across both files |
| Detect removed tasks | ✅ Live | Identifies tasks present in the old schedule but absent in the new |
| Detect start date changes | ✅ Live | Calculates shift in business days (excluding Sundays) |
| Detect end date changes | ✅ Live | Calculates shift in business days (excluding Sundays) |
| Detect duration changes | ✅ Live | Compares planned durations between schedule versions |
| Match activities between files | ✅ Live | Intelligent matching by unique ID first, then by task name |
| Generate structured comparison table | ✅ Live | Color-coded HTML tables with status badges (Added, Removed, Delayed, Accelerated, Modified) |
| Export results to Excel/CSV | ✅ Live | One-click export from the comparison results view |
| Handle very large schedules | ✅ Live | Thousands of activities supported via chunked vector storage |
| Analysis speed on Azure | ✅ Live | ~30–60 seconds end-to-end |

### Intelligence Layer (Already Implemented)

#### Top Changes Ranking — Impact-Based Prioritization

Nova already includes a first version of an intelligence layer. After every comparison, the system automatically ranks and highlights the **top 8 most impactful changes** using a weighted scoring model.

**How the scoring works:**

| Factor | Weight | Logic |
|:---|:---|:---|
| Removed tasks | 10 points | Highest impact — scope reduction or missed work |
| Delayed tasks | 8 points | High impact — schedule slippage |
| Accelerated tasks | 6 points | Moderate — positive but still a change |
| Added tasks | 5 points | New scope to manage |
| Modified tasks | 4 points | Date or duration adjustments |
| Duration magnitude | +0.5 per day changed | Capped at 15 points to prevent outlier dominance |
| Early timeline position | +3 bonus | Tasks in the first 25% of the project timeline get a bonus, since early changes tend to ripple downstream |

Each ranked change includes a human-readable rationale (e.g., "Delay detected — 14-day change — Early in timeline") so project managers immediately understand why it was flagged. Clicking a ranked item scrolls directly to that row in the detailed comparison table with a visual highlight.

This ranking is also included in exported PDF reports for stakeholder distribution.

#### Project Health Assessment — Automated Risk Indicator

Every comparison also generates a **Project Health** section with a visual status indicator (pulse icon) and metrics grid. This gives an instant read on whether the schedule is stable or at risk.

**How the health score is calculated:**

| Factor | Weight | Direction |
|:---|:---|:---|
| Delayed tasks | Count × 3 | Increases risk |
| Total delay days | Days × 0.5 | Increases risk |
| Removed tasks | Count × 2 | Increases risk |
| Moved tasks | Count × 1 | Increases risk |
| Added tasks | Count × 0.5 | Increases risk |
| Risks identified | Count × 4 | Increases risk |
| Critical path changes | Count × 5 | Highest risk factor |
| Accelerated tasks | Count × 2 | Reduces risk (subtracted) |
| Total acceleration days | Days × 0.3 | Reduces risk (subtracted) |

**Status thresholds:**

| Status | Condition |
|:---|:---|
| 🟢 **Stable** | Impact score < 15, fewer than 5 delayed tasks, no risks, no critical path changes |
| 🟡 **Attention Needed** | Impact score 15–40, or 5–15 delayed tasks, or 1–3 risks identified |
| 🔴 **High Risk** | Impact score > 40, or 15+ delayed tasks, or 3+ risks, or major critical path delays |

An additional **Change Intensity** metric is calculated as: (Moved + Delayed + Accelerated) / Total Tasks. Below 15% is low concern, 15–35% is medium, above 35% is high concern.

The health section displays a metrics grid showing counts for Added, Removed, Delayed, and Accelerated tasks alongside the final impact score and status.

### Platform Features

| Feature | Status |
|:---|:---:|
| Multi-tenant company architecture | ✅ Live |
| Role-based access control (Owner, Admin, Standard, Read-only) | ✅ Live |
| Persistent chat sessions per comparison | ✅ Live |
| PDF export of individual results and complete chat sessions | ✅ Live |
| Top Changes ranking in both UI and PDF exports | ✅ Live |
| Project Health assessment with every comparison | ✅ Live |
| Audit logging for all critical actions | ✅ Live |
| Danish and English language support | ✅ Live |
| Enterprise-grade security (HttpOnly cookies, token blacklisting, rate limiting, security headers) | ✅ Live |

---

## 2. Stakeholder Questions — Honest Technical Answers

### Can Nova currently detect changes in activity dependencies (logic links between tasks)?

**Partially — with important caveats.**

Nova's AI agent (GPT-4o) is instructed to analyze dependency relationships when they are explicitly present in the uploaded schedule PDFs. If the source PDF contains a column or section listing predecessors/successors (e.g., "Task 5 depends on Task 3"), the system can retrieve and compare that data between versions.

**However**, this is not a structured field extraction like dates or durations. It relies on the AI interpreting dependency text from the OCR output. If the PDF does not present dependencies in a clear tabular format, detection will be incomplete or unreliable.

**What would make this robust:** Structured ingestion of dependency data as a first-class field (similar to how start/end dates are handled), ideally by supporting native schedule file formats (e.g., .xml, .xer, .mpp) where dependencies are stored as structured data rather than visual PDF content.

---

### Can it detect if the critical path has changed between two schedules?

**Partially — AI-inferred, not calculated.**

The AI agent is explicitly instructed to identify critical path impacts and includes a "Critical Path Table" in its analysis. It can reason about which tasks likely affect the overall timeline based on duration, date shifts, and dependency text. Critical path changes also feed into the Project Health score (weighted at ×5, the highest factor).

**However**, Nova does not perform a true CPM (Critical Path Method) calculation. It does not build a network diagram, perform a forward/backward pass, or mathematically determine the critical path. The critical path assessment is the AI's best interpretation based on available schedule data.

**What would make this robust:** Implementing actual CPM calculation by ingesting structured schedule data with dependency links, then programmatically computing the critical path for both versions and comparing the results.

---

### Can it identify float changes?

**Indirectly — not as a dedicated metric.**

Nova detects date shifts and duration changes, which are indicators of float consumption. If a task's start date moved later while the project end date stayed the same, that implies float was consumed. The AI can infer this from the data. The Project Health section also accounts for this indirectly through the delay-days weighting.

**However**, Nova does not extract or calculate Total Float or Free Float as explicit numeric values. There is no "Float column" in the comparison output today.

**What would make this robust:** Extracting float values directly from structured schedule files, or calculating float via CPM once proper dependency data is available.

---

### Can it detect added constraints or logic modifications?

**Partially — for visible constraint changes only.**

If constraints are listed in the PDF (e.g., "Must Start On," "Start No Earlier Than"), the AI can detect differences between versions. Similarly, if dependency descriptions change (e.g., a predecessor was added or removed), the AI can flag this.

**However**, this depends entirely on what the PDF contains. Many schedule exports do not include constraint types or detailed logic in their printable output. In those cases, Nova cannot detect what it cannot see.

**What would make this robust:** Supporting structured import formats (.xml, .xer) where constraints and logic links are stored as discrete data fields.

---

## 3. Summary — Where We Are

Nova Insights is a **production-ready schedule change detection engine with a first-generation intelligence layer**. It reliably handles the core use case: upload two schedule PDFs, get a structured comparison of what changed in terms of tasks, dates, and durations. Beyond raw detection, it already provides **impact-based ranking** (Top Changes) and **automated project health assessment** with every comparison, giving project managers actionable insight rather than just raw data.

For the advanced analytical capabilities (dependencies, critical path, float, constraints), the system has **partial AI-based coverage** that works when the source data is present in the PDFs, but lacks the **structured data ingestion and mathematical computation** needed for reliable, auditable results.

---

## 4. Recommended Next Steps

### Near-term (Expand the Intelligence Layer)

1. **Deepen Impact Ranking** — The Top Changes scoring is live. Next step: expand it to flag changes that ripple across many dependent tasks and add confidence levels to the rationale.
2. **Change Classification** — Automatically categorize changes as cosmetic (name changes), scheduling (date shifts), or structural (scope additions/removals).
3. **Narrative Summary** — Generate a plain-language executive summary: "The project end date moved 2 weeks later, primarily driven by 3 delayed tasks on the critical path."

### Medium-term (Structured Data Support)

4. **Native file format support** — Add import for .xml (P6 XML), .xer (Primavera), and .mpp (MS Project) files. This unlocks all dependency, float, constraint, and resource data.
5. **True CPM calculation** — Build a network scheduler that computes critical path and float from structured dependency data.
6. **Dependency change detection** — First-class comparison of predecessor/successor links between schedule versions.

### Longer-term (Predictive Intelligence)

7. **Trend analysis** — Track schedule evolution across multiple versions over time, not just two-version comparison.
8. **Delay prediction** — Use historical patterns to flag tasks at risk of future delays.
9. **Automated reporting** — Scheduled comparisons with stakeholder email distribution.

---

*This report reflects the system's actual technical capabilities as of March 2026. All assessments are based on the current codebase and architecture.*
