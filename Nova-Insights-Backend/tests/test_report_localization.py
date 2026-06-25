import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))


from utils.report_localization import (
    localize_comparison_dashboard_html,
    localize_predictive_report_html,
)


class ReportLocalizationTests(unittest.TestCase):
    def test_localize_comparison_dashboard_html_in_danish(self):
        html = "<h1>Comparison Results</h1><div>Project Health</div><span>Added</span>"
        localized = localize_comparison_dashboard_html(html, "da")

        self.assertIn("Sammenligningsresultater", localized)
        self.assertIn("Projektsundhed", localized)
        self.assertIn("Tilføjet", localized)

    def test_localize_predictive_report_html_in_danish(self):
        html = "<h2>Root Cause Analysis</h2><div>Reference Date</div><span>Project Status</span>"
        localized = localize_predictive_report_html(html, "da-DK")

        self.assertIn("Årsagsanalyse", localized)
        self.assertIn("Referencedato", localized)
        self.assertIn("Projektstatus", localized)

    def test_localize_report_html_is_noop_for_english(self):
        html = "<h2>Root Cause Analysis</h2><div>Comparison Results</div>"

        self.assertEqual(localize_predictive_report_html(html, "en"), html)
        self.assertEqual(localize_comparison_dashboard_html(html, "en-US"), html)


if __name__ == "__main__":
    unittest.main()
