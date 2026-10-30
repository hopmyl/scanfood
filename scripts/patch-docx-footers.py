#!/usr/bin/env python3
"""Пост-обработка docx: формат-свитчи футеров (ROMAN/arabic) + удаление пустых pgNumType."""
import re
import shutil
import sys
import zipfile

path = sys.argv[1]
tmp = path + '.tmp'

with zipfile.ZipFile(path, 'r') as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

doc = data['word/document.xml'].decode('utf-8')
# Удаляем пустые pgNumType (docx-js эмитит их в секции обложки)
doc = doc.replace('<w:pgNumType/>', '')
data['word/document.xml'] = doc.encode('utf-8')

# Находим, какие секции какие: sectPr с fmt="upperRoman" → её ссылка на футер должна быть ROMAN.
# Проще: патчим каждый footerN.xml по его использованию. Сопоставление rId→footer делаем по document.xml.rels.
rels = data['word/_rels/document.xml.rels'].decode('utf-8')
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

# Извлекаем секции: sectPr содержит pgNumType fmt и footerReference r:id
sect_blocks = re.findall(r'<w:sectPr[^>]*>.*?</w:sectPr>', doc, re.S)
fmt_by_footer = {}
for sb in sect_blocks:
    m_fmt = re.search(r'<w:pgNumType[^>]*w:fmt="(\w+)"', sb)
    for m_f in re.finditer(r'<w:footerReference[^>]*r:id="(rId\d+)"', sb):
        f = rid2file.get(m_f.group(1))
        if f and m_fmt:
            fmt_by_footer['word/' + f] = m_fmt.group(1)

for fname, fmt in fmt_by_footer.items():
    if fname not in data:
        continue
    xml = data[fname].decode('utf-8')
    switch = 'ROMAN' if 'oman' in fmt.lower() else 'arabic'
    xml = re.sub(
        r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
        r'\1 PAGE \\* ' + switch + r' \\* MERGEFORMAT \2',
        xml,
    )
    data[fname] = xml.encode('utf-8')
    print(f'patched {fname} -> {switch}')

with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(tmp, path)
print('footer patch done')
