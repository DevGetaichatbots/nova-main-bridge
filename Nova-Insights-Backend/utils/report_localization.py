COMPARISON_DASHBOARD_REPLACEMENTS_DA = [
    ("Comparison Results", "Sammenligningsresultater"),
    ("Summary of Changes", "Opsummering af Ændringer"),
    ("Project Health", "Projektsundhed"),
    ("Attention Needed", "Kræver Opmærksomhed"),
    ("High Risk", "Høj Risiko"),
    ("Stable", "Stabil"),
    ("Delayed", "Forsinket"),
    ("Accelerated", "Fremskyndet"),
    ("Added", "Tilføjet"),
    ("Removed", "Fjernet"),
    ("Impact", "Konsekvens"),
]

PREDICTIVE_REPORT_REPLACEMENTS_DA = [
    ("Schedule Outlook", "Tidsplan Udsigt"),
    ("Biggest Risk", "Største Risiko"),
    ("Schedule Overview", "Tidsplanoversigt"),
    ("Management Conclusion", "Ledelsesbeslutning"),
    ("Delayed Activities", "Forsinkede aktiviteter"),
    ("Root Cause Analysis", "Årsagsanalyse"),
    ("Summary by Area", "Resumé pr. område"),
    ("Priority Actions", "Prioriterede handlinger"),
    ("Resource Assessment", "Ressourcevurdering"),
    ("Forcing Assessment", "Forceringsmuligheder"),
    ("Confidence Level", "Tillidsniveau"),
    ("PROJECT STATUS", "PROJEKTSTATUS"),
    ("Project Status", "Projektstatus"),
    ("Reference Date", "Referencedato"),
    ("Confidence", "Tillidsniveau"),
    ("Actions", "Handlinger"),
    ("Overview", "Overblik"),
]


def _localize_html(html, language, replacements):
    if not html or not language or not language.startswith("da"):
        return html

    localized = html
    for source, target in replacements:
        localized = localized.replace(source, target)
    return localized


def localize_comparison_dashboard_html(html, language):
    return _localize_html(html, language, COMPARISON_DASHBOARD_REPLACEMENTS_DA)


def localize_predictive_report_html(html, language):
    return _localize_html(html, language, PREDICTIVE_REPORT_REPLACEMENTS_DA)
