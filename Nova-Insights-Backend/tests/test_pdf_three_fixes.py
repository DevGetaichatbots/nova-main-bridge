"""
Regression tests for 3 PDF rendering bugs:
 1. Schedule Outlook section has no content (wrong keyword)
 2. Project Status block appears twice (duplicate stats table)
 3. Predictive Confidence section has no body (flex-span content not captured)
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.pdf_generator import (
    _parse_schedule_module_cards,
    _extract_confidence_data,
    generate_schedule_analysis_pdf,
)
from bs4 import BeautifulSoup

FULL_HTML = '''<div class="nova-report">

<div class="module-card" style="margin:0 0 20px;padding:22px 24px;background:linear-gradient(135deg,#fffbeb 0%,#fff7ed 100%);border-radius:14px;border:1px solid #fed7aa;border-left:5px solid #d97706;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #fde68a;">
    <div><h3 style="font-size:17px;font-weight:800;color:#92400e;margin:0;">SCHEDULE OUTLOOK</h3>
    <p style="margin:0;font-size:11px;color:#94a3b8;">What happens if no action is taken?</p></div>
  </div>
  <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.7;padding:14px 18px;background:white;border-radius:10px;border:1px solid #e2e8f0;">Task ID 523 will cascade into a 12-week stoppage unless resolved immediately.</div>
  <div style="display:inline-flex;align-items:center;gap:6px;margin:12px 0 16px;padding:8px 16px;border-radius:10px;background:#fffbeb;border:1.5px solid #fde68a;"><span style="font-size:16px;font-weight:900;color:#92400e;">12 weeks</span><span style="font-size:11px;color:#b45309;font-weight:600;">Estimated delay</span></div>
  <div style="margin-top:4px;">
    <div style="font-size:10px;font-weight:700;color:#ea580c;text-transform:uppercase;">Main delay drivers</div>
    <div style="padding:10px 14px;background:white;border-radius:8px;border:1px solid #fed7aa;margin-top:8px;display:flex;align-items:flex-start;gap:8px;"><span style="flex-shrink:0;"></span><span style="font-size:13px;color:#374151;font-weight:500;">Task ID 523 coordination unresolved for 32 days</span></div>
    <div style="padding:10px 14px;background:white;border-radius:8px;border:1px solid #fed7aa;margin-top:8px;display:flex;align-items:flex-start;gap:8px;"><span style="flex-shrink:0;"></span><span style="font-size:13px;color:#374151;font-weight:500;">Electrical installation blocked pending coordination</span></div>
  </div>
</div>

<div class="module-card" style="margin:0 0 20px 0;padding:16px 24px;background:linear-gradient(135deg,#f8fafc,#ffffff);border-radius:14px;border:1px solid #e2e8f0;border-left:4px solid #10b981;">
  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:13px;font-weight:800;color:#475569;text-transform:uppercase;">PREDICTIVE CONFIDENCE</span>
    </div>
    <span style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:800;color:#10b981;background:white;border:2px solid #10b981;">HIGH</span>
    <span style="font-size:12px;color:#64748b;font-style:italic;flex:1;min-width:200px;">Basis: Based on 98 activities with 26 delayed and 8 root causes</span>
  </div>
</div>

<div style="margin:0 0 22px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#f0fdfa,#ecfeff);padding:28px 28px 22px;">
    <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap;">
      <div style="text-align:center;flex-shrink:0;min-width:110px;">
        <div style="font-size:56px;font-weight:900;color:#dc2626;line-height:1;">26</div>
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:4px;">DELAYED</div>
      </div>
      <div style="flex:1;">
        <span style="padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;">Serious Risk</span>
        <div><span style="font-size:12px;color:#1a202c;font-weight:700;">26/98 (27%)</span></div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #edf2f7;">
    <div style="padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1a202c;">98</div><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;">Activities</div></div>
    <div style="padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#dc2626;">26</div><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;">Delayed</div></div>
    <div style="padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#dc2626;">4</div><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;">Critical</div></div>
    <div style="padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#7c3aed;">8</div><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;">Root Causes</div></div>
    <div style="padding:16px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1a202c;">5</div><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;">Areas</div></div>
  </div>
</div>

<div style="margin:0 0 18px;padding:22px 24px;background:linear-gradient(135deg,#fef2f2,#ffffff);border-radius:14px;border:1px solid #fecaca;border-left:5px solid #dc2626;">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-weight:800;color:#dc2626;text-transform:uppercase;">PROJECT STATUS</span>
      <span style="padding:4px 14px;border-radius:20px;font-size:13px;font-weight:800;color:#dc2626;background:white;border:2px solid #dc2626;">CRITICAL</span>
    </div>
    <div><span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Risk Level:</span><span style="font-size:12px;font-weight:800;color:#dc2626;">High</span></div>
  </div>
  <div>
    <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:8px;">Critical Findings</div>
    <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;"><span style="font-size:13px;color:#334155;font-weight:500;">26 activities are delayed, with 8 root causes blocking 5 areas.</span></div>
  </div>
  <div style="margin-top:14px;padding:12px 16px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
    <div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-bottom:8px;">IF NO ACTION IS TAKEN</div>
    <div style="display:flex;align-items:flex-start;gap:8px;padding:3px 0;"><span style="font-size:12px;color:#991b1b;line-height:1.5;">Project handover will be delayed by 2-3 months.</span></div>
  </div>
</div>

<div class="module-card" style="padding:22px 24px;border-radius:14px;border:1px solid #e2e8f0;border-left:5px solid #0d9488;">
  <div><h3 style="font-size:16px;font-weight:700;color:#1a202c;margin:0;">Schedule Overview</h3></div>
  <div>Reference Date: 2026-03-12 | Total: 98 | Delayed: 26</div>
</div>

</div>'''


def test_schedule_outlook_has_content():
    sections, _, _ = _parse_schedule_module_cards(FULL_HTML)
    snap = next((s for s in sections if 'SCHEDULE OUTLOOK' in s['title']), None)
    assert snap is not None, "SCHEDULE OUTLOOK section not found"
    sd = snap.get('snapshot_data', {})
    assert sd.get('what'), "snapshot_data['what'] is empty"
    assert sd.get('delay_impact') == '12 weeks', f"Bad delay_impact: {sd.get('delay_impact')}"
    assert len(sd.get('drivers', [])) == 2, f"Expected 2 drivers, got {len(sd.get('drivers', []))}"


def test_no_duplicate_project_status_when_psc_present():
    sections, overview_stats, project_status = _parse_schedule_module_cards(FULL_HTML)
    psc = overview_stats.get('status_card', {})
    assert psc.get('status_badge') == 'CRITICAL', "status_card not parsed"
    buf = generate_schedule_analysis_pdf(
        {'predictive_insights': FULL_HTML, 'filename': 'test.csv'},
        language='en'
    )
    pdf_bytes = buf.read()
    assert pdf_bytes[:4] == b'%PDF'
    import re as _re
    text_count = pdf_bytes.count(b'Project Status')
    assert text_count <= 2, f"'Project Status' appears {text_count} times — likely duplicated"


def test_predictive_confidence_has_content():
    sections, _, _ = _parse_schedule_module_cards(FULL_HTML)
    conf = next((s for s in sections if 'PREDICTIVE CONFIDENCE' in s['title']), None)
    assert conf is not None, "PREDICTIVE CONFIDENCE section not found"
    cd = conf.get('confidence_data', {})
    assert cd.get('level') == 'HIGH', f"Bad confidence level: {cd.get('level')}"
    assert cd.get('basis'), "confidence_data['basis'] is empty"
    assert '#10b981' in cd.get('color', ''), f"Bad color: {cd.get('color')}"


def test_pdf_generates_without_error():
    analysis = {'predictive_insights': FULL_HTML, 'filename': 'test.csv', 'title': 'Test'}
    buf = generate_schedule_analysis_pdf(analysis, language='en')
    data = buf.read()
    assert data[:4] == b'%PDF', "Output is not a valid PDF"
    assert len(data) > 50000, f"PDF suspiciously small: {len(data)} bytes"


if __name__ == '__main__':
    test_schedule_outlook_has_content()
    print("PASS test_schedule_outlook_has_content")
    test_no_duplicate_project_status_when_psc_present()
    print("PASS test_no_duplicate_project_status_when_psc_present")
    test_predictive_confidence_has_content()
    print("PASS test_predictive_confidence_has_content")
    test_pdf_generates_without_error()
    print("PASS test_pdf_generates_without_error")
    print("\nAll 4 regression tests passed.")
