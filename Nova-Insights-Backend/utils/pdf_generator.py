from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF
from bs4 import BeautifulSoup, NavigableString
from io import BytesIO
from datetime import datetime
from xml.sax.saxutils import escape as xml_escape
import re
import os

LOGO_PATH = os.path.join(os.path.dirname(__file__), 'NordicLogo.png')
FAVICON_PATH = os.path.join(os.path.dirname(__file__), 'nordicFavIcon.png')

CYAN_PRIMARY = colors.Color(0/255, 206/255, 209/255)
CYAN_DARK = colors.Color(0/255, 160/255, 163/255)
CYAN_LIGHT = colors.Color(230/255, 252/255, 253/255)
DARK_HEADER = colors.Color(30/255, 41/255, 59/255)
DARK_SUBHEADER = colors.Color(51/255, 65/255, 85/255)
MEDIUM_GRAY = colors.Color(100/255, 116/255, 139/255)
LIGHT_GRAY = colors.Color(248/255, 250/255, 252/255)
BORDER_GRAY = colors.Color(226/255, 232/255, 240/255)
WHITE = colors.white
PURPLE_HEADER = colors.Color(109/255, 40/255, 217/255)
PURPLE_LIGHT = colors.Color(245/255, 243/255, 255/255)
GREEN_HEALTH = colors.Color(16/255, 185/255, 129/255)
GREEN_HEALTH_LIGHT = colors.Color(236/255, 253/255, 245/255)

TEAL_PRIMARY = colors.Color(13/255, 148/255, 136/255)
TEAL_LIGHT = colors.Color(240/255, 253/255, 250/255)
ORANGE_RISK = colors.Color(234/255, 88/255, 12/255)
RED_CRITICAL = colors.Color(220/255, 38/255, 38/255)
AMBER_IMPORTANT = colors.Color(217/255, 119/255, 6/255)
CYAN_MONITOR = colors.Color(8/255, 145/255, 178/255)

# Section accent colors matching html_formatter.py exactly
SECTION_COLORS_MAP = {
    'executive':    colors.Color(13/255, 148/255, 136/255),   # teal  #0d9488
    'root_cause':   colors.Color(99/255, 102/255, 241/255),   # indigo #6366f1
    'impact':       colors.Color(217/255, 119/255, 6/255),    # amber  #d97706
    'summary':      colors.Color(139/255, 92/255, 246/255),   # purple #8b5cf6
    'health':       colors.Color(16/255, 185/255, 129/255),   # green  #10b981
    'decision':     colors.Color(220/255, 38/255, 38/255),    # red (AT_RISK/CRITICAL)
    'stable':       colors.Color(16/255, 185/255, 129/255),
    'at_risk':      colors.Color(217/255, 119/255, 6/255),
    'critical':     colors.Color(220/255, 38/255, 38/255),
}
SECTION_LIGHT_BG = {
    'executive':  colors.Color(240/255, 253/255, 250/255),
    'root_cause': colors.Color(238/255, 242/255, 255/255),
    'impact':     colors.Color(255/255, 251/255, 235/255),
    'summary':    colors.Color(245/255, 243/255, 255/255),
    'health':     colors.Color(236/255, 253/255, 245/255),
}

GROUP_COLORS = {
    'Removed': {
        'header': colors.Color(220/255, 38/255, 38/255),
        'bg': colors.Color(254/255, 242/255, 242/255),
        'text': colors.Color(185/255, 28/255, 28/255),
        'icon': '\u2212',
        'badge': colors.Color(254/255, 226/255, 226/255),
    },
    'Added': {
        'header': colors.Color(22/255, 163/255, 74/255),
        'bg': colors.Color(240/255, 253/255, 244/255),
        'text': colors.Color(21/255, 128/255, 61/255),
        'icon': '+',
        'badge': colors.Color(220/255, 252/255, 231/255),
    },
    'Later': {
        'header': colors.Color(217/255, 119/255, 6/255),
        'bg': colors.Color(255/255, 251/255, 235/255),
        'text': colors.Color(180/255, 83/255, 9/255),
        'icon': '\u25bc',
        'badge': colors.Color(254/255, 243/255, 199/255),
    },
    'Earlier': {
        'header': colors.Color(5/255, 150/255, 105/255),
        'bg': colors.Color(236/255, 253/255, 245/255),
        'text': colors.Color(4/255, 120/255, 87/255),
        'icon': '\u25b2',
        'badge': colors.Color(209/255, 250/255, 229/255),
    },
    'Modified': {
        'header': colors.Color(37/255, 99/255, 235/255),
        'bg': colors.Color(239/255, 246/255, 255/255),
        'text': colors.Color(29/255, 78/255, 216/255),
        'icon': '~',
        'badge': colors.Color(219/255, 234/255, 254/255),
    },
    'Other': {
        'header': colors.Color(75/255, 85/255, 99/255),
        'bg': colors.Color(249/255, 250/255, 251/255),
        'text': colors.Color(55/255, 65/255, 81/255),
        'icon': '\u25cb',
        'badge': colors.Color(243/255, 244/255, 246/255),
    },
}

GROUP_LABELS = {
    'Removed': {'en': 'Removed Tasks', 'da': 'Fjernede opgaver'},
    'Added': {'en': 'Added Tasks', 'da': 'Tilf\u00f8jede opgaver'},
    'Later': {'en': 'Delayed Tasks', 'da': 'Forsinkede opgaver'},
    'Earlier': {'en': 'Accelerated Tasks', 'da': 'Fremskyndede opgaver'},
    'Modified': {'en': 'Modified Tasks', 'da': '\u00c6ndrede opgaver'},
    'Other': {'en': 'Other Tasks', 'da': 'Andre opgaver'}
}


def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CoverCompany',
        fontSize=28,
        leading=34,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        alignment=TA_CENTER,
        spaceAfter=2
    ))

    styles.add(ParagraphStyle(
        name='CoverTagline',
        fontSize=11,
        fontName='Helvetica',
        textColor=CYAN_DARK,
        alignment=TA_CENTER,
        spaceAfter=40,
        spaceBefore=4
    ))

    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontSize=22,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        alignment=TA_CENTER,
        spaceAfter=16
    ))

    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        fontSize=10,
        fontName='Helvetica',
        textColor=MEDIUM_GRAY,
        alignment=TA_CENTER,
        spaceAfter=40,
        leading=14
    ))

    styles.add(ParagraphStyle(
        name='CoverMetaLabel',
        fontSize=10,
        fontName='Helvetica',
        textColor=MEDIUM_GRAY,
        alignment=TA_RIGHT,
        spaceAfter=0
    ))

    styles.add(ParagraphStyle(
        name='CoverMetaValue',
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=DARK_SUBHEADER,
        alignment=TA_LEFT,
        spaceAfter=0,
        leading=14,
        wordWrap='CJK'
    ))

    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontSize=15,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        spaceBefore=20,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        name='GroupHeader',
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=WHITE,
        spaceBefore=14,
        spaceAfter=0,
        leftIndent=0,
        borderPadding=(8, 12, 8, 12)
    ))

    styles.add(ParagraphStyle(
        name='UserMessage',
        fontSize=10,
        fontName='Helvetica',
        textColor=WHITE,
        wordWrap='CJK',
        leading=14
    ))

    styles.add(ParagraphStyle(
        name='BotMessage',
        fontSize=10,
        fontName='Helvetica',
        textColor=DARK_HEADER,
        wordWrap='CJK',
        leading=14
    ))

    styles.add(ParagraphStyle(
        name='TimestampLeft',
        fontSize=8,
        fontName='Helvetica',
        textColor=MEDIUM_GRAY,
        alignment=TA_LEFT,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='TableHeaderCell',
        fontSize=7.5,
        fontName='Helvetica-Bold',
        textColor=WHITE,
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='TableCell',
        fontSize=7.5,
        fontName='Helvetica',
        textColor=DARK_SUBHEADER,
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='TableCellBold',
        fontSize=7.5,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='DiffPositive',
        fontSize=7.5,
        fontName='Helvetica-Bold',
        textColor=colors.Color(220/255, 38/255, 38/255),
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='DiffNegative',
        fontSize=7.5,
        fontName='Helvetica-Bold',
        textColor=colors.Color(22/255, 163/255, 74/255),
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='DiffNeutral',
        fontSize=7.5,
        fontName='Helvetica-Bold',
        textColor=MEDIUM_GRAY,
        wordWrap='CJK',
        leading=10
    ))

    styles.add(ParagraphStyle(
        name='NotesCell',
        fontSize=7,
        fontName='Helvetica-Oblique',
        textColor=colors.Color(71/255, 85/255, 105/255),
        wordWrap='CJK',
        leading=9
    ))

    styles.add(ParagraphStyle(
        name='FooterText',
        fontSize=7.5,
        fontName='Helvetica',
        textColor=MEDIUM_GRAY,
        alignment=TA_CENTER
    ))

    styles.add(ParagraphStyle(
        name='QueryLabel',
        fontSize=9,
        fontName='Helvetica-Bold',
        textColor=DARK_SUBHEADER,
        spaceBefore=12,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='ResultsHeader',
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        spaceBefore=10,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        name='SummaryHeading',
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=PURPLE_HEADER,
        spaceBefore=10,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='SummaryItem',
        fontSize=9,
        fontName='Helvetica',
        textColor=DARK_SUBHEADER,
        leading=13,
        leftIndent=15,
        spaceAfter=2
    ))

    styles.add(ParagraphStyle(
        name='HealthTitle',
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=GREEN_HEALTH,
        spaceBefore=10,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='HealthItem',
        fontSize=9,
        fontName='Helvetica',
        textColor=DARK_SUBHEADER,
        leading=13,
        leftIndent=15,
        spaceAfter=2
    ))

    styles.add(ParagraphStyle(
        name='SectionBodyText',
        fontSize=9,
        fontName='Helvetica',
        textColor=DARK_SUBHEADER,
        leading=13,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='SectionBodyBold',
        fontSize=9,
        fontName='Helvetica-Bold',
        textColor=DARK_HEADER,
        leading=13,
        spaceAfter=4
    ))

    return styles


def clean_soup(soup):
    for tag in soup.find_all('style'):
        tag.decompose()
    for tag in soup.find_all('svg'):
        tag.decompose()
    for tag in soup.find_all('script'):
        tag.decompose()
    for tag in soup.find_all(style=re.compile(r'display\s*:\s*none')):
        tag.decompose()
    return soup


def get_cell_text(cell):
    for svg in cell.find_all('svg'):
        svg.decompose()
    text = cell.get_text(separator=' ', strip=True)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def classify_diff_value(cell_text):
    if not cell_text or cell_text == '\u2014':
        return 'neutral'
    text = cell_text.strip()
    if text.startswith('+') or 'later' in text.lower() or 'senere' in text.lower():
        return 'positive'
    if text.startswith('-') or 'earlier' in text.lower() or 'tidligere' in text.lower():
        return 'negative'
    if 'removed' in text.lower() or 'fjernet' in text.lower():
        return 'positive'
    if 'added' in text.lower() or 'tilf\u00f8jet' in text.lower() or 'new' in text.lower() or 'ny ' in text.lower():
        return 'negative'
    return 'neutral'


def detect_group_name(text):
    text_lower = text.lower()
    if 'removed' in text_lower or 'fjernet' in text_lower:
        return 'Removed'
    if 'added' in text_lower or 'tilf\u00f8jet' in text_lower:
        return 'Added'
    if 'later' in text_lower or 'delay' in text_lower or 'forsink' in text_lower or 'senere' in text_lower:
        return 'Later'
    if 'earlier' in text_lower or 'accelerat' in text_lower or 'fremskyn' in text_lower or 'tidligere' in text_lower:
        return 'Earlier'
    if 'modified' in text_lower or '\u00e6ndret' in text_lower or 'changed' in text_lower:
        return 'Modified'
    return None


def detect_row_category(cells):
    text = ' '.join(cells).lower()
    if 'not present in new' in text or 'removed' in text or 'fjernet' in text:
        return 'Removed'
    if 'not present in old' in text or 'added' in text or 'tilføjet' in text:
        return 'Added'
    if 'delayed' in text or 'later' in text or 'forsinket' in text or 'senere' in text:
        return 'Later'
    if 'earlier' in text or 'accelerated' in text or 'tidligere' in text or 'fremskyndet' in text:
        return 'Earlier'
    if 'moved' in text or 'modified' in text or 'ændret' in text or 'flyttet' in text:
        return 'Modified'
    return 'Other'


def parse_markdown_content(markdown):
    if not markdown or not isinstance(markdown, str):
        return {'tables': [], 'summary': None, 'health': None, 'health_data': None, 'results_header': None, 'extra_sections': [], 'pre_table_text': ''}

    result = {
        'tables': [],
        'summary': None,
        'health': None,
        'health_data': None,
        'results_header': None,
        'extra_sections': [],
        'pre_table_text': ''
    }

    summary_patterns = [
        re.compile(r'^##\s*SUMMARY_OF_CHANGES\s*$', re.I | re.M),
        re.compile(r'^##\s*OPSUMMERING_AF_ÆNDRINGER\s*$', re.I | re.M),
        re.compile(r'^##\s*Summary\s+of\s+Changes', re.I | re.M),
        re.compile(r'^##\s*Opsummering\s+af\s+Ændringer', re.I | re.M),
    ]

    health_patterns = [
        re.compile(r'^##\s*PROJECT_HEALTH\s*$', re.I | re.M),
        re.compile(r'^##\s*PROJEKTSUNDHED\s*$', re.I | re.M),
        re.compile(r'^##\s*Project\s+Health', re.I | re.M),
        re.compile(r'^##\s*Projektsundhed', re.I | re.M),
    ]

    summary_start = -1
    health_start = -1

    for pattern in summary_patterns:
        m = pattern.search(markdown)
        if m:
            summary_start = m.start()
            break

    for pattern in health_patterns:
        m = pattern.search(markdown)
        if m:
            health_start = m.start()
            break

    tables_section = ''
    summary_section = ''
    health_section = ''

    if summary_start == -1 and health_start == -1:
        tables_section = markdown
    elif summary_start != -1 and health_start != -1:
        if summary_start < health_start:
            tables_section = markdown[:summary_start].strip()
            summary_section = markdown[summary_start:health_start].strip()
            health_section = markdown[health_start:].strip()
        else:
            tables_section = markdown[:health_start].strip()
            health_section = markdown[health_start:summary_start].strip()
            summary_section = markdown[summary_start:].strip()
    elif summary_start != -1:
        tables_section = markdown[:summary_start].strip()
        summary_section = markdown[summary_start:].strip()
    elif health_start != -1:
        tables_section = markdown[:health_start].strip()
        health_section = markdown[health_start:].strip()

    health_data_match = re.search(r'<!--HEALTH_DATA:(.*?)-->', health_section, re.S)
    if health_data_match:
        try:
            import json
            result['health_data'] = json.loads(health_data_match.group(1))
            health_section = health_section.replace(health_data_match.group(0), '').strip()
        except:
            pass

    if tables_section:
        lines = tables_section.split('\n')
        has_table = '|' in tables_section and any(
            line.strip().startswith('|') and line.strip().endswith('|')
            for line in lines
        )

        pre_table_lines = []
        if has_table:
            tables = []
            current_table_headers = []
            current_table_rows = []

            for line in lines:
                stripped = line.strip()
                is_separator = (stripped.startswith('|') and stripped.endswith('|') and
                                re.sub(r'[\|\-\s:]', '', stripped) == '')
                is_table_row = stripped.startswith('|') and stripped.endswith('|') and not is_separator

                if is_separator:
                    continue

                if is_table_row:
                    cells = [c.strip() for c in stripped.strip('|').split('|')]
                    if not current_table_headers:
                        current_table_headers = cells
                    else:
                        current_table_rows.append(cells)
                else:
                    if current_table_headers and current_table_rows:
                        tables.append({'headers': current_table_headers, 'rows': current_table_rows})
                        current_table_headers = []
                        current_table_rows = []
                    if stripped and not current_table_headers:
                        pre_table_lines.append(stripped)

            if current_table_headers and current_table_rows:
                tables.append({'headers': current_table_headers, 'rows': current_table_rows})

            for table in tables:
                groups = {}
                group_order = []
                for row in table['rows']:
                    category = detect_row_category(row)
                    if category not in groups:
                        groups[category] = {'name': category, 'count': 0, 'rows': []}
                        group_order.append(category)
                    groups[category]['rows'].append(row)
                    groups[category]['count'] += 1

                ordered_groups = [groups[cat] for cat in group_order]
                result['tables'].append({'headers': table['headers'], 'groups': ordered_groups})

            result['pre_table_text'] = '\n'.join(pre_table_lines)
        else:
            result['pre_table_text'] = tables_section

    if summary_section:
        summary_data = {'title': 'Summary of Changes', 'sections': []}
        lines = summary_section.split('\n')
        current_section_title = ''
        current_items = []

        for line in lines:
            stripped = line.strip()
            if not stripped or stripped == '---':
                continue
            if re.match(r'^##\s*(SUMMARY|OPSUMMERING)', stripped, re.I):
                continue

            bold_match = re.match(r'^\*\*([^*]+?)(?::)?\*\*$', stripped)
            if bold_match:
                if current_items:
                    summary_data['sections'].append({'title': current_section_title, 'items': current_items})
                    current_items = []
                current_section_title = bold_match.group(1).strip().rstrip(':')
                continue

            if stripped.startswith('• ') or stripped.startswith('* ') or stripped.startswith('- '):
                item_text = stripped[2:].strip()
                item_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', item_text)
                current_items.append(item_text)
                continue

            item_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', stripped)
            current_items.append(item_text)

        if current_items:
            summary_data['sections'].append({'title': current_section_title, 'items': current_items})

        if summary_data['sections']:
            result['summary'] = summary_data

    if health_section:
        health_data_display = {'title': 'Project Health', 'status': '', 'items': []}
        lines = health_section.split('\n')

        for line in lines:
            stripped = line.strip()
            if not stripped or stripped == '---':
                continue
            if re.match(r'^##\s*(PROJECT|PROJEKT)', stripped, re.I):
                continue
            if re.match(r'^\*\*Status:\*\*', stripped, re.I):
                status_match = re.search(r'\*\*Status:\*\*\s*(.*)', stripped, re.I)
                if status_match:
                    health_data_display['status'] = re.sub(r'\*\*([^*]+)\*\*', r'\1', status_match.group(1).strip())
                continue

            bold_match = re.match(r'^\*\*([^*]+?)(?::)?\*\*$', stripped)
            if bold_match:
                health_data_display['items'].append(f'[{bold_match.group(1).strip()}]')
                continue

            if stripped.startswith('• ') or stripped.startswith('* ') or stripped.startswith('- '):
                item_text = stripped[2:].strip()
                item_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', item_text)
                health_data_display['items'].append(item_text)
                continue

            item_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', stripped)
            health_data_display['items'].append(item_text)

        if health_data_display['items'] or health_data_display['status']:
            result['health'] = health_data_display

    return result


def parse_pre_table_text(text, styles):
    elements = []
    if not text:
        return elements

    lines = text.split('\n')
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        bold_match = re.match(r'^\*\*([^*]+)\*\*$', stripped)
        if bold_match:
            elements.append(Paragraph(f'<b>{bold_match.group(1)}</b>', styles['SectionBodyBold']))
            continue

        stripped_clean = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', stripped)

        if stripped.startswith('• ') or stripped.startswith('* ') or stripped.startswith('- '):
            text_content = stripped_clean[2:].strip()
            elements.append(Paragraph(f'\u2022  {text_content}', styles['SectionBodyText']))
        else:
            elements.append(Paragraph(stripped_clean, styles['SectionBodyText']))

    if elements:
        elements.append(Spacer(1, 8))
    return elements


def build_health_stats_table(health_data, styles, language='da'):
    if not health_data:
        return []

    stats = []
    label_map = {
        'da': {'delayed': 'Forsinket', 'accelerated': 'Fremskyndet', 'added': 'Tilf\u00f8jet', 'removed': 'Fjernet', 'impact': 'Score'},
        'en': {'delayed': 'Delayed', 'accelerated': 'Accelerated', 'added': 'Added', 'removed': 'Removed', 'impact': 'Impact'}
    }
    labels = label_map.get(language, label_map['en'])

    stat_colors = {
        'delayed': colors.Color(220/255, 38/255, 38/255),
        'accelerated': colors.Color(16/255, 185/255, 129/255),
        'added': CYAN_PRIMARY,
        'removed': colors.Color(217/255, 119/255, 6/255),
        'impact': DARK_HEADER,
    }

    stat_bgs = {
        'delayed': colors.Color(254/255, 242/255, 242/255),
        'accelerated': colors.Color(236/255, 253/255, 245/255),
        'added': CYAN_LIGHT,
        'removed': colors.Color(255/255, 251/255, 235/255),
        'impact': LIGHT_GRAY,
    }

    for key in ['delayed_count', 'accelerated_count', 'added_count', 'removed_count', 'impact_score']:
        if key in health_data and health_data[key] is not None:
            short_key = key.replace('_count', '').replace('_score', '')
            label = labels.get(short_key, short_key.title())
            stats.append((str(health_data[key]), label.upper(), stat_colors.get(short_key, DARK_HEADER), stat_bgs.get(short_key, LIGHT_GRAY)))

    if not stats:
        return []

    elements = []
    stat_cells = []
    for value, label, color, bg_color in stats:
        cell_content = [
            Paragraph(f'<font color="#{int(color.red*255):02x}{int(color.green*255):02x}{int(color.blue*255):02x}"><b>{value}</b></font>',
                      ParagraphStyle('statval', parent=styles['TableCell'], fontSize=18, alignment=TA_CENTER, leading=22)),
            Paragraph(f'<font size="6">{label}</font>',
                      ParagraphStyle('statlbl', parent=styles['TableCell'], fontSize=6, alignment=TA_CENTER, textColor=MEDIUM_GRAY, leading=10, spaceBefore=2))
        ]
        stat_cells.append(cell_content)

    col_count = len(stat_cells)
    col_width = 515 / col_count if col_count > 0 else 515

    stat_table = Table([stat_cells], colWidths=[col_width] * col_count)

    style_cmds = [
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]

    for i, (_, _, _, bg_color) in enumerate(stats):
        style_cmds.append(('BACKGROUND', (i, 0), (i, 0), bg_color))
        if i < col_count - 1:
            style_cmds.append(('LINEAFTER', (i, 0), (i, 0), 0.5, BORDER_GRAY))

    stat_table.setStyle(TableStyle(style_cmds))
    elements.append(Spacer(1, 10))
    elements.append(stat_table)
    elements.append(Spacer(1, 10))
    return elements


def build_colored_section(section_data, styles, section_type='summary'):
    """Build a color-coded section matching the HTML formatter's styling."""
    elements = []
    title = section_data.get('title', '')
    items = section_data.get('items', [])
    sections = section_data.get('sections', [])

    accent = SECTION_COLORS_MAP.get(section_type, DARK_SUBHEADER)
    bg = SECTION_LIGHT_BG.get(section_type, LIGHT_GRAY)

    if title:
        title_row = [[Paragraph(f'<b>{xml_escape(title)}</b>', ParagraphStyle(
            f'ct_{section_type}', parent=styles['SummaryHeading'], textColor=WHITE, fontSize=12
        ))]]
        title_table = Table(title_row, colWidths=[515])
        title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), accent),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(title_table)

    # ── Project Health: render Status / Trend / Risk / Confidence badge row ──
    if section_type == 'health':
        badge_parts = []
        status_txt = section_data.get('status', '')
        trend_txt = section_data.get('trend', '')
        risk_txt = section_data.get('risk_level', '')
        conf_txt = section_data.get('confidence', '')

        # Determine status colour
        if status_txt:
            lower_s = status_txt.lower()
            if any(k in lower_s for k in ['critical', 'kritisk']):
                s_color = SECTION_COLORS_MAP['critical']
            elif any(k in lower_s for k in ['risk', 'risiko', 'attention']):
                s_color = SECTION_COLORS_MAP['at_risk']
            else:
                s_color = SECTION_COLORS_MAP['stable']
            badge_parts.append((xml_escape(status_txt), s_color))

        if trend_txt:
            lower_t = trend_txt.lower()
            if any(k in lower_t for k in ['improv', 'forbedring']):
                t_color = SECTION_COLORS_MAP['stable']
                trend_icon = '\u2b06 '
            elif any(k in lower_t for k in ['worsen', 'forværring']):
                t_color = SECTION_COLORS_MAP['critical']
                trend_icon = '\u2b07 '
            else:
                t_color = MEDIUM_GRAY
                trend_icon = '\u27a1 '
            badge_parts.append((trend_icon + xml_escape(trend_txt), t_color))

        if risk_txt:
            lower_r = risk_txt.lower()
            if 'high' in lower_r or 'høj' in lower_r:
                r_color = SECTION_COLORS_MAP['critical']
            elif 'medium' in lower_r or 'moderat' in lower_r:
                r_color = SECTION_COLORS_MAP['at_risk']
            else:
                r_color = SECTION_COLORS_MAP['stable']
            badge_parts.append((xml_escape(risk_txt), r_color))

        if conf_txt:
            lower_c = conf_txt.lower()
            if 'high' in lower_c or 'høj' in lower_c:
                c_color = SECTION_COLORS_MAP['stable']
            elif 'low' in lower_c or 'lav' in lower_c:
                c_color = SECTION_COLORS_MAP['critical']
            else:
                c_color = SECTION_COLORS_MAP['at_risk']
            badge_parts.append(('\u25a3 ' + xml_escape(conf_txt), c_color))

        if badge_parts:
            badge_cells = []
            for _bi, (badge_text, badge_color) in enumerate(badge_parts):
                hex_color = '#{:02x}{:02x}{:02x}'.format(
                    int(badge_color.red * 255),
                    int(badge_color.green * 255),
                    int(badge_color.blue * 255)
                )
                badge_cells.append(Paragraph(
                    f'<font color="{hex_color}"><b>{badge_text}</b></font>',
                    ParagraphStyle(f'hbadge_{_bi}', parent=styles['TableCell'],
                                   fontSize=8, alignment=TA_CENTER)
                ))
            col_w = 515 / len(badge_cells)
            badge_table = Table([badge_cells], colWidths=[col_w] * len(badge_cells))
            badge_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), bg),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LINEBELOW', (0, 0), (-1, -1), 1, accent),
            ]))
            elements.append(badge_table)

    content_rows = []
    # Handle sectioned summary-style data
    for sec in sections:
        if sec.get('title'):
            content_rows.append([Paragraph(
                f'<b>{xml_escape(sec["title"])}</b>',
                ParagraphStyle(f'cs_{section_type}', parent=styles['SummaryHeading'],
                               fontSize=10, textColor=accent)
            )])
        for item in sec.get('items', []):
            content_rows.append([Paragraph(
                f'\u2022  {xml_escape(item)}',
                ParagraphStyle(f'ci_{section_type}', parent=styles['SummaryItem'],
                               fontSize=9, textColor=DARK_SUBHEADER)
            )])
    # Handle flat items list
    for item in items:
        if item.startswith('[') and item.endswith(']'):
            content_rows.append([Paragraph(
                f'<b>{xml_escape(item[1:-1])}</b>',
                ParagraphStyle(f'ch_{section_type}', parent=styles['SummaryHeading'],
                               fontSize=10, textColor=accent)
            )])
        else:
            content_rows.append([Paragraph(
                f'\u2022  {xml_escape(item)}',
                ParagraphStyle(f'ci2_{section_type}', parent=styles['SummaryItem'],
                               fontSize=9, textColor=DARK_SUBHEADER)
            )])

    if content_rows:
        content_table = Table(content_rows, colWidths=[515])
        content_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(content_table)

    elements.append(Spacer(1, 14))
    return elements


def build_data_trust_section(dt_data, styles, language='da'):
    """Render the Data Trust / Analysis Basis section in the PDF."""
    elements = []
    if not dt_data:
        return elements

    dt_color = colors.Color(8/255, 145/255, 178/255)
    dt_bg = colors.Color(240/255, 249/255, 255/255)

    title = dt_data.get('title', 'Data Trust — Analysis Basis' if language != 'da' else 'Datagrundlag')
    header_row = [[Paragraph(
        f'<b>{xml_escape(title)}</b>',
        ParagraphStyle('dtTitle', parent=styles['SectionHeader'], textColor=WHITE, fontSize=11)
    )]]
    hdr_table = Table(header_row, colWidths=[515])
    hdr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), dt_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(hdr_table)

    table_rows = dt_data.get('table_rows', [])
    if table_rows:
        col_count = max(len(r) for r in table_rows) if table_rows else 3
        col_widths = [515 / col_count] * col_count
        pdf_rows = []
        for i, row in enumerate(table_rows):
            while len(row) < col_count:
                row.append('')
            style = ParagraphStyle('dtTH', parent=styles['TableHeaderCell'], textColor=dt_color) if i == 0 \
                else styles['TableCell']
            pdf_rows.append([Paragraph(xml_escape(str(c)), style) for c in row])
        tbl = Table(pdf_rows, colWidths=col_widths)
        tbl_style = [
            ('BACKGROUND', (0, 0), (-1, 0), dt_bg),
            ('BACKGROUND', (0, 1), (-1, -1), WHITE),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]
        tbl.setStyle(TableStyle(tbl_style))
        elements.append(tbl)

    items = dt_data.get('items', [])
    if items and not table_rows:
        content_rows = []
        for item in items[:20]:
            content_rows.append([Paragraph(
                xml_escape(str(item)),
                ParagraphStyle('dtItem', parent=styles['SectionBodyText'], fontSize=9)
            )])
        if content_rows:
            ct = Table(content_rows, colWidths=[515])
            ct.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), dt_bg),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(ct)

    elements.append(Spacer(1, 10))
    return elements


def build_decision_engine_section(de_data, styles, language='da'):
    """Render the Executive Overview / Decision Engine cards matching html_formatter."""
    elements = []
    if not de_data:
        return elements

    status = de_data.get('project_status', 'AT_RISK')
    status_map = {
        'STABLE':   ('STABLE',   SECTION_COLORS_MAP['stable'],   SECTION_LIGHT_BG['health']),
        'AT_RISK':  ('AT RISK',  SECTION_COLORS_MAP['at_risk'],  colors.Color(255/255,251/255,235/255)),
        'CRITICAL': ('CRITICAL', SECTION_COLORS_MAP['critical'], colors.Color(254/255,242/255,242/255)),
    }
    status_label, status_color, status_bg = status_map.get(status, status_map['AT_RISK'])

    top_title = 'Ledelsesoverblik' if language == 'da' else 'Executive Overview'
    issue_label = 'Største problem' if language == 'da' else 'Biggest Issue'
    impact_label = 'Konsekvens' if language == 'da' else 'Impact'
    why_label = 'Hvorfor' if language == 'da' else 'Why'
    focus_label = 'Fokus' if language == 'da' else 'Focus'
    risk_title = 'Største Risiko' if language == 'da' else 'Biggest Risk'
    blocking_label = 'Blokerer' if language == 'da' else 'What It Blocks'
    delay_label = 'Potentiel forsinkelse' if language == 'da' else 'Potential Delay'
    action_label = 'Din næste handling' if language == 'da' else 'Your Next Action'
    impact_title = 'Estimeret Konsekvens' if language == 'da' else 'Estimated Impact'
    time_label = 'Tid' if language == 'da' else 'Time'
    cost_label = 'Omkostning' if language == 'da' else 'Cost'
    phases_label = 'Faser' if language == 'da' else 'Phases'
    conf_title = 'Tillidsniveau' if language == 'da' else 'Confidence Level'
    basis_label = 'Grundlag' if language == 'da' else 'Basis'

    # ── Executive Overview card ──────────────────────────────────────────────
    header_row = [[Paragraph(
        f'<b>{xml_escape(top_title)}</b>  '
        f'<font color="#{int(status_color.red*255):02x}{int(status_color.green*255):02x}{int(status_color.blue*255):02x}">'
        f'[{status_label}]</font>',
        ParagraphStyle('deTitle', parent=styles['SectionHeader'], textColor=WHITE, fontSize=12)
    )]]
    hdr_table = Table(header_row, colWidths=[515])
    hdr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), status_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(hdr_table)

    kv_rows = []
    if de_data.get('biggest_issue'):
        kv_rows.append([
            Paragraph(f'<b>{xml_escape(issue_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['biggest_issue'])), styles['SectionBodyBold'])
        ])
    if de_data.get('impact_time'):
        kv_rows.append([
            Paragraph(f'<b>{xml_escape(impact_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['impact_time'])), styles['SectionBodyText'])
        ])
    if de_data.get('why'):
        kv_rows.append([
            Paragraph(f'<b>{xml_escape(why_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['why'])), styles['SectionBodyText'])
        ])
    if de_data.get('focus'):
        kv_rows.append([
            Paragraph(f'<b>{xml_escape(focus_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['focus'])), styles['SectionBodyText'])
        ])

    if kv_rows:
        kv_t = Table(kv_rows, colWidths=[110, 405])
        kv_t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), status_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (0, -1), 12),
            ('LEFTPADDING', (1, 0), (1, -1), 10),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(kv_t)
    elements.append(Spacer(1, 10))

    # ── Biggest Risk card ────────────────────────────────────────────────────
    risk_color = SECTION_COLORS_MAP['critical']
    risk_bg = colors.Color(254/255, 242/255, 242/255)
    risk_rows = []
    if de_data.get('biggest_risk'):
        risk_rows.append([
            Paragraph(f'<b>{xml_escape(risk_title)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['biggest_risk'])), styles['SectionBodyBold'])
        ])
    if de_data.get('risk_blocking'):
        risk_rows.append([
            Paragraph(f'<b>{xml_escape(blocking_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['risk_blocking'])), styles['SectionBodyText'])
        ])
    if de_data.get('risk_delay'):
        risk_rows.append([
            Paragraph(f'<b>{xml_escape(delay_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['risk_delay'])), styles['SectionBodyText'])
        ])
    if de_data.get('risk_action'):
        risk_rows.append([
            Paragraph(f'<b>{xml_escape(action_label)}</b>', styles['TableCell']),
            Paragraph(xml_escape(str(de_data['risk_action'])), styles['SectionBodyText'])
        ])
    if risk_rows:
        rh = Table([[Paragraph(f'<b>{xml_escape(risk_title)}</b>',
                               ParagraphStyle('riskH', parent=styles['SummaryHeading'], textColor=WHITE, fontSize=11))]],
                   colWidths=[515])
        rh.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), risk_color),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(rh)
        rt = Table(risk_rows, colWidths=[130, 385])
        rt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), risk_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (0, -1), 12),
            ('LEFTPADDING', (1, 0), (1, -1), 10),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(rt)

        # ── "If Nothing Changes" predictive block (amber) ────────────────────
        if_nothing_delay = de_data.get('if_nothing_delay', '')
        if_nothing_bottleneck = de_data.get('if_nothing_bottleneck', '')
        if_nothing_next_issue = de_data.get('if_nothing_next_issue', '')
        if if_nothing_delay or if_nothing_bottleneck or if_nothing_next_issue:
            amber_pred = colors.Color(253/255, 230/255, 138/255)
            amber_pred_bg = colors.Color(255/255, 251/255, 235/255)
            amber_pred_text = colors.Color(120/255, 53/255, 15/255)
            amber_pred_label = colors.Color(146/255, 64/255, 14/255)
            if_nothing_title = 'Hvis intet ændres' if language == 'da' else 'If Nothing Changes'
            if_nothing_delay_label = 'Estimeret forsinkelse' if language == 'da' else 'Estimated Delay'
            if_nothing_bottleneck_label = 'Næste flaskehals' if language == 'da' else 'Next Bottleneck'
            if_nothing_next_issue_label = 'Næste kritiske problem' if language == 'da' else 'Next Critical Issue'

            pred_header = Table([[Paragraph(
                f'\u23e9  <b>{xml_escape(if_nothing_title)}</b>',
                ParagraphStyle('predH', parent=styles['SummaryHeading'], textColor=amber_pred_label, fontSize=10)
            )]], colWidths=[515])
            pred_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), amber_pred_bg),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LINEABOVE', (0, 0), (-1, 0), 1, amber_pred),
            ]))
            elements.append(pred_header)

            pred_rows = []
            if if_nothing_delay:
                pred_rows.append([
                    Paragraph(f'<b>{xml_escape(if_nothing_delay_label)}</b>',
                              ParagraphStyle('predLbl', parent=styles['TableCell'], textColor=amber_pred_label, fontSize=8)),
                    Paragraph(xml_escape(str(if_nothing_delay)),
                              ParagraphStyle('predVal', parent=styles['SectionBodyText'], textColor=amber_pred_text, fontSize=8))
                ])
            if if_nothing_bottleneck:
                pred_rows.append([
                    Paragraph(f'<b>{xml_escape(if_nothing_bottleneck_label)}</b>',
                              ParagraphStyle('predLbl2', parent=styles['TableCell'], textColor=amber_pred_label, fontSize=8)),
                    Paragraph(xml_escape(str(if_nothing_bottleneck)),
                              ParagraphStyle('predVal2', parent=styles['SectionBodyText'], textColor=amber_pred_text, fontSize=8))
                ])
            if if_nothing_next_issue:
                pred_rows.append([
                    Paragraph(f'<b>{xml_escape(if_nothing_next_issue_label)}</b>',
                              ParagraphStyle('predLbl3', parent=styles['TableCell'], textColor=amber_pred_label, fontSize=8)),
                    Paragraph(xml_escape(str(if_nothing_next_issue)),
                              ParagraphStyle('predVal3', parent=styles['SectionBodyText'], textColor=amber_pred_text, fontSize=8))
                ])
            if pred_rows:
                pred_table = Table(pred_rows, colWidths=[130, 385])
                pred_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), amber_pred_bg),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (0, -1), 12),
                    ('LEFTPADDING', (1, 0), (1, -1), 10),
                    ('LINEBELOW', (0, 0), (-1, -2), 0.5, amber_pred),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LINEBELOW', (0, -1), (-1, -1), 1, amber_pred),
                ]))
                elements.append(pred_table)

        elements.append(Spacer(1, 10))

    # ── Estimated Impact card ────────────────────────────────────────────────
    amber = SECTION_COLORS_MAP['impact']
    amber_bg = SECTION_LIGHT_BG['impact']
    impact_rows = []
    for lbl, key in [(time_label, 'impact_time'), (cost_label, 'impact_cost'), (phases_label, 'impact_phases')]:
        if de_data.get(key):
            impact_rows.append([
                Paragraph(f'<b>{xml_escape(lbl)}</b>', styles['TableCell']),
                Paragraph(xml_escape(str(de_data[key])), styles['SectionBodyText'])
            ])
    if impact_rows:
        ih = Table([[Paragraph(f'<b>{xml_escape(impact_title)}</b>',
                               ParagraphStyle('impH', parent=styles['SummaryHeading'], textColor=WHITE, fontSize=11))]],
                   colWidths=[515])
        ih.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), amber),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(ih)
        it = Table(impact_rows, colWidths=[80, 435])
        it.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), amber_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (0, -1), 12),
            ('LEFTPADDING', (1, 0), (1, -1), 10),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(it)
        elements.append(Spacer(1, 10))

    # ── Confidence Level card ────────────────────────────────────────────────
    confidence = de_data.get('confidence', 'MEDIUM')
    conf_color_map = {
        'HIGH':   SECTION_COLORS_MAP['stable'],
        'MEDIUM': SECTION_COLORS_MAP['at_risk'],
        'LOW':    SECTION_COLORS_MAP['critical'],
    }
    conf_label_map = {
        'HIGH':   ('HIGH', 'HØJ'),
        'MEDIUM': ('MEDIUM', 'MODERAT'),
        'LOW':    ('LOW', 'LAV'),
    }
    cc = conf_color_map.get(confidence, conf_color_map['MEDIUM'])
    cl = conf_label_map.get(confidence, conf_label_map['MEDIUM'])
    conf_display = cl[1] if language == 'da' else cl[0]
    conf_basis = de_data.get('confidence_basis', '')
    conf_text = f'<b>{xml_escape(conf_title)}:</b>  {xml_escape(conf_display)}'
    if conf_basis:
        conf_text += f'  —  <i>{xml_escape(str(conf_basis))}</i>'
    conf_row = Table([[Paragraph(conf_text, ParagraphStyle(
        'confRow', parent=styles['SectionBodyText'], textColor=DARK_SUBHEADER, fontSize=9
    ))]], colWidths=[515])
    conf_row.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINERIGHT', (0, 0), (0, -1), 3, cc),
    ]))
    elements.append(conf_row)
    elements.append(Spacer(1, 14))

    return elements


def extract_section_items(div):
    items = []

    # Priority 1: h4 sub-headings with their following siblings
    for h4 in div.find_all('h4'):
        sub_title = h4.get_text(strip=True)
        if sub_title:
            items.append(f'[{sub_title}]')
        sibling = h4.find_next_sibling()
        while sibling and sibling.name not in ['h2', 'h3', 'h4']:
            # Prefer structured child elements inside sibling
            li_or_p = sibling.find_all(['li', 'p'])
            if li_or_p:
                for el in li_or_p:
                    text = el.get_text(strip=True)
                    text = re.sub(r'^[●•·\u2022\u00b7\u2013\-]\s*', '', text)
                    if text and len(text) > 3:
                        items.append(text)
            else:
                text = sibling.get_text(separator='\n', strip=True)
                if text:
                    for line in text.split('\n'):
                        line = line.strip()
                        if line and len(line) > 5:
                            items.append(line)
            sibling = sibling.find_next_sibling()

    # Priority 2: structured <li> or <p> tags (only if no h4 items found)
    if not items:
        for el in div.find_all(['li', 'p']):
            text = el.get_text(strip=True)
            if text:
                text = re.sub(r'^[●•·\u2022\u00b7\u2013\-]\s*', '', text)
                if text and len(text) > 3:
                    items.append(text)

    # Priority 3: fall back to text splitting — only when no structured items found
    # and only split on bullet characters when item is long enough to be meaningful
    if not items:
        full_text = div.get_text(separator='\n', strip=True)
        heading = div.find(['h2', 'h3'])
        heading_text = heading.get_text(strip=True) if heading else ''
        for line in full_text.split('\n'):
            line = line.strip()
            if not line or line == heading_text:
                continue
            # Only split on bullet chars if the line is a real bullet list
            # (multiple bullet chars present); otherwise keep line as-is
            bullet_count = len(re.findall(r'[●•·]', line))
            if bullet_count > 1:
                for part in re.split(r'[●•·]', line):
                    part = part.strip()
                    if part and len(part) > 10 and part != heading_text:
                        items.append(part)
            else:
                line_clean = re.sub(r'^[●•·\u2022\u00b7\u2013\-]\s*', '', line)
                if line_clean and len(line_clean) > 3 and line_clean != heading_text:
                    items.append(line_clean)

    return items


def extract_root_cause_items(div):
    """Dedicated parser for root-cause-section HTML produced by html_formatter.

    Direct children of the root-cause-section div fall into four types:
      - _render_section_header wrapper (contains h2)  → skip
      - h3-wrapper div (contains h3 cause heading)    → '[Heading]' item
      - cause-items container (flex-column, child cards) → parse cards
      - h4 element (bold_only format)                 → '[Sub-header]' item
      - p element (plain-text fallback)               → plain item

    Each card inside a cause-items container is either:
      - label-value card: 2 div children (icon div + content div)
        content div has <span>LABEL</span><div>value</div>
        → rendered as "Label Title: value text"
      - bullet div: 2 span children (icon span + text span)
        → rendered as the last span's text
    """
    items = []

    for child in div.children:
        if not hasattr(child, 'name') or not child.name:
            continue

        if child.name == 'h2':
            continue

        if child.name == 'h4':
            text = child.get_text(strip=True)
            if text:
                items.append(f'[{text}]')
            continue

        if child.name == 'p':
            text = child.get_text(strip=True)
            if text and len(text) > 5:
                items.append(text)
            continue

        if child.name != 'div':
            continue

        if child.find('h2'):
            continue

        h3 = child.find('h3')
        if h3:
            text = h3.get_text(strip=True)
            if text:
                items.append(f'[{text}]')
            continue

        child_divs = [c for c in child.children
                      if hasattr(c, 'name') and c.name == 'div']
        if child_divs:
            for card in child_divs:
                direct_divs = [c for c in card.children
                               if hasattr(c, 'name') and c.name == 'div']
                direct_spans = [c for c in card.children
                                if hasattr(c, 'name') and c.name == 'span']

                if len(direct_divs) >= 2:
                    content_div = direct_divs[1]
                    label_span = content_div.find('span')
                    value_div = content_div.find('div')
                    if label_span and value_div:
                        label = label_span.get_text(strip=True)
                        value = value_div.get_text(strip=True)
                        if label and value and len(value) > 3:
                            # Labels are stored ALL-CAPS in HTML (CSS text-transform:uppercase).
                            # .title() restores the original Title Case the AI agent wrote.
                            items.append(f'{label.title()}: {value}')
                        elif value and len(value) > 3:
                            items.append(value)
                    elif label_span:
                        text = content_div.get_text(strip=True)
                        if text and len(text) > 5:
                            items.append(text)

                elif len(direct_spans) >= 2:
                    text = direct_spans[-1].get_text(strip=True)
                    if text and len(text) > 5:
                        items.append(text)

                else:
                    text = card.get_text(separator='\n', strip=True)
                    for line in text.split('\n'):
                        line = line.strip()
                        if line and len(line) > 5:
                            items.append(line)
        else:
            text = child.get_text(separator='\n', strip=True)
            for line in text.split('\n'):
                line = line.strip()
                if line and len(line) > 5:
                    items.append(line)

    if not items:
        items = extract_section_items(div)

    return items


def extract_executive_actions(div):
    actions = []
    action_title_divs = div.find_all('div', style=re.compile(r'font-weight:\s*700'))
    for atd in action_title_divs:
        action_text = atd.get_text(strip=True)
        if action_text and len(action_text) > 5:
            detail = ''
            detail_div = atd.find_next_sibling('div')
            if detail_div:
                detail_text = detail_div.get_text(strip=True)
                if detail_text and len(detail_text) > 5:
                    detail = detail_text
            actions.append({'title': action_text, 'detail': detail})

    if not actions:
        items = extract_section_items(div)
        for item in items:
            actions.append({'title': item, 'detail': ''})

    return actions


def parse_complex_html(html_content):
    if not html_content:
        return {'tables': [], 'summary': None, 'health': None, 'results_header': None, 'extra_sections': []}

    soup = BeautifulSoup(html_content, 'html.parser')
    soup = clean_soup(soup)

    result = {
        'tables': [],
        'summary': None,
        'health': None,
        'results_header': None,
        'extra_sections': [],
        'root_cause': None,
        'recommended_actions': None,
        'decision_engine_data': None,
        'data_trust': None,
    }

    # ── Decision Engine / Executive Overview cards ───────────────────────────
    # Try to extract from HTML comment embedded in the agent-response div
    import json as _json
    de_match = re.search(r'<!--DECISION_ENGINE:(.*?)-->', html_content, re.DOTALL)
    if de_match:
        try:
            result['decision_engine_data'] = _json.loads(de_match.group(1))
        except Exception:
            pass


    # Fallback: extract Decision Engine data from HTML divs rendered by html_formatter.
    # The formatter produces 4 sequential sibling divs: executive_top, biggest_risk,
    # estimated_impact, confidence. No CSS class names — only inline styles.
    if not result['decision_engine_data']:
        exec_h2 = soup.find(['h2'], string=re.compile(
            r'^\s*(Executive Overview|Ledelsesoverblik)\s*$', re.I))
        if exec_h2:
            de_data = {}
            de_divs_to_remove = []

            # Navigate up to the outer card div:
            # h2 → inner-wrapper-div → flex-header-row → outer-card
            exec_card = exec_h2
            for _ in range(3):
                if exec_card.parent and exec_card.parent.name in ['div', 'section', 'article']:
                    exec_card = exec_card.parent
            de_divs_to_remove.append(exec_card)

            # Extract status badge from spans (CRITICAL/STABLE/AT RISK and Danish equivalents)
            for span in exec_card.find_all('span'):
                txt = span.get_text(strip=True).upper()
                if txt in ('CRITICAL', 'KRITISK'):
                    de_data['project_status'] = 'CRITICAL'
                    break
                elif txt in ('STABLE', 'STABIL'):
                    de_data['project_status'] = 'STABLE'
                    break
                elif txt in ('AT RISK', 'AT_RISK', 'I RISIKO'):
                    de_data['project_status'] = 'AT_RISK'
                    break

            # Extract field values: label divs have text-transform:uppercase in style,
            # followed by a sibling div containing the value text.
            exec_label_map = {
                'biggest issue': 'biggest_issue', 'største problem': 'biggest_issue',
                'impact': 'impact_time', 'konsekvens': 'impact_time',
                'why': 'why', 'hvorfor': 'why',
                'focus': 'focus', 'fokus': 'focus',
            }
            for d in exec_card.find_all('div'):
                sty = d.get('style', '').replace(' ', '')
                if 'text-transform:uppercase' in sty:
                    lbl = d.get_text(strip=True).lower()
                    if lbl in exec_label_map:
                        val_div = d.find_next_sibling('div')
                        if val_div:
                            de_data[exec_label_map[lbl]] = val_div.get_text(strip=True)

            # Collect next 3 sibling divs = biggest_risk, estimated_impact, confidence cards
            sibling_divs = []
            sib = exec_card.find_next_sibling('div')
            while sib and len(sibling_divs) < 3:
                sibling_divs.append(sib)
                sib = sib.find_next_sibling('div')

            for card in sibling_divs:
                card_text_lower = card.get_text(separator=' ', strip=True).lower()

                if any(t in card_text_lower for t in ['biggest risk', 'største risiko']):
                    de_divs_to_remove.append(card)
                    # biggest_risk text: direct child divs — [0]=header row, [1]=risk text, [2]=grid
                    direct_children = [c for c in card.children if hasattr(c, 'name') and c.name == 'div']
                    if len(direct_children) > 1:
                        de_data['biggest_risk'] = direct_children[1].get_text(strip=True)
                    risk_label_map = {
                        'what it blocks': 'risk_blocking', 'blokerer': 'risk_blocking',
                        'potential delay': 'risk_delay', 'potentiel forsinkelse': 'risk_delay',
                        # "If Nothing Changes" predictive fields
                        'estimated delay': 'if_nothing_delay',
                        'estimeret forsinkelse': 'if_nothing_delay',
                        'next bottleneck': 'if_nothing_bottleneck',
                        'næste flaskehals': 'if_nothing_bottleneck',
                        'next critical issue': 'if_nothing_next_issue',
                        'næste kritiske problem': 'if_nothing_next_issue',
                        # Next Action
                        'next action': 'risk_action', 'din næste handling': 'risk_action',
                        'your next action': 'risk_action', 'næste handling': 'risk_action',
                    }
                    for d in card.find_all('div'):
                        sty = d.get('style', '').replace(' ', '')
                        if 'text-transform:uppercase' in sty:
                            lbl = d.get_text(strip=True).lower()
                            # Strip emoji prefix for matching
                            lbl_clean = re.sub(r'^[\u23e9\u27a1\ufe0f\u2605\s]+', '', lbl).strip()
                            key = risk_label_map.get(lbl_clean) or risk_label_map.get(lbl)
                            if key:
                                val_div = d.find_next_sibling('div')
                                if val_div:
                                    de_data[key] = val_div.get_text(strip=True)

                elif any(t in card_text_lower for t in ['estimated impact', 'estimeret konsekvens']):
                    de_divs_to_remove.append(card)
                    impact_label_map = {
                        'time': 'impact_time', 'tid': 'impact_time',
                        'cost': 'impact_cost', 'omkostning': 'impact_cost',
                        'phases': 'impact_phases', 'faser': 'impact_phases',
                    }
                    for d in card.find_all('div'):
                        sty = d.get('style', '').replace(' ', '')
                        if 'text-transform:uppercase' in sty:
                            lbl = d.get_text(strip=True).lower()
                            if lbl in impact_label_map:
                                val_div = d.find_next_sibling('div')
                                if val_div:
                                    de_data[impact_label_map[lbl]] = val_div.get_text(strip=True)

                elif any(t in card_text_lower for t in ['confidence level', 'tillidsniveau']):
                    de_divs_to_remove.append(card)
                    # Find the confidence badge span (has border-radius:20px styling)
                    for span in card.find_all('span'):
                        sty = span.get('style', '').replace(' ', '')
                        if 'border-radius:20px' in sty:
                            conf_txt = span.get_text(strip=True).upper()
                            if 'HIGH' in conf_txt or 'HØJ' in conf_txt:
                                de_data['confidence'] = 'HIGH'
                            elif 'LOW' in conf_txt or 'LAV' in conf_txt:
                                de_data['confidence'] = 'LOW'
                            else:
                                de_data['confidence'] = 'MEDIUM'
                            break
                    # Find basis text (italic span)
                    for span in card.find_all('span'):
                        sty = span.get('style', '')
                        if 'italic' in sty:
                            basis_txt = span.get_text(strip=True)
                            basis_txt = re.sub(r'^(Basis|Grundlag):\s*', '', basis_txt, flags=re.I)
                            if basis_txt:
                                de_data['confidence_basis'] = basis_txt
                            break

            if de_data:
                result['decision_engine_data'] = de_data

            # Remove all identified decision engine divs from soup
            for div in de_divs_to_remove:
                try:
                    div.decompose()
                except Exception:
                    pass

    # Extract from section-biggest-risk-detail (new formatter — standalone detailed risk card)
    risk_detail_div = soup.find('div', id='section-biggest-risk-detail')
    if risk_detail_div:
        if not result['decision_engine_data']:
            result['decision_engine_data'] = {}
        de_data = result['decision_engine_data']
        for sub in risk_detail_div.find_all('div', recursive=False):
            label_div = sub.find('div', style=re.compile(r'text-transform\s*:\s*uppercase', re.I))
            if not label_div:
                continue
            label_text = label_div.get_text(strip=True).lower()
            val_div = label_div.find_next_sibling('div')
            if not val_div:
                continue
            val_text = val_div.get_text(strip=True)
            if not val_text:
                continue
            if '➡' in label_text or 'your next action' in label_text or 'din næste' in label_text:
                de_data['risk_action'] = val_text
            elif '⚠' in label_text or 'the issue' in label_text or 'problemet' in label_text:
                if not de_data.get('biggest_risk'):
                    de_data['biggest_risk'] = val_text
            elif '🔗' in label_text or 'what it is blocking' in label_text or 'blokerer' in label_text:
                if not de_data.get('risk_blocking'):
                    de_data['risk_blocking'] = val_text
        risk_detail_div.decompose()

    # Always extract risk_action from raw HTML using regex — the live formatter adds a
    # "➡️ Next Action" / "Din næste handling" block inside section-biggest-risk but
    # never includes it in the DECISION_ENGINE JSON comment.
    # Pattern: an uppercase label div containing "Next Action" / "Næste Handling" followed
    # immediately by a sibling div containing the action text.
    _action_re = re.search(
        r'text-transform\s*:\s*uppercase[^>]*>(?:[^<]{0,10})?'
        r'(?:Next\s+Action|Your\s+Next\s+Action|N(?:æ|ae)ste\s+[Hh]andling|Din\s+[Nn](?:æ|ae)ste\s+[Hh]andling)'
        r'[^<]{0,30}</div>\s*<div[^>]*>(.*?)</div>',
        html_content,
        re.IGNORECASE | re.DOTALL,
    )
    if _action_re:
        _action_text = re.sub(r'<[^>]+>', '', _action_re.group(1)).strip()
        if _action_text:
            if result['decision_engine_data'] is None:
                result['decision_engine_data'] = {}
            if not result['decision_engine_data'].get('risk_action'):
                result['decision_engine_data']['risk_action'] = _action_text

    # ── "If Nothing Changes" block extraction ──────────────────────────────────
    # The live html_formatter embeds this as:
    #   <div ...text-transform:uppercase...>⏩ If Nothing Changes</div>
    #   <div ...><span ...>Estimated Delay:</span> VALUE</div>
    #   <div ...><span ...>Next Bottleneck:</span> VALUE</div>
    #   <div ...><span ...>Next Critical Issue:</span> VALUE</div>
    # These are NOT in the DECISION_ENGINE JSON, so we must extract from HTML.
    _if_nothing_de = result['decision_engine_data'] if result['decision_engine_data'] is not None else None

    # Only extract if not already populated from the JSON comment
    if not (_if_nothing_de and (_if_nothing_de.get('if_nothing_delay')
                                 or _if_nothing_de.get('if_nothing_bottleneck')
                                 or _if_nothing_de.get('if_nothing_next_issue'))):
        # BeautifulSoup approach: find any div whose text contains the heading
        _if_nothing_container = None
        for _d in soup.find_all('div'):
            _dt = _d.get_text(separator=' ', strip=True)
            if re.search(r'if\s+nothing\s+changes|hvis\s+intet\s+[æa]ndres', _dt, re.I):
                # Pick the smallest div that still contains the heading (not giant wrappers)
                if len(_dt) < 600:
                    _if_nothing_container = _d
                    break

        if _if_nothing_container:
            if result['decision_engine_data'] is None:
                result['decision_engine_data'] = {}
            _de = result['decision_engine_data']

            # Map of label text (lowercase, stripped of colons) → field name
            _if_nothing_label_map = {
                'estimated delay': 'if_nothing_delay',
                'estimeret forsinkelse': 'if_nothing_delay',
                'next bottleneck': 'if_nothing_bottleneck',
                'næste flaskehals': 'if_nothing_bottleneck',
                'next critical issue': 'if_nothing_next_issue',
                'næste kritiske problem': 'if_nothing_next_issue',
            }

            # Each data row is a <div> containing a <span> (label) + trailing text (value)
            for _row in _if_nothing_container.find_all('div'):
                _span = _row.find('span')
                if not _span:
                    continue
                _label_raw = _span.get_text(strip=True).lower().rstrip(':').strip()
                _field = _if_nothing_label_map.get(_label_raw)
                if _field and not _de.get(_field):
                    # Value = row text minus the span text
                    _row_text = _row.get_text(separator=' ', strip=True)
                    _span_text = _span.get_text(strip=True)
                    _value = _row_text.replace(_span_text, '', 1).lstrip(':').strip()
                    if _value:
                        _de[_field] = _value

        # Regex fallback: parse label:<span> VALUE pattern directly from HTML string
        if result['decision_engine_data'] is None or not (
                result['decision_engine_data'].get('if_nothing_delay')
                or result['decision_engine_data'].get('if_nothing_bottleneck')
                or result['decision_engine_data'].get('if_nothing_next_issue')):

            _if_nothing_label_re = {
                'if_nothing_delay': r'(?:Estimated\s+Delay|Estimeret\s+forsinkelse)\s*:?\s*</span>\s*(.*?)(?:</div>|<span)',
                'if_nothing_bottleneck': r'(?:Next\s+Bottleneck|N[æa]ste\s+flaskehals)\s*:?\s*</span>\s*(.*?)(?:</div>|<span)',
                'if_nothing_next_issue': r'(?:Next\s+Critical\s+Issue|N[æa]ste\s+kritiske\s+problem)\s*:?\s*</span>\s*(.*?)(?:</div>|<span)',
            }
            for _field, _pat in _if_nothing_label_re.items():
                _m = re.search(_pat, html_content, re.IGNORECASE | re.DOTALL)
                if _m:
                    _val = re.sub(r'<[^>]+>', '', _m.group(1)).strip()
                    if _val:
                        if result['decision_engine_data'] is None:
                            result['decision_engine_data'] = {}
                        if not result['decision_engine_data'].get(_field):
                            result['decision_engine_data'][_field] = _val

    rec_div = soup.find('div', class_='recommended-actions') or soup.find('div', class_='executive-section')
    if rec_div:
        h = rec_div.find(['h2', 'h3'])
        title = h.get_text(strip=True) if h else 'Recommended Actions'
        actions = extract_executive_actions(rec_div)
        if actions:
            result['recommended_actions'] = {'title': title, 'actions': actions}
        rec_div.decompose()

    comp_div = soup.find('div', class_='comparison-results')
    if comp_div:
        h = comp_div.find(['h3', 'h2'])
        if h:
            header_text = h.get_text(strip=True)
            p = h.find_next_sibling('p')
            if p:
                count_text = p.get_text(strip=True)
                result['results_header'] = f"{header_text} \u2014 {count_text}"
            else:
                result['results_header'] = header_text

        cat_sections = comp_div.find_all('div', class_='category-section')
        for cat_div in cat_sections:
            cat_heading_div = cat_div.find('div', style=re.compile(r'display:\s*flex.*align-items:\s*center'))
            if not cat_heading_div:
                cat_heading_div = cat_div

            cat_text = ''
            h_el = cat_div.find(['h3', 'h4'])
            if h_el:
                cat_text = h_el.get_text(strip=True)
            if not cat_text:
                cat_text = cat_heading_div.get_text(strip=True)[:100] if cat_heading_div else ''

            group_name = detect_group_name(cat_text) or 'Other'
            count_match = re.search(r'(\d+)', cat_text)
            cat_count = int(count_match.group(1)) if count_match else 0

            table = cat_div.find('table')
            if not table:
                continue

            headers = []
            for th in table.find_all('th'):
                h_text = get_cell_text(th)
                if h_text:
                    headers.append(h_text)
            if not headers:
                continue

            rows = []
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr', recursive=False):
                cells = tr.find_all(['td'], recursive=False)
                row_data = [get_cell_text(cell) for cell in cells]
                if not row_data or all(not c for c in row_data):
                    continue
                if row_data == headers:
                    continue
                while len(row_data) < len(headers):
                    row_data.append('\u2014')
                row_data = row_data[:len(headers)]
                rows.append(row_data)

            if rows:
                result['tables'].append({
                    'headers': headers,
                    'groups': [{
                        'name': group_name,
                        'count': cat_count or len(rows),
                        'rows': rows
                    }]
                })

    if not result['tables']:
        for table in soup.find_all('table'):
            headers = []
            thead = table.find('thead')
            if thead:
                for th in thead.find_all(['th', 'td']):
                    h_text = get_cell_text(th)
                    if h_text:
                        headers.append(h_text)

            if not headers:
                for tr in table.find_all('tr'):
                    cells = tr.find_all(['th', 'td'], recursive=False)
                    def _safe_colspan(c):
                        try:
                            return int(c.get('colspan', 1)) > 1
                        except (ValueError, TypeError):
                            return False
                    has_cs = any(_safe_colspan(c) for c in cells if c.get('colspan'))
                    if has_cs and detect_group_name(get_cell_text(cells[0])):
                        continue
                    if len(cells) >= 2:
                        headers = [get_cell_text(c) for c in cells]
                        break

            if not headers:
                continue

            groups = []
            current_group = None
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr', recursive=False):
                cells = tr.find_all(['td', 'th'], recursive=False)
                def _safe_cs(c):
                    try:
                        return int(c.get('colspan', 1)) > 1
                    except (ValueError, TypeError):
                        return False
                has_colspan = any(_safe_cs(c) for c in cells if c.get('colspan'))

                if has_colspan and len(cells) <= 2:
                    group_text = get_cell_text(cells[0])
                    gn = detect_group_name(group_text)
                    if gn:
                        cm = re.search(r'\((\d+)\)', group_text) or re.search(r'(\d+)', group_text)
                        current_group = {'name': gn, 'count': int(cm.group(1)) if cm else 0, 'rows': []}
                        groups.append(current_group)
                    continue

                row_data = [get_cell_text(c) for c in cells]
                if not row_data or all(not c for c in row_data) or row_data == headers:
                    continue
                while len(row_data) < len(headers):
                    row_data.append('\u2014')
                row_data = row_data[:len(headers)]

                if current_group:
                    current_group['rows'].append(row_data)
                else:
                    if not groups:
                        current_group = {'name': 'Other', 'count': 0, 'rows': []}
                        groups.append(current_group)
                    groups[-1]['rows'].append(row_data)

            for g in groups:
                if g['count'] == 0:
                    g['count'] = len(g['rows'])
            if headers and groups:
                result['tables'].append({'headers': headers, 'groups': groups})

    # ── Data Trust section (new in html_formatter v2) ────────────────────────
    data_trust_div = soup.find('div', id='section-data-trust')
    if not data_trust_div:
        for div in soup.find_all('div'):
            h = div.find(['h2', 'h3'])
            if h and re.search(r'Data Trust|Datagrundlag', h.get_text(strip=True), re.I):
                data_trust_div = div
                break
    if data_trust_div:
        h = data_trust_div.find(['h2', 'h3'])
        title = h.get_text(strip=True) if h else 'Data Trust — Analysis Basis'
        items = []
        table_rows = []
        tbl = data_trust_div.find('table')
        if tbl:
            for tr in tbl.find_all('tr'):
                cells = tr.find_all(['td', 'th'])
                row = [c.get_text(strip=True) for c in cells]
                if row and any(r for r in row):
                    table_rows.append(row)
        for child_div in data_trust_div.find_all('div', recursive=False):
            txt = child_div.get_text(separator=' ', strip=True)
            if txt and len(txt) > 5 and txt != title:
                for line in txt.split('\n'):
                    line = line.strip()
                    if line and len(line) > 5 and line != title:
                        items.append(line)
        if not items:
            full_text = data_trust_div.get_text(separator='\n', strip=True)
            for line in full_text.split('\n'):
                line = line.strip()
                if line and len(line) > 5 and line != title:
                    items.append(line)
        if items or table_rows:
            result['data_trust'] = {'title': title, 'items': items, 'table_rows': table_rows}
        data_trust_div.decompose()

    root_cause_div = soup.find('div', class_='root-cause-section')
    if root_cause_div:
        h2 = root_cause_div.find('h2')
        title = h2.get_text(strip=True) if h2 else 'Root Cause Analysis'
        items = extract_root_cause_items(root_cause_div)
        items = [it for it in items if it != title]
        if items:
            result['root_cause'] = {'title': title, 'items': items}
        root_cause_div.decompose()

    impact_div = soup.find('div', class_='impact-section')
    if impact_div:
        h = impact_div.find(['h2', 'h3'])
        title = h.get_text(strip=True) if h else 'Impact Assessment'
        items = extract_section_items(impact_div)
        h_text = h.get_text(strip=True) if h else ''
        items = [it for it in items if it != h_text and it != title]
        if items:
            result['extra_sections'].append({'title': title, 'items': items})
        impact_div.decompose()

    summary_div = soup.find('div', class_='summary-section')
    if summary_div:
        summary_data = {'title': 'Summary of Changes', 'sections': []}
        h2 = summary_div.find('h2')
        if h2:
            summary_data['title'] = h2.get_text(strip=True)

        for h4 in summary_div.find_all('h4'):
            section_title = h4.get_text(strip=True)
            items = []
            sibling = h4.find_next_sibling()
            while sibling and sibling.name not in ['h2', 'h3', 'h4']:
                text = sibling.get_text(separator='\n', strip=True)
                if text:
                    for line in text.split('\n'):
                        line = line.strip()
                        if line and len(line) > 5:
                            items.append(line)
                sibling = sibling.find_next_sibling()
            if items:
                summary_data['sections'].append({'title': section_title, 'items': items})

        if not summary_data['sections']:
            full_text = summary_div.get_text(separator='\n', strip=True)
            current_title = ''
            current_items = []
            for line in full_text.split('\n'):
                line = line.strip()
                if not line or line == summary_data['title']:
                    continue
                if re.match(r'^[A-Z][\w\s]+$', line) and len(line) < 40:
                    if current_items:
                        summary_data['sections'].append({'title': current_title, 'items': current_items})
                    current_title = line
                    current_items = []
                else:
                    for part in re.split(r'[●•·]', line):
                        part = part.strip()
                        if part and len(part) > 3 and part != summary_data['title']:
                            current_items.append(part)
            if current_items:
                summary_data['sections'].append({'title': current_title, 'items': current_items})

        if summary_data['sections']:
            result['summary'] = summary_data
        summary_div.decompose()

    if not result['summary']:
        for div in soup.find_all(['div', 'section']):
            h = div.find(['h2', 'h3'])
            if h and re.search(r'Summary|Opsummering|Sammenfatning', h.get_text(strip=True), re.I):
                items = extract_section_items(div)
                heading = h.get_text(strip=True)
                items = [it for it in items if it != heading]
                if items:
                    result['summary'] = {'title': heading, 'sections': [{'title': '', 'items': items}]}
                break

    health_div = soup.find('div', class_='health-section')
    if health_div:
        health_data = {'title': 'Project Health', 'status': '', 'items': [],
                       'trend': '', 'confidence': '', 'risk_level': ''}
        h2 = health_div.find('h2')
        if h2:
            health_data['title'] = h2.get_text(strip=True)

        for sp in health_div.find_all('span'):
            txt = sp.get_text(strip=True)
            # Status badge (On Track / At Risk / Critical and Danish equivalents)
            if re.search(r'^(on track|at risk|critical|stabil|sund|på rette spor|risiko|kritisk)', txt, re.I):
                if not health_data['status']:
                    health_data['status'] = txt
            # Legacy status terms
            elif re.search(r'^(stable|healthy|warning|high risk|opm)', txt, re.I):
                if not health_data['status']:
                    health_data['status'] = txt
            # Trend badge: "Improving/Stable/Worsening" or Danish
            elif re.search(r'(improving|worsening|forbedring|forværring)', txt, re.I):
                health_data['trend'] = txt
            elif txt in ('Stable', 'Stabil') and not health_data['trend']:
                health_data['trend'] = txt
            # Confidence badge
            elif re.search(r'confidence|sikkerhed', txt, re.I):
                health_data['confidence'] = txt
            # Risk level badge
            elif re.search(r'(low risk|medium risk|high risk|lav risiko|moderat risiko|høj risiko)', txt, re.I):
                health_data['risk_level'] = txt

        # Also scan text for trend/confidence if spans didn't catch them
        if not health_data['trend']:
            full_text = health_div.get_text(' ', strip=True)
            if re.search(r'(Improving|Forbedring)', full_text, re.I):
                health_data['trend'] = 'Improving'
            elif re.search(r'(Worsening|Forværring)', full_text, re.I):
                health_data['trend'] = 'Worsening'
            elif re.search(r'\bStable\b|\bStabil\b', full_text, re.I):
                health_data['trend'] = 'Stable'

        items = extract_section_items(health_div)
        heading = health_data['title']
        items = [it for it in items if it != heading and it.lower() != health_data['status'].lower()
                 and it != 'Project Health' and len(it) > 3]
        health_data['items'] = items

        if health_data['title'] or health_data['items']:
            result['health'] = health_data
        health_div.decompose()

    if not result['health']:
        for div in soup.find_all(['div', 'section']):
            h = div.find(['h2', 'h3'])
            if h and re.search(r'Health|Sundhed|Projektsundhed', h.get_text(strip=True), re.I):
                heading = h.get_text(strip=True)
                items = extract_section_items(div)
                items = [it for it in items if it != heading]
                status = ''
                for sp in div.find_all('span'):
                    txt = sp.get_text(strip=True)
                    if re.search(r'stable|healthy|warning|critical|stabil|sund', txt, re.I):
                        status = txt
                        break
                result['health'] = {'title': heading, 'status': status, 'items': items}
                break

    if not result['extra_sections'] and not result['recommended_actions']:
        for div in soup.find_all(['div', 'section']):
            h = div.find(['h2', 'h3'])
            if not h:
                continue
            heading = h.get_text(strip=True)
            if re.search(r'Executive|Root Cause|Impact|Assessment|Vurdering|Analyse', heading, re.I):
                items = extract_section_items(div)
                items = [it for it in items if it != heading]
                if items:
                    result['extra_sections'].append({'title': heading, 'items': items})

    return result


def build_cover_page(story, styles, title_text, subtitle_text, meta_items, language='da'):
    t = {
        'da': {'confidential': 'Fortroligt Dokument', 'powered': 'Drevet af Nordic AI Group ApS'},
        'en': {'confidential': 'Confidential Document', 'powered': 'Powered by Nordic AI Group ApS'}
    }.get(language, {})
    t = t or {'confidential': 'Confidential Document', 'powered': 'Powered by Nordic AI Group ApS'}

    story.append(Spacer(1, 60))

    logo_used = False
    if os.path.exists(LOGO_PATH):
        try:
            logo = Image(LOGO_PATH, width=200, height=67)
            logo.hAlign = 'CENTER'
            story.append(logo)
            logo_used = True
            story.append(Spacer(1, 30))
        except Exception as e:
            print(f"Could not load wide logo: {e}")

    if not logo_used and os.path.exists(FAVICON_PATH):
        try:
            logo = Image(FAVICON_PATH, width=70, height=58)
            logo.hAlign = 'CENTER'
            story.append(logo)
            story.append(Spacer(1, 15))
        except Exception as e:
            print(f"Could not load favicon logo: {e}")

    if not logo_used:
        story.append(Paragraph('NORDIC AI GROUP ApS', styles['CoverCompany']))
        story.append(Paragraph('AUTOMATE SMARTER', styles['CoverTagline']))

    d = Drawing(515, 4)
    d.add(Rect(0, 1, 515, 2, fillColor=CYAN_PRIMARY, strokeColor=None))
    story.append(d)
    story.append(Spacer(1, 35))

    story.append(Paragraph(title_text, styles['CoverTitle']))
    story.append(Spacer(1, 6))
    if subtitle_text:
        file_icon = '\u25a0'
        safe_subtitle = xml_escape(subtitle_text)
        story.append(Paragraph(f'{file_icon} {safe_subtitle}', styles['CoverSubtitle']))

    story.append(Spacer(1, 35))

    if meta_items:
        meta_rows = []
        for label, value in meta_items:
            safe_value = xml_escape(str(value)) if value else ''
            safe_label = xml_escape(str(label)) if label else ''
            meta_rows.append([
                Paragraph(f'{safe_label}', styles['CoverMetaLabel']),
                Paragraph(f'<b>{safe_value}</b>', styles['CoverMetaValue'])
            ])

        meta_table = Table(meta_rows, colWidths=[140, 330])
        meta_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 9),
            ('LEFTPADDING', (0, 0), (0, -1), 10),
            ('LEFTPADDING', (1, 0), (1, -1), 20),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
        ]))
        story.append(meta_table)

    story.append(Spacer(1, 80))

    d2 = Drawing(515, 1)
    d2.add(Rect(0, 0, 515, 1, fillColor=BORDER_GRAY, strokeColor=None))
    story.append(d2)
    story.append(Spacer(1, 15))

    story.append(Paragraph(t['confidential'], styles['FooterText']))
    story.append(Spacer(1, 6))
    story.append(Paragraph(t['powered'], styles['FooterText']))


def build_user_message_bubble(content, styles):
    user_para = Paragraph(content, styles['UserMessage'])
    bubble = Table(
        [[user_para]],
        colWidths=[360]
    )
    bubble.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CYAN_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, -1), WHITE),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [8, 8, 0, 8]),
    ]))
    bubble.hAlign = 'RIGHT'
    return bubble


def build_grouped_table(headers, rows, styles, group_type='Other', language='da'):
    col_count = len(headers)
    available_width = 515

    col_map = {}
    for i, h in enumerate(headers):
        h_lower = h.lower()
        if any(k in h_lower for k in ['task', 'opgave', 'name', 'navn']):
            col_map['task_name'] = i
        elif any(k in h_lower for k in ['diff', 'forskell', 'difference', 'forskel']):
            col_map['difference'] = i
        elif 'note' in h_lower:
            col_map['notes'] = i
        elif any(k in h_lower for k in ['risk', 'risiko']):
            col_map['risk'] = i
        elif any(k in h_lower for k in ['comment', 'kommentar']):
            col_map['comment'] = i
        elif 'id' == h_lower or h_lower == 'nr':
            col_map['id'] = i
        elif any(k in h_lower for k in ['area', 'omr']):
            col_map['area'] = i

    if col_count <= 3:
        col_widths = [available_width / col_count] * col_count
    elif col_count == 4:
        col_widths = [40, 160, 100, 215]
    elif col_count == 5:
        col_widths = [35, 140, 85, 85, 170]
    elif col_count == 6:
        col_widths = [30, 120, 55, 75, 85, 150]
    elif col_count == 7:
        col_widths = [28, 105, 45, 65, 65, 80, 127]
    else:
        col_widths = [available_width / col_count] * col_count

    total = sum(col_widths[:col_count])
    if abs(total - available_width) > 1:
        ratio = available_width / total
        col_widths = [w * ratio for w in col_widths[:col_count]]
    col_widths = col_widths[:col_count]

    gc = GROUP_COLORS.get(group_type, GROUP_COLORS['Other'])

    table_data = []
    header_row = []
    for h in headers:
        header_row.append(Paragraph(f'<b>{h.upper()}</b>', styles['TableHeaderCell']))
    table_data.append(header_row)

    for row in rows:
        row_data = []
        for i, cell in enumerate(row):
            cell_text = str(cell) if cell else '\u2014'
            if len(cell_text) > 150:
                cell_text = cell_text[:147] + '...'

            if i == col_map.get('task_name'):
                row_data.append(Paragraph(cell_text, styles['TableCellBold']))
            elif i == col_map.get('difference'):
                diff_type = classify_diff_value(cell_text)
                if diff_type == 'positive':
                    row_data.append(Paragraph(cell_text, styles['DiffPositive']))
                elif diff_type == 'negative':
                    row_data.append(Paragraph(cell_text, styles['DiffNegative']))
                else:
                    row_data.append(Paragraph(cell_text, styles['DiffNeutral']))
            elif i == col_map.get('notes') or i == col_map.get('comment'):
                row_data.append(Paragraph(cell_text, styles['NotesCell']))
            elif i == col_map.get('risk'):
                row_data.append(Paragraph(cell_text, styles['NotesCell']))
            elif i == col_map.get('id'):
                row_data.append(Paragraph(cell_text, styles['TableCell']))
            else:
                row_data.append(Paragraph(cell_text, styles['TableCell']))

        while len(row_data) < col_count:
            row_data.append(Paragraph('\u2014', styles['TableCell']))
        row_data = row_data[:col_count]
        table_data.append(row_data)

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), gc['header']),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, 0), 6),
        ('RIGHTPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 1), (-1, -1), 5),
        ('RIGHTPADDING', (0, 1), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 1, gc['header']),
        ('LINEBELOW', (0, 1), (-1, -1), 0.3, BORDER_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ])

    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_style.add('BACKGROUND', (0, i), (-1, i), gc['bg'])
        else:
            table_style.add('BACKGROUND', (0, i), (-1, i), WHITE)

    table.setStyle(table_style)
    return table


def build_executive_actions_section(exec_data, styles):
    elements = []
    EXEC_HEADER = colors.HexColor('#1e3a5f')
    EXEC_BG = colors.HexColor('#f0f7ff')

    title_row = [[Paragraph(f'<b>{exec_data["title"]}</b>', ParagraphStyle(
        'exectitle', parent=styles['SummaryHeading'], textColor=WHITE, fontSize=12
    ))]]
    title_table = Table(title_row, colWidths=[515])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), EXEC_HEADER),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(title_table)

    content_rows = []
    for i, action in enumerate(exec_data.get('actions', []), 1):
        content_rows.append([Paragraph(
            f'<b>{i}. {xml_escape(action["title"])}</b>',
            ParagraphStyle('execaction', parent=styles['SummaryHeading'], fontSize=10, textColor=colors.HexColor('#0f172a'))
        )])
        if action.get('detail'):
            content_rows.append([Paragraph(
                xml_escape(action['detail']),
                ParagraphStyle('execdetail', parent=styles['SummaryItem'], fontSize=8, textColor=colors.HexColor('#475569'))
            )])

    if content_rows:
        content_table = Table(content_rows, colWidths=[515])
        content_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), EXEC_BG),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(content_table)

    elements.append(Spacer(1, 14))
    return elements


def build_summary_section(summary_data, styles):
    elements = []

    title_row = [[Paragraph(f'<b>{summary_data["title"]}</b>', ParagraphStyle(
        'sumtitle', parent=styles['SummaryHeading'], textColor=WHITE, fontSize=12
    ))]]
    title_table = Table(title_row, colWidths=[515])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PURPLE_HEADER),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(title_table)

    content_rows = []
    for section in summary_data.get('sections', []):
        if section.get('title'):
            content_rows.append([Paragraph(f'<b>{section["title"]}</b>', styles['SummaryHeading'])])
        for item in section.get('items', []):
            content_rows.append([Paragraph(f'\u2022  {item}', styles['SummaryItem'])])

    if content_rows:
        content_table = Table(content_rows, colWidths=[515])
        content_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PURPLE_LIGHT),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(content_table)

    elements.append(Spacer(1, 14))
    return elements


def build_health_section(health_data, styles):
    elements = []

    title_text = health_data.get('title', 'Project Health')
    status_text = health_data.get('status', '')
    trend_text = health_data.get('trend', '')
    risk_level_text = health_data.get('risk_level', '')
    confidence_text = health_data.get('confidence', '')

    # Determine header colour from status
    lower_s = status_text.lower() if status_text else ''
    if any(k in lower_s for k in ['critical', 'kritisk']):
        header_color = SECTION_COLORS_MAP['critical']
        content_bg = colors.Color(254/255, 242/255, 242/255)
    elif any(k in lower_s for k in ['risk', 'risiko', 'attention']):
        header_color = SECTION_COLORS_MAP['at_risk']
        content_bg = colors.Color(255/255, 251/255, 235/255)
    else:
        header_color = GREEN_HEALTH
        content_bg = GREEN_HEALTH_LIGHT

    title_content = f'<b>{xml_escape(title_text)}</b>'
    if status_text:
        title_content += f'  \u2014  {xml_escape(status_text)}'

    title_row = [[Paragraph(title_content, ParagraphStyle(
        'healthtitle', parent=styles['HealthTitle'], textColor=WHITE, fontSize=12
    ))]]
    title_table = Table(title_row, colWidths=[515])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(title_table)

    # ── Badge row: Trend / Risk Level / Confidence ────────────────────────────
    badge_cells = []
    if trend_text:
        lower_t = trend_text.lower()
        if any(k in lower_t for k in ['improv', 'forbedring']):
            t_color = SECTION_COLORS_MAP['stable']
            trend_icon = '\u2b06 '
        elif any(k in lower_t for k in ['worsen', 'forv']):
            t_color = SECTION_COLORS_MAP['critical']
            trend_icon = '\u2b07 '
        else:
            t_color = MEDIUM_GRAY
            trend_icon = '\u27a1 '
        t_hex = '#{:02x}{:02x}{:02x}'.format(int(t_color.red*255), int(t_color.green*255), int(t_color.blue*255))
        badge_cells.append(Paragraph(
            f'<font color="{t_hex}"><b>{trend_icon}{xml_escape(trend_text)}</b></font>',
            ParagraphStyle('h_trend', parent=styles['TableCell'], fontSize=8, alignment=TA_CENTER)
        ))
    if risk_level_text:
        lower_r = risk_level_text.lower()
        r_color = SECTION_COLORS_MAP['critical'] if ('high' in lower_r or 'høj' in lower_r) \
            else (SECTION_COLORS_MAP['at_risk'] if ('medium' in lower_r or 'moderat' in lower_r) \
            else SECTION_COLORS_MAP['stable'])
        r_hex = '#{:02x}{:02x}{:02x}'.format(int(r_color.red*255), int(r_color.green*255), int(r_color.blue*255))
        badge_cells.append(Paragraph(
            f'<font color="{r_hex}"><b>{xml_escape(risk_level_text)}</b></font>',
            ParagraphStyle('h_risk', parent=styles['TableCell'], fontSize=8, alignment=TA_CENTER)
        ))
    if confidence_text:
        lower_c = confidence_text.lower()
        c_color = SECTION_COLORS_MAP['stable'] if ('high' in lower_c or 'høj' in lower_c) \
            else (SECTION_COLORS_MAP['critical'] if ('low' in lower_c or 'lav' in lower_c) \
            else SECTION_COLORS_MAP['at_risk'])
        c_hex = '#{:02x}{:02x}{:02x}'.format(int(c_color.red*255), int(c_color.green*255), int(c_color.blue*255))
        badge_cells.append(Paragraph(
            f'<font color="{c_hex}"><b>\u25a3 {xml_escape(confidence_text)}</b></font>',
            ParagraphStyle('h_conf', parent=styles['TableCell'], fontSize=8, alignment=TA_CENTER)
        ))
    if badge_cells:
        col_w = 515 / len(badge_cells)
        badge_table = Table([badge_cells], colWidths=[col_w] * len(badge_cells))
        badge_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), content_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LINEBELOW', (0, 0), (-1, -1), 1, header_color),
        ]))
        elements.append(badge_table)

    if health_data.get('items'):
        content_rows = []
        for item in health_data['items']:
            content_rows.append([Paragraph(f'\u2022  {xml_escape(item)}', styles['HealthItem'])])

        content_table = Table(content_rows, colWidths=[515])
        content_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), content_bg),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(content_table)

    elements.append(Spacer(1, 14))
    return elements


def build_extra_section(section_data, styles):
    elements = []
    title = section_data.get('title', '')
    items = section_data.get('items', [])

    if title:
        title_row = [[Paragraph(f'<b>{title}</b>', ParagraphStyle(
            'extratitle', parent=styles['SectionBodyBold'], textColor=WHITE, fontSize=11
        ))]]
        title_table = Table(title_row, colWidths=[515])
        title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), DARK_SUBHEADER),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ]))
        elements.append(title_table)

    if items:
        content_rows = []
        for item in items:
            content_rows.append([Paragraph(f'\u2022  {item}', styles['SectionBodyText'])])
        content_table = Table(content_rows, colWidths=[515])
        content_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(content_table)

    elements.append(Spacer(1, 12))
    return elements


def render_tables_and_groups(parsed, elements, styles, language='da'):
    for table_data in parsed['tables']:
        headers = table_data['headers']
        groups = table_data['groups']

        for group in groups:
            gc = GROUP_COLORS.get(group['name'], GROUP_COLORS['Other'])
            gl = GROUP_LABELS.get(group['name'], GROUP_LABELS.get('Other', {}))
            label = gl.get(language, gl.get('en', group['name']))
            task_count = group['count'] or len(group['rows'])

            icon = GROUP_COLORS.get(group['name'], GROUP_COLORS['Other'])['icon']
            group_header_data = [[
                Paragraph(f'{icon}  {label}  ({task_count})', styles['GroupHeader'])
            ]]
            group_header_table = Table(group_header_data, colWidths=[515])
            group_header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), gc['header']),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(group_header_table)

            if group['rows']:
                pdf_table = build_grouped_table(
                    headers, group['rows'], styles, group['name'], language
                )
                if pdf_table:
                    elements.append(pdf_table)
            elements.append(Spacer(1, 10))


def render_plain_text(content, elements, styles):
    if not content:
        return
    clean_text = re.sub(r'\n{3,}', '\n\n', content)
    for para_text in clean_text.split('\n\n'):
        para_text = para_text.strip()
        if not para_text or len(para_text) <= 2:
            continue

        bold_match = re.match(r'^\*\*([^*]+)\*\*$', para_text)
        if bold_match:
            elements.append(Paragraph(f'<b>{bold_match.group(1)}</b>', styles['SectionBodyBold']))
            elements.append(Spacer(1, 2))
            continue

        para_text_html = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', para_text)

        sub_lines = para_text_html.split('\n')
        for sub_line in sub_lines:
            sub_line = sub_line.strip()
            if not sub_line:
                continue
            if sub_line.startswith('• ') or sub_line.startswith('* ') or sub_line.startswith('- '):
                elements.append(Paragraph(f'\u2022  {sub_line[2:]}', styles['SectionBodyText']))
            else:
                elements.append(Paragraph(sub_line, styles['BotMessage']))
            elements.append(Spacer(1, 2))
        elements.append(Spacer(1, 4))


def build_response_content(content, is_html, styles, language='da', content_type=None):
    elements = []

    if not content:
        return elements

    is_comparison = content_type == 'comparison'
    is_markdown_with_tables = (not is_html and content and '|' in content and '---' in content and
                               any(p in content for p in ['SUMMARY_OF_CHANGES', 'OPSUMMERING_AF_ÆNDRINGER',
                                                           'PROJECT_HEALTH', 'PROJEKTSUNDHED',
                                                           'Summary of Changes', 'Project Health']))

    if is_comparison or is_markdown_with_tables:
        parsed = parse_markdown_content(content)

        if parsed.get('pre_table_text'):
            elements.extend(parse_pre_table_text(parsed['pre_table_text'], styles))

        # extra_sections from markdown = impact assessment etc → render AFTER tables
        # (matches html_formatter order: tables → impact → summary → health)

        if parsed.get('results_header'):
            elements.append(Paragraph(parsed['results_header'], styles['ResultsHeader']))
            elements.append(Spacer(1, 6))

        render_tables_and_groups(parsed, elements, styles, language)

        if parsed.get('extra_sections'):
            for section_data in parsed['extra_sections']:
                title_lower = section_data.get('title', '').lower()
                if any(k in title_lower for k in ['impact', 'konsekvensvurdering']):
                    elements.extend(build_colored_section(section_data, styles, section_type='impact'))
                else:
                    elements.extend(build_extra_section(section_data, styles))

        if parsed.get('summary'):
            elements.extend(build_colored_section(parsed['summary'], styles, section_type='summary'))

        if parsed.get('health'):
            elements.extend(build_colored_section(parsed['health'], styles, section_type='health'))

        if parsed.get('health_data'):
            elements.extend(build_health_stats_table(parsed['health_data'], styles, language))

        if not elements:
            render_plain_text(content, elements, styles)

        return elements

    if is_html:
        parsed = parse_complex_html(content)

        has_content = (parsed['tables'] or parsed['summary'] or parsed['health']
                       or parsed['extra_sections'] or parsed.get('root_cause')
                       or parsed.get('recommended_actions') or parsed.get('decision_engine_data')
                       or parsed.get('data_trust'))
        if not has_content:
            soup = BeautifulSoup(content, 'html.parser')
            soup = clean_soup(soup)
            clean_text = soup.get_text(separator='\n', strip=True)
            render_plain_text(clean_text, elements, styles)
            return elements

        # Order matches html_formatter._format_response_internal exactly:
        # 0. Data Trust — Analysis Basis (new section, rendered first)
        if parsed.get('data_trust'):
            elements.extend(build_data_trust_section(parsed['data_trust'], styles, language))

        # 1. Decision Engine cards (executive overview, biggest risk, estimated impact, confidence)
        if parsed.get('decision_engine_data'):
            elements.extend(build_decision_engine_section(parsed['decision_engine_data'], styles, language))

        # 2. Recommended / Executive Actions
        if parsed.get('recommended_actions'):
            elements.extend(build_colored_section(
                {'title': parsed['recommended_actions']['title'],
                 'items': [f'{a["title"]}' + (f' — {a["detail"]}' if a.get('detail') else '')
                           for a in parsed['recommended_actions'].get('actions', [])]},
                styles, section_type='executive'
            ))

        # 3. Root Cause Analysis
        if parsed.get('root_cause'):
            elements.extend(build_colored_section(parsed['root_cause'], styles, section_type='root_cause'))

        # 4. Comparison Results header + tables
        if parsed['results_header']:
            elements.append(Paragraph(parsed['results_header'], styles['ResultsHeader']))
            elements.append(Spacer(1, 6))

        render_tables_and_groups(parsed, elements, styles, language)

        # 5. Impact Assessment (was in extra_sections)
        for section_data in parsed.get('extra_sections', []):
            title_lower = section_data.get('title', '').lower()
            if any(k in title_lower for k in ['impact', 'konsekvensvurdering', 'vurdering']):
                elements.extend(build_colored_section(section_data, styles, section_type='impact'))
            else:
                elements.extend(build_extra_section(section_data, styles))

        # 6. Summary of Changes
        if parsed.get('summary'):
            elements.extend(build_colored_section(parsed['summary'], styles, section_type='summary'))

        # 7. Project Health
        if parsed.get('health'):
            elements.extend(build_colored_section(parsed['health'], styles, section_type='health'))

        if parsed.get('health_data'):
            elements.extend(build_health_stats_table(parsed.get('health_data'), styles, language))

        return elements

    render_plain_text(content, elements, styles)
    return elements


def add_page_number_and_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER_GRAY)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 42, doc.width + doc.rightMargin, 42)

    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MEDIUM_GRAY)
    canvas.drawString(doc.leftMargin, 28, "Nordic AI Group ApS  |  Nova Insights")

    page_text = f"Page {doc.page}"
    canvas.drawRightString(doc.width + doc.rightMargin, 28, page_text)

    canvas.setStrokeColor(CYAN_PRIMARY)
    canvas.setLineWidth(2)
    canvas.line(doc.leftMargin, doc.height + doc.topMargin + 15, doc.width + doc.rightMargin, doc.height + doc.topMargin + 15)
    canvas.restoreState()


def add_cover_page_decoration(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(CYAN_PRIMARY)
    canvas.setLineWidth(2)
    canvas.line(doc.leftMargin, doc.height + doc.topMargin + 15, doc.width + doc.rightMargin, doc.height + doc.topMargin + 15)

    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MEDIUM_GRAY)
    canvas.drawCentredString((doc.width + doc.leftMargin + doc.rightMargin) / 2, 22, "Nova Insights  \u2022  Nordic AI Group ApS  \u2022  www.nordicaigroup.com")
    canvas.restoreState()


def sanitize_filename(text, max_length=50):
    if not text:
        return 'export'
    safe = re.sub(r'[^\w\s\-\u00e6\u00f8\u00e5\u00c6\u00d8\u00c5]', '', text)
    safe = re.sub(r'\s+', '_', safe.strip())
    return safe[:max_length] if safe else 'export'


def generate_message_pdf(message, session_info, user_info, language='da', query_text=None):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = get_styles()
    story = []

    labels = {
        'da': {
            'title': 'Besked Eksport',
            'session': 'Chat Session',
            'generated': 'Genereret',
            'by': 'Af',
            'company': 'Virksomhed',
            'query': 'Foresp\u00f8rgsel',
            'response': 'Svar',
        },
        'en': {
            'title': 'Message Export',
            'session': 'Chat Session',
            'generated': 'Generated',
            'by': 'By',
            'company': 'Company',
            'query': 'Query',
            'response': 'Response',
        }
    }
    t = labels.get(language, labels['da'])

    timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
    meta_items = []
    if session_info.get('title'):
        meta_items.append((t['session'] + ':', session_info['title']))
    if query_text:
        q_display = query_text if len(query_text) <= 80 else query_text[:77] + '...'
        meta_items.append((t['query'] + ':', q_display))
    meta_items.append((t['generated'] + ':', timestamp))
    if user_info.get('name'):
        meta_items.append((t['by'] + ':', user_info['name']))
    if user_info.get('company'):
        meta_items.append((t['company'] + ':', user_info['company']))

    build_cover_page(story, styles, t['title'], session_info.get('title', ''), meta_items, language)
    story.append(PageBreak())

    content = message.get('content', '')
    is_html = message.get('is_html', False)
    content_type = message.get('content_type', 'text')
    msg_time = message.get('created_at', '')

    if msg_time:
        try:
            dt = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
            msg_time = dt.strftime('%d/%m/%Y %H:%M')
        except:
            pass

    if query_text:
        story.append(Paragraph(f'{t["query"]}:', styles['QueryLabel']))
        story.append(Spacer(1, 4))
        story.append(build_user_message_bubble(query_text, styles))
        story.append(Spacer(1, 12))

    story.append(Paragraph(f'{t["response"]}  \u2022  {msg_time}', styles['QueryLabel']))
    story.append(Spacer(1, 6))

    response_elements = build_response_content(content, is_html, styles, language, content_type=content_type)
    story.extend(response_elements)

    story.append(Spacer(1, 30))

    doc.build(story, onFirstPage=add_cover_page_decoration, onLaterPages=add_page_number_and_footer)
    buffer.seek(0)
    return buffer


def generate_session_pdf(messages, session_info, user_info, annotations=None, language='da'):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = get_styles()
    story = []

    labels = {
        'da': {
            'report_title': 'Komplet Chat Eksport',
            'generated': 'Genereret',
            'by': 'Af',
            'company': 'Virksomhed',
            'old_version': 'Gammel Tidsplan',
            'new_version': 'Ny Tidsplan',
            'chat_history': 'Chat Historik',
            'comments': 'Kommentarer',
            'user_msg': 'Bruger',
            'bot_msg': 'Nova AI',
            'query': 'Foresp\u00f8rgsel',
            'response': 'Svar',
        },
        'en': {
            'report_title': 'Complete Chat Export',
            'generated': 'Generated',
            'by': 'By',
            'company': 'Company',
            'old_version': 'Old Schedule',
            'new_version': 'New Schedule',
            'chat_history': 'Chat History',
            'comments': 'Comments',
            'user_msg': 'User',
            'bot_msg': 'Nova AI',
            'query': 'Query',
            'response': 'Response',
        }
    }
    t = labels.get(language, labels['da'])

    timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
    meta_items = []
    if session_info.get('old_file_name'):
        meta_items.append((t['old_version'] + ':', session_info['old_file_name']))
    if session_info.get('new_file_name'):
        meta_items.append((t['new_version'] + ':', session_info['new_file_name']))
    meta_items.append((t['generated'] + ':', timestamp))
    if user_info.get('name'):
        meta_items.append((t['by'] + ':', user_info['name']))
    if user_info.get('company'):
        meta_items.append((t['company'] + ':', user_info['company']))

    total_messages = len(messages) if messages else 0
    user_queries = sum(1 for m in (messages or []) if m.get('sender_type') == 'user')
    meta_items.append(('Total:', f'{total_messages} messages ({user_queries} queries)'))

    build_cover_page(story, styles, t['report_title'], session_info.get('title', ''), meta_items, language)
    story.append(PageBreak())

    if messages:
        story.append(Paragraph(t['chat_history'], styles['SectionHeader']))

        d = Drawing(515, 3)
        d.add(Rect(0, 0, 515, 2, fillColor=CYAN_PRIMARY, strokeColor=None))
        story.append(d)
        story.append(Spacer(1, 15))

        pair_index = 0
        i = 0
        while i < len(messages):
            msg = messages[i]
            sender = msg.get('sender_type', 'bot')
            content = msg.get('content', '')
            is_html = msg.get('is_html', False)
            msg_time = msg.get('created_at', '')

            if msg_time:
                try:
                    dt = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
                    msg_time = dt.strftime('%d/%m/%Y %H:%M')
                except:
                    pass

            if sender == 'user':
                pair_index += 1

                if pair_index > 1:
                    story.append(Spacer(1, 10))
                    sep = Drawing(515, 1)
                    sep.add(Rect(0, 0, 515, 1, fillColor=BORDER_GRAY, strokeColor=None))
                    story.append(sep)
                    story.append(Spacer(1, 10))

                story.append(Paragraph(f'{t["query"]} #{pair_index}  \u2022  {msg_time}', styles['QueryLabel']))
                story.append(Spacer(1, 4))
                story.append(build_user_message_bubble(content or '\u2014', styles))
                story.append(Spacer(1, 10))

                if i + 1 < len(messages) and messages[i + 1].get('sender_type') == 'bot':
                    bot_msg = messages[i + 1]
                    bot_content = bot_msg.get('content', '')
                    bot_is_html = bot_msg.get('is_html', False)
                    bot_content_type = bot_msg.get('content_type', 'text')
                    bot_time = bot_msg.get('created_at', '')

                    if bot_time:
                        try:
                            dt = datetime.fromisoformat(bot_time.replace('Z', '+00:00'))
                            bot_time = dt.strftime('%d/%m/%Y %H:%M')
                        except:
                            pass

                    story.append(Paragraph(f'{t["response"]}  \u2022  {bot_time}', styles['QueryLabel']))
                    story.append(Spacer(1, 6))

                    response_elements = build_response_content(bot_content, bot_is_html, styles, language, content_type=bot_content_type)
                    story.extend(response_elements)

                    i += 2
                    continue
            else:
                content_type = msg.get('content_type', 'text')
                story.append(Paragraph(f'{t["bot_msg"]}  \u2022  {msg_time}', styles['QueryLabel']))
                story.append(Spacer(1, 6))
                response_elements = build_response_content(content, is_html, styles, language, content_type=content_type)
                story.extend(response_elements)

            i += 1
            story.append(Spacer(1, 10))

    if annotations:
        has_comments = any(ann_list for ann_list in annotations.values() if ann_list)
        if has_comments:
            story.append(PageBreak())
            story.append(Paragraph(t['comments'], styles['SectionHeader']))

            d = Drawing(515, 3)
            d.add(Rect(0, 0, 515, 2, fillColor=CYAN_PRIMARY, strokeColor=None))
            story.append(d)
            story.append(Spacer(1, 15))

            for task_key, task_annotations in annotations.items():
                if task_annotations:
                    task_name = task_annotations[0].get('task_name', task_key) if task_annotations else task_key
                    story.append(Paragraph(f'<b>{task_name}</b>', styles['BotMessage']))
                    story.append(Spacer(1, 4))

                    for ann in task_annotations:
                        ann_text = ann.get('annotation_text', '')
                        author = ann.get('author_name', 'User')
                        created = ann.get('created_at', '')
                        tags = ann.get('tags', '')

                        if created:
                            try:
                                dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                                created = dt.strftime('%d/%m/%Y')
                            except:
                                pass

                        tag_str = ''
                        if tags:
                            if isinstance(tags, str):
                                tag_str = f'  [{tags}]'
                            elif isinstance(tags, list):
                                tag_str = f'  [{", ".join(tags)}]'

                        story.append(Paragraph(
                            f'\u2022 {ann_text}{tag_str} \u2014 <i>{author} ({created})</i>',
                            styles['TableCell']
                        ))
                    story.append(Spacer(1, 10))

    doc.build(story, onFirstPage=add_cover_page_decoration, onLaterPages=add_page_number_and_footer)
    buffer.seek(0)
    return buffer


def _sa_section_header(title, styles, header_color=None):
    if header_color is None:
        header_color = TEAL_PRIMARY
    elements = []
    elements.append(Spacer(1, 14))
    header_table = Table(
        [[Paragraph(f'<b>{xml_escape(title)}</b>', ParagraphStyle(
            'SAHeader', parent=styles['SectionHeader'], textColor=WHITE, fontSize=12, leading=16
        ))]],
        colWidths=[515]
    )
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8))
    return elements


def _sa_key_value_row(label, value, styles):
    return [
        Paragraph(f'<b>{xml_escape(str(label))}</b>', styles['TableCell']),
        Paragraph(xml_escape(str(value)), styles['SectionBodyText'])
    ]


def _sa_bullet_items(items, styles, bullet='\u2022'):
    elements = []
    for item in items:
        text = item.strip()
        if text:
            elements.append(Paragraph(
                f'{bullet} {xml_escape(text)}',
                styles['SectionBodyText']
            ))
    return elements


def _sa_render_snapshot_card(section, styles, language='en'):
    elements = []
    sd = section.get('snapshot_data', {})
    if not sd:
        return elements

    AMBER_DARK = colors.Color(146/255, 64/255, 14/255)
    AMBER_BG = colors.Color(255/255, 251/255, 235/255)
    AMBER_BORDER = colors.Color(253/255, 230/255, 138/255)
    ORANGE_MED = colors.Color(234/255, 88/255, 12/255)

    if sd.get('what'):
        sentence_style = ParagraphStyle(
            'SnapshotSentence', parent=styles['SectionBodyText'],
            fontSize=11, leading=16, fontName='Helvetica-Oblique',
            textColor=DARK_HEADER
        )
        elements.append(Paragraph(xml_escape(sd['what']), sentence_style))
        elements.append(Spacer(1, 8))

    badge_cells = []
    if sd.get('delay_impact'):
        delay_pill = Table(
            [[Paragraph(f'<b>{xml_escape(sd["delay_impact"])}</b>',
                        ParagraphStyle('DelayPill', parent=styles['TableCell'],
                                       fontSize=9, textColor=AMBER_DARK, fontName='Helvetica-Bold'))]],
            colWidths=[None]
        )
        delay_pill.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), AMBER_BG),
            ('BOX', (0, 0), (-1, -1), 1.5, AMBER_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ]))
        badge_cells.append(delay_pill)

    if sd.get('confidence_label'):
        conf_text = sd['confidence_label']
        if 'HIGH' in conf_text.upper() or 'H\u00d8J' in conf_text.upper():
            conf_bg = colors.Color(240/255, 253/255, 244/255)
            conf_border = colors.Color(134/255, 239/255, 172/255)
            conf_color = colors.Color(21/255, 128/255, 61/255)
        elif 'LOW' in conf_text.upper() or 'LAV' in conf_text.upper():
            conf_bg = colors.Color(254/255, 242/255, 242/255)
            conf_border = colors.Color(254/255, 202/255, 202/255)
            conf_color = RED_CRITICAL
        else:
            conf_bg = AMBER_BG
            conf_border = AMBER_BORDER
            conf_color = AMBER_IMPORTANT
        conf_pill = Table(
            [[Paragraph(f'<b>{xml_escape(conf_text)}</b>',
                        ParagraphStyle('ConfPill', parent=styles['TableCell'],
                                       fontSize=8, textColor=conf_color, fontName='Helvetica-Bold'))]],
            colWidths=[None]
        )
        conf_pill.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), conf_bg),
            ('BOX', (0, 0), (-1, -1), 1.5, conf_border),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ]))
        badge_cells.append(conf_pill)

    confidence_basis = sd.get('confidence_basis', '')

    if badge_cells:
        num_cols = len(badge_cells)
        col_w = 515 // max(num_cols, 2)
        padded = list(badge_cells)
        if num_cols == 1:
            padded.append('')
        badges_table = Table([padded[:max(num_cols, 2)]], colWidths=[col_w] * max(num_cols, 2))
        badges_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(badges_table)

    if confidence_basis:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            f'<i>{xml_escape(confidence_basis)}</i>',
            ParagraphStyle('ConfBasis', parent=styles['SectionBodyText'],
                           fontSize=8, textColor=colors.Color(100/255, 116/255, 139/255),
                           fontName='Helvetica-Oblique', spaceBefore=2)
        ))
    elements.append(Spacer(1, 8))

    drivers = sd.get('drivers', [])
    if drivers:
        driver_label_style = ParagraphStyle(
            'DriverLabel', parent=styles['TableCell'],
            fontSize=8, textColor=ORANGE_MED, fontName='Helvetica-Bold',
            spaceAfter=4
        )
        _driver_lbl = 'PRIMÆRE FORSINKELSESDRIVERE' if language == 'da' else 'MAIN DELAY DRIVERS'
        driver_box_rows = [[Paragraph(_driver_lbl, driver_label_style)]]
        for d in drivers[:3]:
            driver_box_rows.append([Paragraph(
                f'\u203a {xml_escape(d)}',
                ParagraphStyle('DriverItem', parent=styles['SectionBodyText'], fontSize=9, leading=13)
            )])
        driver_box = Table(driver_box_rows, colWidths=[495])
        driver_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.Color(255/255, 247/255, 237/255)),
            ('BOX', (0, 0), (-1, -1), 1, colors.Color(253/255, 215/255, 170/255)),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ]))
        elements.append(driver_box)
        elements.append(Spacer(1, 6))

    return elements


def _sa_render_biggest_risk_card(section, styles):
    elements = []
    rows = section.get('biggest_risk_rows', [])
    if not rows:
        return elements

    ROW_CONFIGS = {
        'red': {
            'bg': colors.Color(254/255, 242/255, 242/255),
            'border': colors.Color(254/255, 202/255, 202/255),
            'label_color': RED_CRITICAL,
            'text_color': DARK_HEADER,
        },
        'orange': {
            'bg': colors.Color(255/255, 247/255, 237/255),
            'border': colors.Color(254/255, 215/255, 170/255),
            'label_color': ORANGE_RISK,
            'text_color': DARK_HEADER,
        },
        'green': {
            'bg': colors.Color(240/255, 253/255, 244/255),
            'border': colors.Color(187/255, 247/255, 208/255),
            'label_color': colors.Color(21/255, 128/255, 61/255),
            'text_color': colors.Color(21/255, 128/255, 61/255),
        },
    }

    for color_key, label, value in rows:
        cfg = ROW_CONFIGS.get(color_key, ROW_CONFIGS['red'])
        label_para = Paragraph(
            f'<b>{xml_escape(label)}</b>',
            ParagraphStyle('RiskRowLabel', parent=styles['TableCell'],
                           fontSize=8, textColor=cfg['label_color'],
                           fontName='Helvetica-Bold', spaceAfter=3)
        )
        value_para = Paragraph(
            xml_escape(value),
            ParagraphStyle('RiskRowValue', parent=styles['SectionBodyText'],
                           fontSize=10, textColor=cfg['text_color'],
                           fontName='Helvetica-Bold', leading=14)
        )
        accent_cell = ''
        content_table = Table([[label_para], [value_para]], colWidths=[483])
        content_table.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        row_table = Table([[accent_cell, content_table]], colWidths=[8, 507])
        row_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), cfg['bg']),
            ('BACKGROUND', (0, 0), (0, -1), cfg['label_color']),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, cfg['border']),
            ('LINEABOVE', (0, 0), (-1, 0), 0.5, cfg['border']),
            ('LINEBEFORE', (0, 0), (0, -1), 0.5, cfg['border']),
            ('LINEAFTER', (-1, 0), (-1, -1), 0.5, cfg['border']),
            ('LEFTPADDING', (0, 0), (0, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, -1), 0),
            ('LEFTPADDING', (1, 0), (1, -1), 12),
            ('RIGHTPADDING', (1, 0), (1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(row_table)
        elements.append(Spacer(1, 6))

    return elements


def _extract_kv_from_flex_rows(card):
    kv_pairs = []
    for div in card.find_all('div', style=re.compile(r'display:\s*flex.*gap:\s*10px.*border-bottom'), recursive=True):
        spans = div.find_all('span', recursive=True)
        label_span = None
        value_span = None
        for sp in spans:
            st = sp.get('style', '')
            if 'color:#64748b' in st or '#64748b' in st:
                label_span = sp
            elif 'font-weight:' in st and ('600' in st or '700' in st) and '#1a202c' in st:
                value_span = sp
        if label_span and value_span:
            l = label_span.get_text(strip=True)
            v = value_span.get_text(strip=True)
            if l and v:
                kv_pairs.append((l, v))
                continue
        if len(spans) >= 2:
            texts = [s.get_text(strip=True) for s in spans if s.get_text(strip=True)]
            texts = [t for t in texts if len(t) > 0]
            if len(texts) >= 2:
                kv_pairs.append((texts[-2], texts[-1]))
    return kv_pairs


def _extract_labeled_fields(container):
    fields = []
    for div in container.find_all('div', style=re.compile(r'display:\s*flex.*gap:\s*10px'), recursive=True):
        inner = div.find('div', style=re.compile(r'flex:\s*1'))
        if not inner:
            continue
        label_div = inner.find('div', style=re.compile(r'text-transform:\s*uppercase|font-weight:\s*700'))
        value_div = inner.find('div', style=re.compile(r'font-size:\s*13px|line-height'))
        if label_div and value_div:
            label = label_div.get_text(strip=True)
            value = value_div.get_text(strip=True)
            if label and value:
                fields.append((label, value))
    return fields


def _extract_structured_cards(card):
    blocks = []
    bordered_divs = card.find_all('div', style=re.compile(r'border-left:\s*[34]px\s+solid'), recursive=False)
    if not bordered_divs:
        bordered_divs = card.find_all('div', style=re.compile(r'border:\s*1px\s+solid.*border-left:\s*[34]px'), recursive=True)
    if not bordered_divs:
        bordered_divs = []
        for d in card.find_all('div', recursive=False):
            for inner in d.find_all('div', style=re.compile(r'border-left:\s*[34]px'), recursive=True):
                bordered_divs.append(inner)

    seen = set()
    for block_div in bordered_divs:
        block_id = id(block_div)
        if block_id in seen:
            continue
        seen.add(block_id)

        header_div = block_div.find('div', style=re.compile(r'background:\s*linear-gradient|border-bottom'))
        card_title = ''
        card_id = ''
        card_badge = ''
        card_tag = ''
        if header_div:
            id_span = header_div.find('span', style=re.compile(r'font-family.*mono|monospace'))
            if id_span:
                card_id = id_span.get_text(strip=True)
            title_span = header_div.find('span', style=re.compile(r'flex:\s*1|min-width:\s*0'))
            if not title_span:
                title_span = header_div.find('span', style=re.compile(r'font-weight:\s*700.*color:\s*#1[34]'))
                if not title_span:
                    title_span = header_div.find('span', style=re.compile(r'font-size:\s*13px.*font-weight:\s*700'))
            if title_span and title_span != id_span:
                card_title = title_span.get_text(strip=True)
            badge_span = header_div.find('span', style=re.compile(r'border-radius:\s*12px.*font-weight:\s*700'))
            if badge_span:
                card_badge = badge_span.get_text(strip=True)
            tag_spans = header_div.find_all('span', style=re.compile(r'border-radius:\s*6px.*font-size:\s*10px'))
            for ts in tag_spans:
                t = ts.get_text(strip=True)
                if t and t != card_id:
                    card_tag = t
                    break
            if not card_title:
                card_title = header_div.get_text(strip=True)
                for rem in [card_id, card_badge, card_tag]:
                    if rem:
                        card_title = card_title.replace(rem, '').strip()

        fields = _extract_labeled_fields(block_div)

        grid_div = block_div.find('div', style=re.compile(r'display:\s*grid'))
        if grid_div:
            for cell in grid_div.find_all('div', style=re.compile(r'text-align:\s*center'), recursive=False):
                label_div = cell.find('div', style=re.compile(r'text-transform:\s*uppercase'))
                value_div = cell.find('div', style=re.compile(r'font-weight:\s*700'))
                if label_div and value_div and label_div != value_div:
                    l = label_div.get_text(strip=True)
                    v = value_div.get_text(strip=True)
                    if l and v:
                        fields.append((l, v))

        reason_divs = block_div.find_all('div', style=re.compile(r'padding:\s*10px\s+14px.*border-radius:\s*8px'))
        for rd in reason_divs:
            rl = rd.find('span', style=re.compile(r'text-transform:\s*uppercase'))
            rv = rd.find('div', style=re.compile(r'font-size:\s*13px.*line-height'))
            if rl and rv:
                fields.append((rl.get_text(strip=True), rv.get_text(strip=True)))

        if not fields:
            fields = _extract_kv_from_flex_rows(block_div)

        if card_id or card_title or fields:
            blocks.append({
                'id': card_id,
                'title': card_title,
                'badge': card_badge,
                'tag': card_tag,
                'fields': fields,
            })

    return blocks


def _extract_numbered_actions(card):
    actions = []
    for div in card.find_all('div', style=re.compile(r'display:\s*flex.*gap:\s*1[24]px.*border-bottom'), recursive=False):
        num_div = div.find('div', style=re.compile(r'border-radius:\s*50%'))
        if num_div:
            num = num_div.get_text(strip=True)
            tag_span = div.find('span', style=re.compile(r'text-transform:\s*uppercase'))
            tag = tag_span.get_text(strip=True) if tag_span else ''
            p = div.find('p')
            text = p.get_text(strip=True) if p else ''
            if not text:
                text = div.get_text(strip=True)
                if num:
                    text = text.replace(num, '', 1).strip()
                if tag:
                    text = text.replace(tag, '', 1).strip()
            if num and text:
                prefix = f"{num}. [{tag}] " if tag else f"{num}. "
                actions.append(prefix + text)
    return actions


def _extract_area_summaries(card):
    areas = []
    for div in card.find_all('div', style=re.compile(r'display:\s*flex.*gap:\s*1[24]px.*padding:\s*1[24]px'), recursive=False):
        header_div = div.find('div', style=re.compile(r'display:\s*flex.*align-items:\s*center.*gap:\s*12px'))
        if header_div and header_div.find('h3'):
            continue

        count_div = div.find('div', style=re.compile(r'font-size:\s*(1[89]|2[0-9]|3[0-9])px.*font-weight'))
        area_div = div.find('div', style=re.compile(r'font-size:\s*14px.*font-weight:\s*700'))
        if not area_div:
            area_div = div.find('div', style=re.compile(r'font-weight:\s*700.*font-size:\s*14px'))
        count = count_div.get_text(strip=True) if count_div else ''
        area_name = area_div.get_text(strip=True) if area_div else ''
        if not area_name:
            continue
        detail_span = div.find('div', style=re.compile(r'font-size:\s*11px.*color:\s*#64748b'))
        detail = ''
        if detail_span:
            t = detail_span.get_text(strip=True)
            if t and 'delayed' not in t.lower():
                detail = t
        desc_divs = div.find_all('div', style=re.compile(r'font-size:\s*12px.*line-height|font-size:\s*13px.*line-height'))
        desc = ''
        for dd in desc_divs:
            t = dd.get_text(strip=True)
            if t and len(t) > 15:
                desc = t
                break
        if not desc:
            desc_p = div.find('p', style=re.compile(r'font-size:\s*1[23]px'))
            if desc_p:
                desc = desc_p.get_text(strip=True)
        areas.append({
            'name': area_name,
            'count': count,
            'detail': detail,
            'description': desc,
        })
    return areas


def _extract_hover_cards(card):
    items = []
    for div in card.find_all('div', attrs={'onmouseover': True}):
        flex_inner = div.find('div', style=re.compile(r'flex:\s*1'))
        if not flex_inner:
            continue
        id_span = flex_inner.find('span', style=re.compile(r'font-family.*mono|monospace'))
        card_id = id_span.get_text(strip=True) if id_span else ''
        tag_span = flex_inner.find('span', style=re.compile(r'border-radius:\s*6px.*font-size:\s*10px'))
        tag = tag_span.get_text(strip=True) if tag_span else ''
        title_p = flex_inner.find('p', style=re.compile(r'font-weight:\s*600'))
        title = title_p.get_text(strip=True) if title_p else ''
        desc_p = flex_inner.find('p', style=re.compile(r'line-height:\s*1\.[67]'))
        desc = desc_p.get_text(strip=True) if desc_p else ''
        if card_id or title:
            items.append({
                'id': card_id,
                'tag': tag,
                'title': title,
                'description': desc,
            })
    return items


def _extract_snapshot_data(card):
    data = {}

    # Main "what will happen" sentence — new formatter: bold white-bg box
    what_div = card.find('div', style=re.compile(r'font-size:\s*15px.*font-weight:\s*700.*color:\s*#0f172a'))
    if not what_div:
        what_div = card.find('div', style=re.compile(r'padding:\s*14px\s+18px.*background:\s*white'))
    if not what_div:
        # Legacy: italic div
        what_div = card.find('div', style=re.compile(r'font-style:\s*italic'))
    if what_div:
        data['what'] = what_div.get_text(strip=True)

    # Delay badge — new formatter: inline-flex amber container with large span
    delay_badge_div = card.find('div', style=re.compile(r'display:\s*inline-flex.*background:\s*#fffbeb'))
    if not delay_badge_div:
        delay_badge_div = card.find('div', style=re.compile(r'border:\s*1\.5px\s+solid\s+#fde68a'))
    if delay_badge_div:
        impact_span = delay_badge_div.find('span', style=re.compile(r'font-size:\s*16px.*font-weight:\s*900'))
        if not impact_span:
            impact_span = delay_badge_div.find('span', style=re.compile(r'font-weight:\s*900'))
        if impact_span:
            data['delay_impact'] = impact_span.get_text(strip=True)
    if not data.get('delay_impact'):
        # Legacy flex-wrap badges container
        badges_div = card.find('div', style=re.compile(r'display:\s*flex.*flex-wrap:\s*wrap.*gap:\s*8px'))
        if badges_div:
            for span in badges_div.find_all('span'):
                st = span.get('style', '').replace(' ', '')
                t = span.get_text(strip=True)
                if not t:
                    continue
                t_up = t.upper()
                if any(kw in t_up for kw in ('CONFIDENCE', 'SIKKERHED', 'HIGH CONF', 'MEDIUM CONF', 'LOW CONF',
                                              'HØJ SIKKER', 'MIDDEL SIKKER', 'LAV SIKKER')):
                    data['confidence_label'] = t
                elif 'font-style:italic' in st:
                    data['confidence_basis'] = t
                elif '#fffbeb' in st or '#fde68a' in st or 'font-weight:800' in st:
                    if not data.get('delay_impact'):
                        data['delay_impact'] = t

    # Drivers — new formatter: <div> items each with border:#fed7aa, text in <span font-size:13px>
    # Find the drivers wrapper (a div containing the label + driver divs)
    drivers_label_div = card.find('div', style=re.compile(r'color:\s*#ea580c.*text-transform:\s*uppercase'))
    drivers = []
    if drivers_label_div and drivers_label_div.parent:
        driver_items = drivers_label_div.parent.find_all(
            'div', style=re.compile(r'border:\s*1px\s+solid\s+#fed7aa')
        )
        for item in driver_items:
            sp = item.find('span', style=re.compile(r'font-size:\s*13px'))
            t = sp.get_text(strip=True) if sp else item.get_text(strip=True)
            if t and len(t) > 5:
                drivers.append(t)
    if not drivers:
        # Legacy: <li> items
        drivers_container = card.find('div', style=re.compile(r'border:\s*1px\s+solid\s+#fed7aa'))
        if drivers_container:
            for li in drivers_container.find_all('li'):
                sp = li.find('span', style=re.compile(r'font-size:\s*13px'))
                t = sp.get_text(strip=True) if sp else li.get_text(strip=True)
                if t and len(t) > 5:
                    drivers.append(t)
    data['drivers'] = drivers
    return data


def _extract_biggest_risk_rows(card):
    rows = []
    issue_div = card.find('div', style=re.compile(r'background:\s*#fef2f2.*border:\s*1px\s+solid\s+#fecaca'))
    if issue_div:
        label_div = issue_div.find('div', style=re.compile(r'font-size:\s*10px.*text-transform:\s*uppercase'))
        value_div = issue_div.find('div', style=re.compile(r'font-size:\s*13px'))
        label = label_div.get_text(strip=True) if label_div else 'ISSUE'
        value = value_div.get_text(strip=True) if value_div else issue_div.get_text(strip=True)
        if value:
            rows.append(('red', label, value))
    block_div = card.find('div', style=re.compile(r'background:\s*#fff7ed.*border:\s*1px\s+solid\s+#fed7aa'))
    if block_div:
        label_div = block_div.find('div', style=re.compile(r'font-size:\s*10px.*text-transform:\s*uppercase'))
        value_div = block_div.find('div', style=re.compile(r'font-size:\s*13px'))
        label = label_div.get_text(strip=True) if label_div else 'WILL BLOCK'
        value = value_div.get_text(strip=True) if value_div else block_div.get_text(strip=True)
        if value:
            rows.append(('orange', label, value))
    prevent_div = card.find('div', style=re.compile(r'background:\s*#f0fdf4.*border:\s*1px\s+solid\s+#bbf7d0'))
    if prevent_div:
        label_div = prevent_div.find('div', style=re.compile(r'font-size:\s*10px.*text-transform:\s*uppercase'))
        value_div = prevent_div.find('div', style=re.compile(r'font-size:\s*13px'))
        label = label_div.get_text(strip=True) if label_div else 'PREVENT NOW'
        value = value_div.get_text(strip=True) if value_div else prevent_div.get_text(strip=True)
        if value:
            rows.append(('green', label, value))
    return rows


def _extract_confidence_data(card):
    data = {}
    badge_span = card.find('span', style=re.compile(r'border-radius:\s*20px.*font-weight:\s*800'))
    if badge_span:
        txt = badge_span.get_text(strip=True).upper()
        if any(kw in txt for kw in ('HIGH', 'MEDIUM', 'LOW', 'HØJ', 'MODERAT', 'LAV')):
            data['level'] = badge_span.get_text(strip=True)
            raw_color = badge_span.get('style', '')
            m = re.search(r'color:\s*(#[0-9a-fA-F]{6})', raw_color)
            data['color'] = m.group(1) if m else '#10b981'
    basis_span = card.find('span', style=re.compile(r'font-style:\s*italic'))
    if basis_span:
        data['basis'] = basis_span.get_text(strip=True)
    return data


def _extract_priority_cards(card):
    items = []
    for div in card.find_all('div', style=re.compile(r'border-left:\s*[34]px\s+solid'), recursive=False):
        num_div = div.find('div', style=re.compile(r'border-radius:\s*[89]px.*font-weight:\s*800|font-weight:\s*800.*border-radius'))
        num = num_div.get_text(strip=True) if num_div else ''
        action_div = div.find('div', style=re.compile(r'font-size:\s*14px.*font-weight:\s*700.*line-height'))
        action = action_div.get_text(strip=True) if action_div else ''
        date_span = div.find('span', style=re.compile(r'font-weight:\s*800.*color:\s*#92400e|color:\s*#92400e.*font-weight'))
        date = date_span.get_text(strip=True) if date_span else ''
        owner_span = div.find('span', style=re.compile(r'font-weight:\s*600.*color:\s*#475569'))
        owner = owner_span.get_text(strip=True) if owner_span else ''
        note_div = div.find('span', style=re.compile(r'text-transform:\s*uppercase.*font-weight:\s*800'))
        note = note_div.get_text(strip=True) if note_div else ''
        note_desc = ''
        note_container = div.find('div', style=re.compile(r'background:\s*#fef2f2'))
        if note_container:
            desc_div = note_container.find('div', style=re.compile(r'font-size:\s*12px.*line-height'))
            if desc_div:
                note_desc = desc_div.get_text(strip=True)
        if num and action:
            items.append({
                'number': num,
                'action': action,
                'date': date,
                'owner': owner,
                'note': note,
                'note_desc': note_desc,
            })
    return items


def _parse_schedule_module_cards(html_content):
    if not html_content:
        return [], {}, {}

    soup = BeautifulSoup(html_content, 'html.parser')
    soup = clean_soup(soup)

    report_div = soup.find('div', class_='nova-report')
    if not report_div:
        report_div = soup

    overview_stats = {}
    project_status = {}
    all_top_divs = [c for c in report_div.children if hasattr(c, 'name') and c.name == 'div']
    for div in all_top_divs:
        if 'module-card' in (div.get('class') or []):
            continue

        div_style_raw = div.get('style', '')
        if re.search(r'border-left:\s*5px\s+solid', div_style_raw):
            psc = {}
            for span in div.find_all('span'):
                st = span.get('style', '').replace(' ', '')
                t = span.get_text(strip=True)
                if not t:
                    continue
                if 'text-transform:uppercase' in st and 'letter-spacing' in st and len(t) < 40 and 'font-weight:800' in st:
                    psc.setdefault('status_label', t)
                elif 'border-radius:20px' in st and 'font-weight:800' in st and len(t) < 30:
                    psc['status_badge'] = t
                elif 'font-weight:800' in st and len(t) < 20:
                    t_up = t.upper()
                    if any(kw in t_up for kw in ('HIGH', 'LOW', 'MEDIUM', 'HØJ', 'LAV', 'MODERAT')):
                        psc.setdefault('risk_level', t)
            findings = []
            for span in div.find_all('span', style=re.compile(r'font-size:\s*13px.*color:\s*#334155|color:\s*#334155.*font-size:\s*13px')):
                t = span.get_text(strip=True)
                if t and len(t) > 10:
                    findings.append(t)
            if findings:
                psc['findings'] = findings
            cons_box = div.find('div', style=re.compile(r'background:\s*#fef2f2.*border:\s*1px\s+solid\s+#fecaca'))
            if cons_box:
                cons_hdr = cons_box.find('div', style=re.compile(r'text-transform:\s*uppercase'))
                if cons_hdr:
                    psc['consequences_title'] = cons_hdr.get_text(strip=True)
                consequences = []
                for span in cons_box.find_all('span', style=re.compile(r'font-size:\s*12px')):
                    t = span.get_text(strip=True)
                    if t and len(t) > 10:
                        consequences.append(t)
                if not consequences:
                    for item_div in cons_box.find_all('div', style=re.compile(r'display:\s*flex.*align-items:\s*flex-start')):
                        t = item_div.get_text(strip=True)
                        if t and len(t) > 10:
                            consequences.append(t)
                if consequences:
                    psc['consequences'] = consequences
            color_m = re.search(r'border-left:\s*5px\s+solid\s*(#[0-9a-fA-F]{3,6})', div_style_raw)
            if color_m:
                psc['status_color'] = color_m.group(1)
            overview_stats['status_card'] = psc
            continue

        big_num = div.find('div', style=re.compile(r'font-size:\s*[45]\dpx.*font-weight:\s*[89]00'))
        if big_num:
            overview_stats['delayed_count'] = big_num.get_text(strip=True)
            risk_badge = div.find('span', style=re.compile(r'border-radius:\s*20px'))
            if risk_badge:
                overview_stats['risk_level'] = risk_badge.get_text(strip=True)
            for sp in div.find_all('span', style=re.compile(r'font-weight:\s*700')):
                t = sp.get_text(strip=True)
                if '/' in t and '(' in t:
                    overview_stats['delayed_ratio'] = t
                    break
            badge_divs = div.find_all('div', style=re.compile(r'display:\s*flex.*align-items:\s*center.*gap:\s*6px.*border-radius:\s*8px'))
            cats = []
            for bd in badge_divs:
                spans = bd.find_all('span')
                nums = [s.get_text(strip=True) for s in spans if s.get_text(strip=True).isdigit()]
                labels = [s.get_text(strip=True) for s in spans if not s.get_text(strip=True).isdigit() and s.get_text(strip=True)]
                if nums and labels:
                    cats.append(f"{nums[0]} {labels[0]}")
            if cats:
                overview_stats['categories'] = ', '.join(cats)
            risk_box = div.find('div', style=re.compile(r'background:\s*#fef2f2.*border-radius'))
            if risk_box:
                risk_text_div = risk_box.find('div', style=re.compile(r'font-size:\s*13px'))
                if risk_text_div:
                    overview_stats['primary_risk'] = risk_text_div.get_text(strip=True)
            stat_items = div.find_all('div', style=re.compile(r'text-align:\s*center.*flex-shrink'))
            if not stat_items:
                stat_items = div.find_all('div', style=re.compile(r'text-align:\s*center'))
            for si in stat_items:
                val_div = si.find('div', style=re.compile(r'font-size:\s*(2[0-9]|3[0-9])px.*font-weight'))
                label_div = si.find('div', style=re.compile(r'text-transform:\s*uppercase'))
                if val_div and label_div:
                    v = val_div.get_text(strip=True)
                    l = label_div.get_text(strip=True)
                    if l.lower() not in ['delayed'] and v != overview_stats.get('delayed_count'):
                        project_status[l] = v
            continue

    cards = report_div.find_all('div', class_='module-card')
    sections = []

    for card in cards:
        h3 = card.find(['h3', 'h4', 'h2'])
        if h3:
            title = h3.get_text(strip=True)
        else:
            title_span = card.find('span', style=re.compile(r'font-weight:\s*[78]00.*text-transform:\s*uppercase|text-transform:\s*uppercase.*font-weight:\s*[78]00'))
            title = title_span.get_text(strip=True) if title_span else ''

        subtitle_el = card.find('p', style=re.compile(r'color:\s*#64748b|color:\s*#94a3b8'))
        subtitle = subtitle_el.get_text(strip=True) if subtitle_el else ''

        tables = card.find_all('table')
        table_data = []
        for table in tables:
            headers = []
            thead = table.find('thead')
            if thead:
                for th in thead.find_all(['th', 'td']):
                    headers.append(get_cell_text(th))
            if not headers:
                first_tr = table.find('tr')
                if first_tr:
                    for cell in first_tr.find_all(['th', 'td']):
                        headers.append(get_cell_text(cell))
            rows = []
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr', recursive=False):
                cells = tr.find_all(['td'], recursive=False)
                if not cells:
                    cells = tr.find_all(['th', 'td'], recursive=False)
                row = [get_cell_text(c) for c in cells]
                if row and row != headers and any(c for c in row):
                    while len(row) < len(headers):
                        row.append('\u2014')
                    row = row[:len(headers)]
                    rows.append(row)
            if headers and rows:
                table_data.append({'headers': headers, 'rows': rows})

        structured_cards = _extract_structured_cards(card)
        numbered_actions = _extract_numbered_actions(card)
        area_summaries = _extract_area_summaries(card)
        hover_cards = _extract_hover_cards(card)
        priority_cards = _extract_priority_cards(card)

        title_lower_check = title.lower()
        snapshot_data = {}
        biggest_risk_rows = []
        if 'snapshot' in title_lower_check or 'forudsigende' in title_lower_check or 'schedule outlook' in title_lower_check or 'schedule overlook' in title_lower_check:
            snapshot_data = _extract_snapshot_data(card)
        elif 'biggest risk' in title_lower_check or 'prædiktive risiko' in title_lower_check or 'st\u00f8rste' in title_lower_check:
            biggest_risk_rows = _extract_biggest_risk_rows(card)

        confidence_data = {}
        if 'predictive confidence' in title_lower_check or 'tillidsniveau' in title_lower_check:
            confidence_data = _extract_confidence_data(card)

        if structured_cards or hover_cards:
            kv_pairs = []
        else:
            kv_pairs = _extract_kv_from_flex_rows(card)

        header_div = card.find('div', style=re.compile(r'border-bottom:\s*1px\s+solid'), recursive=False)
        if not header_div:
            header_div = card.find('div', recursive=False)
        parsed_blocks = set()
        for sc_div in card.find_all('div', style=re.compile(r'border-left:\s*[34]px'), recursive=True):
            parsed_blocks.add(id(sc_div))
        for hv_div in card.find_all('div', attrs={'onmouseover': True}):
            parsed_blocks.add(id(hv_div))

        body_paragraphs = []
        for p_tag in card.find_all('p'):
            if header_div and header_div in p_tag.parents:
                continue
            in_parsed = False
            for parent in p_tag.parents:
                if id(parent) in parsed_blocks:
                    in_parsed = True
                    break
            if in_parsed:
                continue
            t = p_tag.get_text(strip=True)
            if t and len(t) > 10 and t != subtitle and t != title:
                body_paragraphs.append(t)

        sections.append({
            'title': title,
            'subtitle': subtitle,
            'tables': table_data,
            'kv_pairs': kv_pairs,
            'structured_cards': structured_cards,
            'numbered_actions': numbered_actions,
            'area_summaries': area_summaries,
            'hover_cards': hover_cards,
            'priority_cards': priority_cards,
            'body_paragraphs': body_paragraphs,
            'snapshot_data': snapshot_data,
            'biggest_risk_rows': biggest_risk_rows,
            'confidence_data': confidence_data,
        })

    return sections, overview_stats, project_status


def generate_schedule_analysis_pdf(analysis, user_info=None, language='da'):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = get_styles()
    story = []

    t_labels = {
        'da': {
            'title': 'Tidsplansanalyse',
            'subtitle': 'Pr\u00e6diktiv risikoanalyse',
            'file': 'Fil',
            'ref_date': 'Referencedato',
            'analyzed': 'Analyseret',
            'processing': 'Behandlingstid',
            'model': 'AI Model',
            'user': 'Bruger',
            'generated': 'Genereret',
        },
        'en': {
            'title': 'Schedule Analysis',
            'subtitle': 'Predictive Risk Analysis',
            'file': 'File',
            'ref_date': 'Reference Date',
            'analyzed': 'Analyzed',
            'processing': 'Processing Time',
            'model': 'AI Model',
            'user': 'User',
            'generated': 'Generated',
        }
    }.get(language, {})
    if not t_labels:
        t_labels = {
            'title': 'Schedule Analysis',
            'subtitle': 'Predictive Risk Analysis',
            'file': 'File',
            'ref_date': 'Reference Date',
            'analyzed': 'Analyzed',
            'processing': 'Processing Time',
            'model': 'AI Model',
            'user': 'User',
            'generated': 'Generated',
        }

    filename = analysis.get('filename', '')
    ref_date = analysis.get('reference_date', '')
    processing_time = analysis.get('processing_time')
    model = analysis.get('model', '')
    created_at = analysis.get('created_at', '')

    meta_items = []
    if filename:
        meta_items.append((t_labels['file'], filename))
    if ref_date:
        meta_items.append((t_labels['ref_date'], ref_date))
    if created_at:
        try:
            if isinstance(created_at, str):
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
                dt = created_at
            meta_items.append((t_labels['analyzed'], dt.strftime('%d-%m-%Y %H:%M')))
        except Exception:
            meta_items.append((t_labels['analyzed'], str(created_at)))
    if processing_time:
        meta_items.append((t_labels['processing'], f"{float(processing_time):.1f}s"))
    if model:
        meta_items.append((t_labels['model'], model))
    if user_info:
        user_name = user_info.get('name') or user_info.get('email', '')
        if user_name:
            meta_items.append((t_labels['user'], user_name))
    meta_items.append((t_labels['generated'], datetime.now().strftime('%d-%m-%Y %H:%M')))

    build_cover_page(story, styles, t_labels['title'], t_labels['subtitle'], meta_items, language)
    story.append(PageBreak())

    html_content = analysis.get('predictive_insights', '')
    if not html_content:
        story.append(Paragraph("No analysis content available.", styles['BotMessage']))
        doc.build(story, onFirstPage=add_cover_page_decoration, onLaterPages=add_page_number_and_footer)
        buffer.seek(0)
        return buffer

    sections, overview_stats, project_status = _parse_schedule_module_cards(html_content)

    hero_story = []
    psc = overview_stats.get('status_card', {}) if overview_stats else {}
    if psc:
        sc_hex = psc.get('status_color', '#dc2626')
        try:
            h = sc_hex.lstrip('#')
            sc_color = colors.Color(int(h[0:2], 16)/255, int(h[2:4], 16)/255, int(h[4:6], 16)/255)
        except Exception:
            sc_color = RED_CRITICAL
        sc_bg = colors.Color(254/255, 242/255, 242/255)
        if sc_hex in ('#10b981', '#0d9488'):
            sc_bg = colors.Color(240/255, 253/255, 250/255)
        elif sc_hex == '#d97706':
            sc_bg = colors.Color(255/255, 251/255, 235/255)

        status_label = psc.get('status_label', 'PROJECT STATUS')
        status_badge = psc.get('status_badge', '')
        risk_level = psc.get('risk_level', '')

        hdr_left_para = Paragraph(
            f'<b>{xml_escape(status_label)}</b>'
            + (f'  <font color="{sc_hex}"><b>[{xml_escape(status_badge)}]</b></font>' if status_badge else ''),
            ParagraphStyle('PSCHdrLeft', parent=styles['SectionBodyText'],
                           fontSize=10, textColor=sc_color, fontName='Helvetica-Bold')
        )
        hdr_right_para = Paragraph(
            (f'Risk Level: <b>{xml_escape(risk_level)}</b>' if risk_level else ''),
            ParagraphStyle('PSCHdrRight', parent=styles['TableCell'],
                           fontSize=9, textColor=sc_color, fontName='Helvetica')
        )
        hdr_table = Table([[hdr_left_para, hdr_right_para]], colWidths=[360, 155])
        hdr_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), sc_bg),
            ('LINEBEFORE', (0, 0), (0, -1), 5, sc_color),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, sc_color),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (0, -1), 12),
            ('LEFTPADDING', (1, 0), (1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        hero_story.append(Spacer(1, 8))
        hero_story.append(hdr_table)

        findings = psc.get('findings', [])
        if findings:
            f_rows = []
            for f in findings[:3]:
                f_rows.append(Paragraph(
                    f'\u203a {xml_escape(f)}',
                    ParagraphStyle('PSCFinding', parent=styles['SectionBodyText'],
                                   fontSize=9, leading=13, leftIndent=4)
                ))
            f_table = Table([[p] for p in f_rows], colWidths=[515])
            f_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), sc_bg),
                ('LINEBEFORE', (0, 0), (0, -1), 5, sc_color),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('LINEBELOW', (0, -1), (-1, -1), 0.5, sc_color),
            ]))
            hero_story.append(f_table)

        consequences = psc.get('consequences', [])
        if consequences:
            cons_title = psc.get('consequences_title', 'IF NO ACTION IS TAKEN')
            cons_title_para = Paragraph(
                f'<b>{xml_escape(cons_title)}</b>',
                ParagraphStyle('ConsTitlePara', parent=styles['TableCell'],
                               fontSize=8, textColor=RED_CRITICAL, fontName='Helvetica-Bold',
                               spaceBefore=2, spaceAfter=4)
            )
            cons_rows = [[cons_title_para]]
            for c in consequences[:3]:
                cons_rows.append([Paragraph(
                    f'\u2192 {xml_escape(c)}',
                    ParagraphStyle('ConsBullet', parent=styles['SectionBodyText'],
                                   fontSize=9, leading=13, textColor=colors.Color(153/255, 27/255, 27/255))
                )])
            cons_table = Table(cons_rows, colWidths=[515])
            cons_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.Color(254/255, 242/255, 242/255)),
                ('BOX', (0, 0), (-1, -1), 1, colors.Color(254/255, 202/255, 202/255)),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            hero_story.append(cons_table)
        hero_story.append(Spacer(1, 12))

    if overview_stats and not psc:
        _hero_label = 'Projektstatus' if language == 'da' else 'Project Status'
        hero_story.extend(_sa_section_header(_hero_label, styles, ORANGE_RISK))

        overview_rows = []
        if overview_stats.get('risk_level'):
            overview_rows.append(_sa_key_value_row('Risk Level', overview_stats['risk_level'], styles))
        if overview_stats.get('delayed_count'):
            overview_rows.append(_sa_key_value_row('Delayed Activities', overview_stats['delayed_count'], styles))
        if overview_stats.get('delayed_ratio'):
            overview_rows.append(_sa_key_value_row('Delayed / Total', overview_stats['delayed_ratio'], styles))
        if overview_stats.get('categories'):
            overview_rows.append(_sa_key_value_row('Breakdown', overview_stats['categories'], styles))
        if overview_stats.get('primary_risk'):
            overview_rows.append(_sa_key_value_row('Primary Risk', overview_stats['primary_risk'], styles))
        for label, value in project_status.items():
            overview_rows.append(_sa_key_value_row(label, value, styles))

        if overview_rows:
            ov_table = Table(overview_rows, colWidths=[120, 375])
            ov_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (0, -1), 8),
                ('LEFTPADDING', (1, 0), (1, -1), 14),
                ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
                ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
            ]))
            hero_story.append(ov_table)
            hero_story.append(Spacer(1, 8))

    SECTION_COLORS = {
        'snapshot': AMBER_IMPORTANT,
        'schedule outlook': AMBER_IMPORTANT,
        'schedule overlook': AMBER_IMPORTANT,
        'forudsigende': AMBER_IMPORTANT,
        'biggest risk': RED_CRITICAL,
        'prædiktive risiko': RED_CRITICAL,
        'største': RED_CRITICAL,
        'predictive action': colors.Color(124/255, 58/255, 237/255),
        'prædiktive handlinger': colors.Color(124/255, 58/255, 237/255),
        'executive action': colors.Color(124/255, 58/255, 237/255),
        'ledelsens handlingsplan': colors.Color(124/255, 58/255, 237/255),
        'predictive confidence': colors.Color(5/255, 150/255, 105/255),
        'tillidsniveau': colors.Color(5/255, 150/255, 105/255),
        'management conclusion': TEAL_PRIMARY,
        'ledelseskonklusion': TEAL_PRIMARY,
        'schedule overview': colors.Color(37/255, 99/255, 235/255),
        'tidsplanoversigt': colors.Color(37/255, 99/255, 235/255),
        'delayed activities': ORANGE_RISK,
        'forsinkede aktiviteter': ORANGE_RISK,
        'root cause': RED_CRITICAL,
        'årsagsanalyse': RED_CRITICAL,
        'priority actions': colors.Color(124/255, 58/255, 237/255),
        'prioriterede handlinger': colors.Color(124/255, 58/255, 237/255),
        'resource assessment': colors.Color(5/255, 150/255, 105/255),
        'forcing assessment': AMBER_IMPORTANT,
        'summary by area': colors.Color(37/255, 99/255, 235/255),
        'oversigt efter område': colors.Color(37/255, 99/255, 235/255),
        'top 3': RED_CRITICAL,
        'summary': TEAL_PRIMARY,
    }

    hero_inserted = False
    prev_was_exec = False
    past_predictive = False
    _EXEC_KEYS = {
        'executive action', 'ledelsens handlingsplan', 'ledelsens',
        'predictive action', 'prædiktive handlinger',
    }
    _PREDICTIVE_KEYS = {
        'snapshot', 'schedule outlook', 'schedule overlook', 'forudsigende',
        'biggest risk', 'prædiktive', 'største',
        'predictive confidence', 'tillidsniveau',
    }

    for section in sections:
        title = section['title']
        if not title:
            continue

        color = DARK_HEADER
        title_lower = title.lower()
        for key, c in SECTION_COLORS.items():
            if key in title_lower:
                color = c
                break

        is_predictive_section = any(k in title_lower for k in _PREDICTIVE_KEYS)
        is_exec_section = any(k in title_lower for k in _EXEC_KEYS)

        _should_insert_hero = (
            prev_was_exec or
            (past_predictive and not is_predictive_section and not is_exec_section)
        )
        if not hero_inserted and hero_story and _should_insert_hero:
            story.extend(hero_story)
            hero_inserted = True

        if not is_predictive_section:
            past_predictive = True
        prev_was_exec = is_exec_section

        if section.get('snapshot_data'):
            AMBER_DARK_HDR = colors.Color(146/255, 64/255, 14/255)
            snap_header = Table(
                [[
                    Paragraph(f'<b>{xml_escape(title)}</b>', ParagraphStyle(
                        'SnapHdrL', parent=styles['SectionHeader'],
                        textColor=AMBER_DARK_HDR, fontSize=12, leading=16
                    )),
                    Paragraph(
                        '<b>\u25ba</b>',
                        ParagraphStyle('SnapHdrR', parent=styles['SectionHeader'],
                                       textColor=WHITE, fontSize=12, leading=16)
                    )
                ]],
                colWidths=[400, 115]
            )
            snap_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.Color(255/255, 251/255, 235/255)),
                ('BACKGROUND', (1, 0), (1, -1), TEAL_PRIMARY),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (0, -1), 14),
                ('LEFTPADDING', (1, 0), (1, -1), 8),
                ('BOX', (0, 0), (-1, -1), 1.5, AMBER_IMPORTANT),
            ]))
            story.append(Spacer(1, 14))
            story.append(snap_header)
            story.append(Spacer(1, 8))
            rendered = _sa_render_snapshot_card(section, styles, language=language)
            if rendered:
                story.extend(rendered)
            story.append(Spacer(1, 6))
            continue

        story.extend(_sa_section_header(title, styles, color))

        if section.get('biggest_risk_rows'):
            rendered = _sa_render_biggest_risk_card(section, styles)
            if rendered:
                story.extend(rendered)
            story.append(Spacer(1, 6))
            continue

        if section.get('confidence_data'):
            cd = section['confidence_data']
            level = cd.get('level', '')
            basis = cd.get('basis', '')
            c_hex = cd.get('color', '#10b981')
            try:
                h = c_hex.lstrip('#')
                c_rgb = colors.Color(int(h[0:2], 16)/255, int(h[2:4], 16)/255, int(h[4:6], 16)/255)
            except Exception:
                c_rgb = colors.Color(16/255, 185/255, 129/255)
            if level:
                badge_para = Paragraph(
                    f'<b>{xml_escape(level)}</b>',
                    ParagraphStyle('ConfBadge', parent=styles['TableCell'],
                                   fontSize=10, textColor=c_rgb, fontName='Helvetica-Bold')
                )
                badge_tbl = Table([[badge_para]], colWidths=[80])
                badge_tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                    ('BOX', (0, 0), (-1, -1), 1.5, c_rgb),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('ROUNDEDCORNERS', [10, 10, 10, 10]),
                ]))
                story.append(badge_tbl)
                story.append(Spacer(1, 4))
            if basis:
                story.append(Paragraph(
                    f'<i>{xml_escape(basis)}</i>',
                    ParagraphStyle('ConfBasisText', parent=styles['SectionBodyText'],
                                   fontSize=9, textColor=colors.Color(100/255, 116/255, 139/255),
                                   fontName='Helvetica-Oblique')
                ))
            story.append(Spacer(1, 6))
            continue

        if section['subtitle']:
            story.append(Paragraph(
                f'<i>{xml_escape(section["subtitle"])}</i>',
                styles['SectionBodyText']
            ))
            story.append(Spacer(1, 4))

        if section['body_paragraphs'] and not section['structured_cards'] and not section['numbered_actions']:
            for para in section['body_paragraphs']:
                story.append(Paragraph(f'\u2022 {xml_escape(para)}', styles['SectionBodyText']))
            story.append(Spacer(1, 4))

        if section['kv_pairs']:
            kv_rows = []
            for label, value in section['kv_pairs']:
                kv_rows.append(_sa_key_value_row(label, value, styles))
            if kv_rows:
                kv_table = Table(kv_rows, colWidths=[140, 355])
                kv_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (0, -1), 8),
                    ('LEFTPADDING', (1, 0), (1, -1), 14),
                    ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER_GRAY),
                    ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
                ]))
                story.append(kv_table)
                story.append(Spacer(1, 6))

        if section['structured_cards']:
            for sc in section['structured_cards']:
                card_header_parts = []
                if sc['id']:
                    card_header_parts.append(f'<b>{xml_escape(sc["id"])}</b>')
                if sc['title']:
                    card_header_parts.append(xml_escape(sc['title']))
                if sc.get('badge'):
                    card_header_parts.append(f'[{xml_escape(sc["badge"])}]')
                if sc.get('tag'):
                    card_header_parts.append(f'({xml_escape(sc["tag"])})')
                header_text = ' \u2014 '.join(card_header_parts) if card_header_parts else ''

                if header_text:
                    card_hdr = Table(
                        [[Paragraph(header_text, ParagraphStyle(
                            'CardHdr', parent=styles['SectionBodyBold'], fontSize=9, textColor=DARK_HEADER
                        ))]],
                        colWidths=[495]
                    )
                    card_hdr.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), CYAN_LIGHT),
                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ]))
                    story.append(card_hdr)

                if sc['fields']:
                    field_rows = []
                    for fl, fv in sc['fields']:
                        field_rows.append([
                            Paragraph(f'<b>{xml_escape(fl)}</b>', ParagraphStyle(
                                'FieldLabel', parent=styles['TableCell'], fontSize=7.5,
                                textColor=MEDIUM_GRAY, fontName='Helvetica-Bold'
                            )),
                            Paragraph(xml_escape(fv), styles['SectionBodyText'])
                        ])
                    if field_rows:
                        ft = Table(field_rows, colWidths=[110, 385])
                        ft.setStyle(TableStyle([
                            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('TOPPADDING', (0, 0), (-1, -1), 3),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                            ('LEFTPADDING', (0, 0), (0, -1), 12),
                            ('LEFTPADDING', (1, 0), (1, -1), 10),
                            ('LINEBELOW', (0, 0), (-1, -2), 0.3, BORDER_GRAY),
                        ]))
                        story.append(ft)

                story.append(Spacer(1, 8))

        if section['hover_cards']:
            for hc in section['hover_cards']:
                parts = []
                if hc['id']:
                    parts.append(f'<b>{xml_escape(hc["id"])}</b>')
                if hc['tag']:
                    parts.append(f'[{xml_escape(hc["tag"])}]')
                if hc['title']:
                    parts.append(f'\u2014 {xml_escape(hc["title"])}')
                story.append(Paragraph(' '.join(parts), styles['SectionBodyBold']))
                if hc['description']:
                    story.append(Paragraph(
                        xml_escape(hc['description']),
                        styles['SectionBodyText']
                    ))
                story.append(Spacer(1, 5))

        if section['priority_cards']:
            for pc in section['priority_cards']:
                header = f'<b>{xml_escape(pc["number"])}.</b> {xml_escape(pc["action"])}'
                story.append(Paragraph(header, styles['SectionBodyText']))
                meta_parts = []
                if pc['date']:
                    meta_parts.append(f'<b>Deadline:</b> {xml_escape(pc["date"])}')
                if pc['owner']:
                    meta_parts.append(f'<b>Owner:</b> {xml_escape(pc["owner"])}')
                if meta_parts:
                    story.append(Paragraph(
                        ' | '.join(meta_parts),
                        ParagraphStyle('PcMeta', parent=styles['SectionBodyText'],
                                       fontSize=8, textColor=MEDIUM_GRAY)
                    ))
                if pc['note']:
                    note_text = pc['note']
                    if pc['note_desc']:
                        note_text += f' \u2014 {pc["note_desc"]}'
                    story.append(Paragraph(
                        f'<i>{xml_escape(note_text)}</i>',
                        ParagraphStyle('PcNote', parent=styles['SectionBodyText'],
                                       fontSize=8, textColor=RED_CRITICAL)
                    ))
                story.append(Spacer(1, 6))

        if section['numbered_actions']:
            for action in section['numbered_actions']:
                story.append(Paragraph(xml_escape(action), styles['SectionBodyText']))
                story.append(Spacer(1, 3))
            story.append(Spacer(1, 4))

        if section['area_summaries']:
            for area in section['area_summaries']:
                area_parts = [f'<b>{xml_escape(area["name"])}</b>']
                if area['count']:
                    area_parts.append(f' \u2014 {xml_escape(area["count"])} delayed')
                if area['detail']:
                    area_parts.append(f' ({xml_escape(area["detail"])})')
                story.append(Paragraph(''.join(area_parts), styles['SectionBodyBold']))
                if area['description']:
                    story.append(Paragraph(
                        f'  {xml_escape(area["description"])}',
                        styles['SectionBodyText']
                    ))
                story.append(Spacer(1, 4))

        for tbl in section['tables']:
            headers = tbl['headers']
            rows = tbl['rows']

            num_cols = len(headers)
            if num_cols == 0:
                continue

            available = 515
            col_widths = [available / num_cols] * num_cols

            if num_cols >= 8:
                id_w = 28
                name_w = 120
                date_w = 52
                dur_w = 35
                pct_w = 35
                days_w = 42
                type_w = 55
                prio_w = 55
                if num_cols == 9:
                    col_widths = [id_w, name_w, date_w, date_w, dur_w, pct_w, days_w, type_w, prio_w]
                elif num_cols >= 10:
                    extra = available - (id_w + name_w + 2*date_w + dur_w + pct_w + days_w + type_w + prio_w)
                    col_widths = [id_w, name_w, date_w, date_w, dur_w, pct_w, days_w, type_w, prio_w]
                    for _ in range(num_cols - 9):
                        col_widths.append(max(extra, 40))

            header_cells = [Paragraph(f'<b>{xml_escape(h)}</b>', styles['TableHeaderCell']) for h in headers]
            table_rows = [header_cells]

            for row in rows:
                row_cells = []
                for ci, cell_text in enumerate(row):
                    safe = xml_escape(str(cell_text)) if cell_text else '\u2014'
                    priority_lower = cell_text.lower() if cell_text else ''
                    if 'critical' in priority_lower or 'kritisk' in priority_lower:
                        style = ParagraphStyle('CritCell', parent=styles['TableCell'],
                                               textColor=RED_CRITICAL, fontName='Helvetica-Bold')
                    elif 'important' in priority_lower or 'vigtig' in priority_lower:
                        style = ParagraphStyle('ImpCell', parent=styles['TableCell'],
                                               textColor=AMBER_IMPORTANT, fontName='Helvetica-Bold')
                    elif 'monitor' in priority_lower:
                        style = ParagraphStyle('MonCell', parent=styles['TableCell'],
                                               textColor=CYAN_MONITOR)
                    else:
                        style = styles['TableCell']
                    row_cells.append(Paragraph(safe, style))
                table_rows.append(row_cells)

            t = Table(table_rows, colWidths=col_widths, repeatRows=1)
            t_style = [
                ('BACKGROUND', (0, 0), (-1, 0), DARK_HEADER),
                ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
                ('FONTSIZE', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
            ]
            t.setStyle(TableStyle(t_style))
            story.append(t)
            story.append(Spacer(1, 8))

    if not hero_inserted and hero_story:
        story.extend(hero_story)

    doc.build(story, onFirstPage=add_cover_page_decoration, onLaterPages=add_page_number_and_footer)
    buffer.seek(0)
    return buffer
