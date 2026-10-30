// Генератор отчёта docx: СканРецепт — анализ конкурентов и рекомендации.
// Рецепт обложки R1 (Pure Paragraph) + палитра GO-1, по design-system.md.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  PageBreak, TableLayoutType,
} = require('docx');
const fs = require('fs');
const { S1, S2, S3, S4, S5 } = require('./report-content-1.cjs');
const { S6, S7, S8, TABLE_PLAYERS, TABLE_ROADMAP } = require('./report-content-2.cjs');

// ============ Палитра GO-1 (Graphite Orange) ============
const PAL = {
  bg: '1A2330', primary: '1A2330', accent: 'D4875A',
  cover: { titleColor: 'FFFFFF', subtitleColor: 'B0B8C0', metaColor: '90989F', footerColor: '687078' },
  table: { headerBg: 'D4875A', headerText: 'FFFFFF', accentLine: 'D4875A', innerLine: 'DDD0C8', surface: 'F8F0EB' },
};

const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'Times New Roman' };
const FONT_H = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Arial' };

// ============ Хелперы обложки (по design-system.md) ============
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...'，。、；：！？', ...'的与和及之在于为', ...'-_—–·/', ...' \t', ...',:;']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += ' ' + last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // Кириллица ~ в 2 раза уже CJK: ширина символа ≈ pt * 10.5 twips
  const charWidth = (pt) => pt * 10.5;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ============ Рецепт R1 ============
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split('').join('  '), size: 18, color: P.accent, font: FONT_H, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: 'atLeast' },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.cover.titleColor, font: FONT_H })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: FONT_H })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor, font: FONT_H })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || '', size: 16, color: P.cover.footerColor, font: FONT_H }),
      new TextRun({ text: '                                        ' }),
      new TextRun({ text: config.footerRight || '', size: 16, color: P.cover.footerColor, font: FONT_H }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: 'exact' },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, verticalAlign: 'top',
        children,
      })],
    })],
  })];
}

// ============ Тело документа ============
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PAL.primary, font: FONT_H })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: PAL.primary, font: FONT_H })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 709 },
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: '000000', font: FONT })],
  });
}
function renderBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.h1) out.push(h1(b.h1));
    else if (b.h2) out.push(h2(b.h2));
    else if (b.p) out.push(body(b.p));
    else if (b.table === 'players') out.push(...buildTable(TABLE_PLAYERS));
    else if (b.table === 'roadmap') out.push(...buildTable(TABLE_ROADMAP));
  }
  return out;
}
function buildTable(t) {
  const els = [];
  els.push(new Paragraph({
    keepNext: true, spacing: { before: 200, after: 80, line: 312 },
    children: [new TextRun({ text: t.title, bold: true, size: 21, color: PAL.primary, font: FONT_H })],
  }));
  const mkCell = (text, isHeader, w) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: PAL.table.headerBg } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: isHeader, size: 20, color: isHeader ? PAL.table.headerText : '000000', font: isHeader ? FONT_H : FONT })],
    })],
  });
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: PAL.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: t.headers.map((h, i) => mkCell(h, true, t.widths[i])) }),
      ...t.rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) => {
          const cell = mkCell(c, false, t.widths[i]);
          return cell;
        }),
      })),
    ],
  }));
  els.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  return els;
}

// ============ Футер ============
const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888', font: FONT })],
  })],
});

// ============ Сборка ============
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const bodyChildren = [
  ...renderBlocks(S1), ...renderBlocks(S2), ...renderBlocks(S3),
  ...renderBlocks(S4), ...renderBlocks(S5), ...renderBlocks(S6),
  ...renderBlocks(S7), ...renderBlocks(S8),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: '000000' },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_H, size: 32, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: FONT_H, size: 28, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    // Секция 1: обложка — поля 0, без футера
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: 'СканРецепт: анализ конкурентов и рекомендации по развитию продукта',
        subtitle: 'Обзор рынка кулинарных приложений 2026 года и приоритизированный роадмап функций',
        englishLabel: 'COMPETITIVE ANALYSIS',
        metaLines: [
          'Продукт: СканРецепт (PWA, 399 блюд, 10 кухонь, freemium Лайт/PRO)',
          'Дата: 30 октября 2026 года',
          'Статус: рабочая версия для планирования роадмапа',
        ],
        footerLeft: 'СканРецепт', footerRight: 'Октябрь 2026',
        palette: PAL,
      }),
    },
    // Секция 2: оглавление — римская нумерация
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: 'Содержание', bold: true, size: 32, font: FONT_H, color: PAL.primary })],
        }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: 'Примечание: оглавление построено на кодах полей. После редактирования документа щёлкните по оглавлению правой кнопкой мыши и выберите «Обновить поле», чтобы актуализировать номера страниц.',
            italics: true, size: 18, color: '888888', font: FONT,
          })],
        }),
      ],
    },
    // Секция 3: тело — арабская нумерация с 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('/home/z/my-project/download/СканРецепт-анализ-конкурентов.docx', buf);
  console.log('OK docx written');
});
