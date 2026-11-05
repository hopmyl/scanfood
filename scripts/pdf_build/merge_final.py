# -*- coding: utf-8 -*-
"""Merge cover + body into final.pdf with strict A4 normalization."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89


def normalize(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page


writer = PdfWriter()
writer.add_page(normalize(PdfReader('cover.pdf').pages[0]))
for p in PdfReader('body.pdf').pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    '/Title': 'СканРецепт — архитектурный аудит простыми словами',
    '/Author': 'Z.ai', '/Creator': 'Z.ai',
    '/Subject': 'Архитектурный аудит сайта СканРецепт для владельца: 28 находок, схемы, планы',
})
with open('final.pdf', 'wb') as f:
    writer.write(f)
r = PdfReader('final.pdf')
sizes = {(round(float(p.mediabox.width), 1), round(float(p.mediabox.height), 1))
         for p in r.pages}
print('pages:', len(r.pages), '| sizes:', sizes)
