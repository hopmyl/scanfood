# -*- coding: utf-8 -*-
"""Body of the СканРецепт beginner-friendly architecture report.
Route: Report (ReportLab). Palette: Template 07 Crystal Blue body subset (fixed).
TOC -> TocDocTemplate (BaseDocTemplate) + multiBuild. Cover merged later via pypdf.
"""
import os, sys, hashlib

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, CondPageBreak, KeepTogether, Image, HRFlowable,
)
from reportlab.platypus.tableofcontents import TableOfContents
from PIL import Image as PILImage

SKILL_SCRIPTS = '/home/z/my-project/skills/pdf/scripts'
if SKILL_SCRIPTS not in sys.path:
    sys.path.insert(0, SKILL_SCRIPTS)
from pdf import install_font_fallback  # noqa: E402

BUILD = '/home/z/my-project/scripts/pdf_build'

# ── Palette: Template 07 Crystal Blue body subset (fixed by spec) ──
PAGE_BG      = colors.HexColor('#f5f8fc')
SECTION_BG   = colors.HexColor('#edf2f9')
CARD_BG      = colors.HexColor('#e4ecf5')
TABLE_STRIPE = colors.HexColor('#eef3fa')
HEADER_FILL  = colors.HexColor('#1a4a7a')
BORDER       = colors.HexColor('#c0d0e2')
ACCENT       = colors.HexColor('#2d7ab3')
TEXT_PRIMARY = colors.HexColor('#142840')
TEXT_MUTED   = colors.HexColor('#5a7a96')

# ── Fonts ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Noto Sans SC', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Noto Sans SC Bold', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('Noto Sans SC', normal='Noto Sans SC', bold='Noto Sans SC Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')
install_font_fallback()

# ── Page geometry ──
MARGIN = 0.9 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - 2 * MARGIN
MAX_KEEP_HEIGHT = PAGE_H * 0.4
H1_THRESHOLD = AVAIL_H * 0.25

DOC_TITLE = 'СканРецепт — архитектурный аудит простыми словами'

# ── Styles ──
body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
                      alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY,
                      spaceBefore=0, spaceAfter=10)
lead = ParagraphStyle('Lead', parent=body, fontSize=11, leading=18, textColor=TEXT_PRIMARY)
h1 = ParagraphStyle('H1', fontName='FreeSerif', fontSize=21, leading=27,
                    textColor=HEADER_FILL, spaceBefore=14, spaceAfter=4)
h2 = ParagraphStyle('H2', fontName='FreeSerif', fontSize=14.5, leading=20,
                    textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6)
bullet = ParagraphStyle('Bullet', parent=body, alignment=TA_LEFT,
                        leftIndent=16, firstLineIndent=-16, spaceAfter=7)
caption = ParagraphStyle('Caption', fontName='FreeSerif', fontSize=8.5, leading=12,
                         alignment=TA_CENTER, textColor=TEXT_MUTED,
                         spaceBefore=3, spaceAfter=6)
cell_txt = ParagraphStyle('CellTxt', fontName='FreeSerif', fontSize=9.2, leading=13,
                          alignment=TA_LEFT, textColor=TEXT_PRIMARY)
cell_hdr = ParagraphStyle('CellHdr', fontName='FreeSerif', fontSize=9.6, leading=13,
                          alignment=TA_LEFT, textColor=colors.white)
stat_big = ParagraphStyle('StatBig', fontName='FreeSerif', fontSize=19, leading=23,
                          textColor=ACCENT, alignment=TA_CENTER)
stat_lbl = ParagraphStyle('StatLbl', fontName='FreeSerif', fontSize=8.5, leading=11,
                          textColor=TEXT_MUTED, alignment=TA_CENTER)
toc_title = ParagraphStyle('TocTitle', fontName='FreeSerif', fontSize=20, leading=26,
                           textColor=HEADER_FILL, spaceAfter=14)


# ── Doc template with TOC support and page decoration ──
def draw_page(canvas, doc):
    canvas.saveState()
    # page background (Crystal Blue XL tier)
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # header: title + accent rule
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 38, DOC_TITLE)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN, PAGE_H - 44, PAGE_W - MARGIN, PAGE_H - 44)
    # footer: light rule + author + page number
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 32, 'Z.ai · ноябрь 2026')
    page_label = 'i' if doc.page == 1 else str(doc.page - 1)
    canvas.drawRightString(PAGE_W - MARGIN, 32, page_label)
    canvas.restoreState()


class TocDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        frame = Frame(MARGIN, MARGIN, AVAIL_W, AVAIL_H, id='normal',
                      leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0)
        self.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=draw_page)])

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            # displayed numbering: TOC page is 'i', body starts at 1 => page-1
            self.notify('TOCEntry', (level, text, self.page - 1, key))


def ru(text):
    """Russian typography: bind em-dash to preceding word (no dash at line start)."""
    return text.replace(' \u2014 ', '\u00a0\u2014 ')


def heading(text, level=0):
    text = ru(text)
    key = 'h_' + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', h1 if level == 0 else h2)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


def safe_keep_together(elements):
    total_h = 0
    for el in elements:
        w, hgt = el.wrap(AVAIL_W, AVAIL_H)
        total_h += hgt
    if total_h <= MAX_KEEP_HEIGHT:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)


def section(story, title, first_flowables):
    """H1 + accent rule + first block, orphan-protected."""
    story.append(CondPageBreak(H1_THRESHOLD))
    rule = HRFlowable(width='100%', color=ACCENT, thickness=1.2,
                      spaceBefore=0, spaceAfter=10)
    story.extend(safe_keep_together([heading(title, 0), rule] + first_flowables))


def embed_image(path, max_width=AVAIL_W, max_height=A4[1] * 0.35):
    pil = PILImage.open(path)
    ow, oh = pil.size
    ratio = min(max_width / ow if ow > max_width else 1.0,
                max_height / oh if oh > max_height else 1.0)
    return Image(path, width=ow * ratio, height=oh * ratio)


def figure(story, path, cap, max_width=AVAIL_W, max_height=A4[1] * 0.35):
    img = embed_image(path, max_width, max_height)
    story.append(Spacer(1, 14))
    story.extend(safe_keep_together([img, Paragraph(ru(cap), caption)]))
    story.append(Spacer(1, 12))


def make_table(headers, rows, ratios, hdr_align=TA_LEFT):
    col_w = [r * AVAIL_W for r in ratios]
    assert abs(sum(ratios) - 1.0) < 0.01
    assert sum(col_w) <= AVAIL_W + 0.5
    data = [[Paragraph(ru(f'<b>{t}</b>'), cell_hdr) for t in headers]]
    for row in rows:
        data.append([Paragraph(ru(t), cell_txt) for t in row])
    tbl = Table(data, colWidths=col_w, hAlign='CENTER', repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5.5),
    ]
    for i in range(1, len(data)):
        style.append(('BACKGROUND', (0, i), (-1, i),
                      colors.white if i % 2 == 1 else TABLE_STRIPE))
    tbl.setStyle(TableStyle(style))
    return tbl


def table_block(story, headers, rows, ratios, cap):
    story.append(Spacer(1, 16))
    story.append(make_table(headers, rows, ratios))
    story.append(Spacer(1, 4))
    story.append(Paragraph(cap, caption))
    story.append(Spacer(1, 12))


def P(text, style=body):
    return Paragraph(ru(text), style)


# ══════════════════════ STORY ══════════════════════
story = []

# ── TOC page (displayed as 'i') ──
story.append(Paragraph('<b>Содержание</b>', toc_title))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC0', fontName='FreeSerif', fontSize=11.5, leading=20,
                   leftIndent=6, textColor=TEXT_PRIMARY),
]
story.append(toc)
story.append(PageBreak())

# ── Раздел 1 ──
section(story, '1. Зачем этот отчёт и как его читать', [
    P('5 ноября 2026 года сайт СканРецепт прошёл полный «техосмотр»: проверен весь код '
      'приложения, все данные о блюдах, все 260 фотографий, скрипты публикации и даже '
      'то, как сайт выглядит для поисковиков. Сама еда не проверялась — проверялось то, '
      '<b>как устроен сайт внутри</b>, как автомобиль на СТО: смотрят не на цвет кузова, '
      'а под капот. Такой осмотр называется <b>архитектурным аудитом</b>.', lead),
    P('Всего набралось <b>28 находок</b>. Каждая отнесена к одному из трёх уровней '
      'серьёзности. <b>Критичные</b> — их чиним сразу: это утечки информации и поломки '
      'в главной функции сайта. <b>Важные</b> — они не ломают сайт сегодня, но заметно '
      'замедляют его и мешают развитию; их стоит распланировать на ближайшие недели. '
      '<b>Полировка</b> — мелкие недочёты и «мусор» в коде: наводим порядок, когда будет '
      'свободный час.', body),
])

stats = Table(
    [[P('<b>260</b>', stat_big), P('<b>399</b>', stat_big),
      P('<b>28</b>', stat_big), P('<b>0</b>', stat_big)],
     [P('фотографий блюд', stat_lbl), P('рецептов в данных', stat_lbl),
      P('находок аудита', stat_lbl), P('ошибок проверки типов', stat_lbl)]],
    colWidths=[AVAIL_W * 0.25] * 4, hAlign='CENTER')
stats.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('BOX', (0, 0), (-1, -1), 1, ACCENT),
    ('LINEAFTER', (0, 0), (-2, -1), 0.5, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, 0), 9),
    ('BOTTOMPADDING', (0, 1), (-1, 1), 9),
    ('TOPPADDING', (0, 1), (-1, 1), 1),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
]))
story.append(Spacer(1, 8))
story.append(stats)
story.append(Spacer(1, 6))

figure(story, f'{BUILD}/chart_severity.png',
       'Рисунок 1. Все 28 находок по уровням серьёзности: 4 критичных, 10 важных, 14 полировка',
       max_width=AVAIL_W * 0.86, max_height=215)

story.append(P('<b>Главный вывод.</b> Сайт в хорошей форме: данные о блюдах образцовые '
               '(ни одного дубликата или битой ссылки), замок платной части непробиваем, '
               'ошибок в типах — ноль. Реальные риски сосредоточены в трёх местах: '
               'публикация лишних файлов, работа со сканером штрих-кодов и вес «стартового» '
               'файла приложения. Всё это чинится, и почти всё — быстро.', body))

# ── Раздел 2 ──
section(story, '2. Как устроен сайт', [
    P('СканРецепт — это <b>PWA</b> (Progressive Web App): обычный сайт, который можно '
      '«установить» на телефон как приложение и который частично работает без интернета. '
      'Схема ниже показывает весь путь: где сайт живёт, как к нему попадает посетитель и '
      'что приложение использует для работы.', lead),
])

figure(story, f'{BUILD}/diagram_arch.png',
       'Рисунок 2. Большая картина: из чего состоит СканРецепт и как узлы связаны между собой',
       max_width=AVAIL_W, max_height=330)

story.append(P('<b>Хостинг.</b> Сайт размещён на бесплатном хостинге GitHub Pages и '
               'доступен по двум адресам-«зеркалам»: главному hopmyl.github.io и '
               'запасному hopmyl.github.io/scanfood/. Зеркала — это две копии одного и '
               'того же сайта: если одна недоступна, работает вторая. Обновляются они '
               'одним скриптом deploy-all.sh.', body))
story.append(P('<b>Приложение.</b> Весь код (7 экранов, 3 компонента, общее хранилище '
               'настроек) собирается в один файл index-*.js — его называют <b>бандл</b> '
               '(«свёрток»). Сейчас он весит около 1,3 МБ, и посетитель скачивает его '
               'целиком при первом открытии — об этом в разделе 8.', body))
story.append(P('<b>Данные и фото.</b> Рецепты хранятся прямо в коде — 399 блюд в 25 '
               'файлах-таблицах; 260 из них уже имеют фотографии, и только они показываются '
               'в каталоге (161 бесплатных ЛАЙТ и 99 платных PRO). <b>Сканер</b> — единственная '
               'часть, которая ходит во внешние сервисы: снимок продукта уходит нейросети '
               'OpenRouter на распознавание, а штрих-коды сверяются с открытой базой '
               'Open Food Facts.', body))

# ── Раздел 3 ──
section(story, '3. Что уже в порядке (зелёные зоны)', [
    P('Аудит — это не только список проблем. Не меньше половины проверки пришлась на '
      'зоны, которые работают отлично. Их важно знать: при будущих доработках эти части '
      'нельзя случайно сломать, а переделывать «на всякий случай» — не нужно.', lead),
])
table_block(story,
    ['Зона', 'Что именно проверено и в порядке'],
    [
        ['Данные о блюдах', '0 дубликатов id; каждая фотография на месте (260 из 260); '
         'платные/бесплатные списки без ошибок; калории сходятся с формулой 4/4/9; '
         'дублей названий нет'],
        ['Платный доступ (пейволл)', 'PRO-замок в карточке блюда непробиваем из интерфейса; '
         'скан списывается до распознавания и честно возвращается при неудаче; '
         'демо-скан не списывает лимит'],
        ['Сканер', 'правильно понимает все коды ошибок: 429 показывает человеческим текстом, '
         'отключённый сервис — «недоступно», а не пугающим сбоем; возвраты и «Повторить» работают'],
        ['PWA и кэш', 'кэшируется только «каркас» приложения, фото — нет; старые версии '
         'автоматически удаляются; иконки и manifest корректны'],
        ['Мобильная версия', 'учтены «чёлки» и жести iPhone, тап-подсветка отключена, '
         'темы меняются без перезагрузки'],
        ['SEO-база', 'русский язык страницы, заголовки, описания картинок — всё на месте'],
        ['Сборка и деплой', 'адреса для двух зеркал собираются корректно; инструкции для '
         'Vercel, Netlify и РФ-хостингов в порядке'],
        ['Типы и качество кода', 'строгий режим TypeScript: 0 ошибок, ни одного обхода типов'],
    ],
    [0.24, 0.76],
    'Таблица 1. Зелёные зоны: что проверено и работает как надо')

# ── Раздел 4 ──
section(story, '4. Критичные проблемы — 4 (чиним сразу)', [
    P('Это находки, которые либо уже привели к утечке, либо ломают главную функцию сайта. '
      'Формулировка у каждой одна и та же: что случилось, почему это важно и что делать.', lead),
])

story.append(P('<b>К1. Архив исходников лежал в публичной папке</b>', h2))
story.append(P('В публичной папке сайта находился архив skanrecept-src-2026-10-29.zip '
               '(15 МБ, 161 файл) со всем кодом и всей рецептурной базой — главным активом '
               'проекта. Любой посетитель мог скачать его одной ссылкой, а при следующем '
               'обновлении архива туда легко попал бы и настоящий секретный ключ. '
               '<b>Статус: уже исправлено</b> — архив удалён и добавлено правило против '
               'попадания новых zip-архивов в публичную папку (коммит b1fca3f).', body))

story.append(P('<b>К2. Ключ распознавания вшивается в файл приложения</b>', h2))
story.append(P('При сборке сайта для зеркал в открытый файл приложения зашивается ключ '
               'сервиса OpenRouter. Технически любой посетитель может вытащить его из '
               'браузера. Сейчас это не страшно: ключ без денег на счету и работает только '
               'с бесплатными моделями. Но защита должна быть дисциплиной, а не везением: '
               'держать на ключе нулевой кредитный лимит, следить за расходом и ротировать '
               'его; в перспективе — убрать ключ из публичного файла совсем и ходить через '
               'свой сервер-посредник.', body))

story.append(P('<b>К3. Сканер штрих-кодов «замирает» после первого товара</b>', h2))
story.append(P('После первого найденного (или не найденного) товара камера останавливается, '
               'но экран выглядит как живой: видоискатель и лазерная линия на месте, а кадр '
               'заморожен и сканирование не идёт. Продолжить можно только переключив режим '
               '«Продукты → Штрих-код» и обратно. Это ломает главный сценарий «отсканировать '
               'несколько покупок подряд» — ядро всей функции. Лечение: кнопка «Сканировать '
               'другой» должна заново запускать камеру (перезапуск эффекта через счётчик '
               'запусков).', body))

story.append(P('<b>К4. При зависшем сервере посетитель ждёт до двух минут</b>', h2))
story.append(P('Распознавание продукта идёт по цепочке из трёх серверов. Если первый в '
               'цепочке жив, но жутко тормозит, клиент честно ждёт каждый шаг: 55 + 55 + '
               '70 секунд — до трёх минут с надписью «Распознаём продукты…». На телефоне '
               'столько никто не подождёт. Лечение: разные лимиты ожидания для разных шагов '
               '(10–25 секунд вместо 55) и запуск запросов «наперегонки» — чей ответ пришёл '
               'первым, тот и побеждает.', body))

# ── Раздел 5 ──
section(story, '5. Важные проблемы — 10 (планируем на недели)', [
    P('«Важные» — это не аварии, а то, что тормозит сайт и мешает развитию: тяжёлый '
      'стартовый файл, копипаста в четырёх местах, вечное накопление мусора на зеркалах. '
      'Каждая строка таблицы — суть проблемы и быстрое решение; детали — в исходном '
      'отчёте architect-report.md.', lead),
])
table_block(story,
    ['№', 'Проблема и почему важно', 'Быстрое решение'],
    [
        ['В1', 'Стартовый файл — монолит 1,84 МБ: библиотека сканера штрих-кодов (zxing, '
         '0,5 МБ) скачивается всеми, даже тем, кто никогда не сканирует',
         'ленивая загрузка: подгружать zxing и тяжёлые экраны только при входе в режим'],
        ['В2', 'Прямой запрос к базе товаров без таймаута: при сбое кнопка «Ищем товар» '
         'висит вечно',
         'таймаут 9 секунд, проверка ответа, кэш товара в браузере'],
        ['В3', 'Логика распознавания скопирована в 4 копии (Vercel, Netlify, сервер, '
         'клиент): правка в одном месте расходится с остальными',
         'один общий источник + автопроверка совпадения копий при сборке'],
        ['В4', 'Старые версии файлов навсегда копятся на зеркалах: репозиторий публикации '
         'растёт с каждым деплоем',
         'зеркалирование через rsync --delete: лишнее удаляется'],
        ['В5', 'Страница 404.html (спасает прямые ссылки на телефонах) создаётся только '
         'руками в скрипте деплоя — новый способ публикации молча её потеряет',
         'перенести копирование в шаг сборки сайта'],
        ['В6', 'Не было превью для мессенджеров: ссылка в Telegram/WhatsApp разворачивалась '
         'без картинки — а «вкусная картинка» приводит установки',
         '<b>уже добавлено</b> (OG-теги, ноябрь 2026)'],
        ['В7', 'robots.txt без карты сайта; два зеркала конкурируют между собой в поиске',
         'добавить sitemap.xml из 260 карточек и canonical-ссылку на главное зеркало'],
        ['В8', 'На платной карточке рисуются два одинаковых бейджа PRO один поверх другого',
         'удалить дубль, оставить один бейдж'],
        ['В9', 'Надпись «осталось 5 сканов» повторяет цифру в трёх местах: поменяешь лимит — '
         'текст соврёт',
         'везде использовать константу FREE_SCANS_LIMIT'],
        ['В10', 'Устаревшие числа в комментариях и README («54 страны» вместо 111, '
         '«100 рецептов» вместо 260/399)',
         'пересчитать и переписать; выдавать фактические квоты скриптом'],
    ],
    [0.065, 0.545, 0.39],
    'Таблица 2. Важные находки В1–В10')

# ── Раздел 6 ──
section(story, '6. Полировка — 14 (когда будет время)', [
    P('Эти находки не влияют на работу сайта сегодня. Это «гигиена кода»: маленькие '
      'шероховатости, которые приятно закрыть одним вечером наведения порядка.', lead),
])
table_block(story,
    ['№', 'Заметка', 'Что сделать'],
    [
        ['Н1', 'Выбранное число порций не сбрасывается при переходе к другому блюду', 'сбрасывать при смене блюда'],
        ['Н2', 'Защита сканера от двойного запуска фактически не работает (устаревшее замыкание)', 'флаг-переключатель через useRef'],
        ['Н3', '46 ингредиентов в 36 блюдах без количества («Соль, перец»)', 'добавить пометку «по вкусу»'],
        ['Н4', 'Подбор «добавь один продукт» не знает части смесей («Имбирь, чеснок»)', 'дополнить справочник продуктов'],
        ['Н5', 'Список «блюда без фото» вычисляется, но нигде не показывается', 'показать счётчик или удалить'],
        ['Н6', 'Блюдо без описания молча исчезнет из фильтра «до 30 минут»', 'проверка при сборке'],
        ['Н7', 'Каталог рисует все 260 карточек сразу — на слабых телефонах ощутимо', 'показывать по 40 карточек'],
        ['Н8', 'Счётчик сканирований в профиле не откатывается при возврате скана', 'решить и задокументировать'],
        ['Н9', 'Текст «сервер не ответил за 55 с» пришит к таймауту намертво', 'подставлять число из константы'],
        ['Н10', 'Токен деплоя вырезается из адреса репозитория — хрупко', 'брать из переменной окружения'],
        ['Н11', '260 фото (33 МБ) перезаливаются на зеркала при каждом деплое', 'сжать в WebP + подключить CDN'],
        ['Н12', 'Не загрузившееся фото прячется в заглушку до перезагрузки страницы', 'одна повторная попытка'],
        ['Н13', '60+ служебных файлов фото-конвейера лежат в scripts/', 'перенести в ops/photo-pipeline/'],
        ['Н14', 'Тяжёлые папки (скрины, архивы, дампы) коммитятся в репозиторий', 'добавить в .gitignore'],
    ],
    [0.075, 0.565, 0.36],
    'Таблица 3. Полировка Н1–Н14')

# ── Раздел 7 ──
section(story, '7. Как проверяются фотографии', [
    P('У каталога 260 фотографий, и все они генерируются нейросетью. Чтобы посетитель не '
      'видел «пластиковых» или выдуманных блюд, работает автоматический конвейер качества: '
      'он не только создаёт фото, но и сам же их проверяет и переделывает брак.', lead),
])

figure(story, f'{BUILD}/diagram_pipeline.png',
       'Рисунок 3. Конвейер проверки фотографий: от очереди блюд до публикации на зеркалах',
       max_width=AVAIL_W * 0.92, max_height=315)

story.append(P('Конвейер запускается автоматически каждые 30 минут (это называется '
               '<b>крон</b> — задача-будильник на сервере). Он берёт блюда из очереди, '
               'генерирует фото, отправляет его второй нейросети-«критику», и только '
               'оценка 7 баллов и выше отправляет фото публикацию. Брак возвращается в '
               'очередь на переделку — сколько бы попыток ни потребовалось.', body))

figure(story, f'{BUILD}/chart_catalog.png',
       'Рисунок 4. Каталог в цифрах: 399 блюд в данных, 260 с фото, из них 161 ЛАЙТ и 99 PRO',
       max_width=AVAIL_W * 0.86, max_height=200)

story.append(P('<b>Свежий результат.</b> Шесть фотографий, которые вы отметили как старые, '
               'уже переделаны и одобрены «критиком»: стейк — 9 из 10, карбонара — 8, '
               'рёбрышки BBQ — 8, бургер — 7, соба с говядиной — 7, спагетти болоньезе — 7. '
               'Очередь старых фото пуста.', body))
story.append(P('<b>Про тариф Lite.</b> Генерация фотографий идёт через платный сервис, и '
               'ещё 3 ноября конвейер упирался в «429-штормы»: сервер отвечал «слишком '
               'много запросов», генератор ставился на паузу, а прогоны проходили вхолостую '
               '(это видно в журнале heartbeat.log). Оплаченный тариф Lite поднимает квоты '
               'и лимиты запросов — значит, «штормов» станет меньше, а очередь пройдёт '
               'быстрее. Прогоны 4–5 ноября уже отработали без отказов: очередь старых '
               'фото закрыта полностью. Менять в конвейере ничего не нужно — он просто '
               'реже упирается в потолок.', body))

# ── Раздел 8 ──
section(story, '8. План действий: 10 быстрых побед', [
    P('Ниже — те же находки, но отсортированные по принципу «максимум эффекта за минимум '
      'времени». Первые пять пунктов занимают около полутора часов суммарно и закрывают '
      'и утечку, и главный тормоз сайта, и сломанный сценарий сканера.', lead),
])
table_block(story,
    ['№', 'Действие', 'Время', 'Эффект'],
    [
        ['1', 'Удалить публичный архив исходников и запретить zip в public/',
         '5 мин', '<b>сделано 05.11</b> — утечка закрыта, минус 15 МБ с каждого деплоя'],
        ['2', 'Ленивая загрузка библиотеки штрих-кодов (zxing)', '15 мин',
         'минус 0,5 МБ из стартового файла'],
        ['3', 'Ленивая загрузка тяжёлых экранов (React.lazy + Suspense)', '30 мин',
         'каталог открывается без сканера и лишнего кода'],
        ['4', 'Починить возобновление сканера после результата (К3)', '30 мин',
         'работает «несколько покупок подряд»'],
        ['5', 'Таймаут 9 с + проверка ответа + кэш в прямом запросе товаров (В2)', '20 мин',
         'штрих-код больше не зависает навечно'],
        ['6', 'OG-теги + иконка iOS + картинка-превью', '20 мин',
         '<b>сделано 05.11</b> — красивое превью в мессенджерах'],
        ['7', 'Свести промпт распознавания к одной копии + проверка хешей', '1–2 ч',
         'конец классу багов «на одном сервере одно, на другом другое»'],
        ['8', 'Дифференцировать таймауты цепочки скана (К4)', '10 мин',
         'худшее ожидание: 180 с → около 90 с'],
        ['9', 'Убрать двойной PRO-бейдж; тексты «5 сканов» из константы; обновить числа', '20 мин',
         'честные тексты и чистый код'],
        ['10', 'rsync --delete в деплое + 404.html в сборке', '20 мин',
         'зеркала не распухают, ссылки не молча ломаются'],
    ],
    [0.055, 0.44, 0.10, 0.405],
    'Таблица 4. Топ-10 быстрых побед: время указано чистое, на человека')

figure(story, f'{BUILD}/chart_bundle.png',
       'Рисунок 5. Что даёт ленивая загрузка сканера: стартовый файл худеет на четверть',
       max_width=AVAIL_W * 0.84, max_height=185)

story.append(P('Рекомендуемый порядок: пункты 2–5 одним заходом (это один вечер, они все '
               'крутятся вокруг сканера), затем пункт 7 — он убирает целый класс будущих '
               'багов. Пункты 9–10 удобно закрыть тем же вечером «полировки» из раздела 6.', body))

# ── Раздел 9 ──
section(story, '9. Словарик терминов', [
    P('Все термины из этого отчёта — в одну строчку, без формальностей.', lead),
])
table_block(story,
    ['Термин', 'Что это значит простыми словами'],
    [
        ['PWA', 'сайт, который можно «установить» на телефон как приложение и который '
         'частично работает без интернета'],
        ['Бандл', 'один файл, в который собран весь код сайта; его скачивает браузер '
         'при первом открытии'],
        ['Gzip', 'сжатие файлов при передаче: тот же бандл, но «запакованный» — легче в 4–5 раз'],
        ['Ленивая загрузка', 'код подгружается не сразу, а когда реально понадобился: '
         'сканер — только при входе в режим сканирования'],
        ['Зеркало', 'полная копия сайта по другому адресу — страховка на случай сбоя'],
        ['SPA', 'приложение-страница: сайт без перезагрузок, все экраны живут в одном файле'],
        ['404.html', 'заглушка, благодаря которой прямая ссылка (например, на блюдо) открывается '
         'корректно, а не страницей ошибки'],
        ['OG-теги', 'описание и картинка, которые показывают мессенджеры, когда кто-то '
         'делится ссылкой на сайт'],
        ['Sitemap', 'карта сайта для поисковиков: список всех страниц, чтобы Google ничего не пропустил'],
        ['Canonical', 'пометка «главный адрес» — чтобы два зеркала не конкурировали в поиске'],
        ['Таймаут', 'максимальное время ожидания ответа: «жду 9 секунд, дальше — не жду»'],
        ['Крон', 'задача-будильник на сервере: запускаться сама, например, каждые 30 минут'],
        ['Кэш', 'копия файлов в браузере или на телефоне, чтобы не скачивать заново'],
        ['Коммит', 'сохранённая версия изменений в репозитории (хранилище кода)'],
        ['Деплой', 'публикация: выложить свежую версию сайта на хостинг'],
    ],
    [0.22, 0.78],
    'Таблица 5. Словарик: каждый термин одной фразой')

story.append(Spacer(1, 10))
story.append(P('<b>Что дальше.</b> Сайт в рабочей форме, критические риски взяты под '
               'контроль: утечка закрыта, превью для мессенджеров добавлено, фото-конвейер '
               'вычищает брак сам. Следующий логичный шаг — «быстрые победы» №2–№5 из '
               'раздела 8: один вечер работы, а сайт станет заметно быстрее и надёжнее. '
               'Скажите — и начнём с них.', body))

# ── Build ──
out = f'{BUILD}/body.pdf'
doc = TocDocTemplate(
    out, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=DOC_TITLE, author='Z.ai', creator='Z.ai',
    subject='Архитектурный аудит сайта СканРецепт, изложение для владельца (beginner-friendly)',
)
doc.multiBuild(story)
print('body done:', out)
