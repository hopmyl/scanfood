#!/usr/bin/env python3
# Собирает txt с промптами для ОСТАВШИХСЯ блюд ручной генерации (Gemini web).
# Источники: download/gemini-full-queue-prompts.txt (обогащённые карточки v7) +
#            scripts/photo-subjects.json + стиль-блок v7 (для блюд, которых нет в старом файле).
# Порядок: худший балл аудита сверху. Формат как в полном файле.
import json, re, os

ROOT = '/home/z/my-project'
FULL = os.path.join(ROOT, 'download', 'gemini-full-queue-prompts.txt')
OUT = os.path.join(ROOT, 'download', 'gemini-remaining-prompts.txt')

# --- пендинг: shortlist - progress - locks ---
short = [l.strip() for l in open(f'{ROOT}/scripts/regen-shortlist.txt') if l.strip()]
prog = set(l.strip() for l in open(f'{ROOT}/scripts/regen-progress.txt') if l.strip())
locks = json.load(open(f'{ROOT}/scripts/photo-locks.json'))
pending = [s for s in dict.fromkeys(short) if s not in prog and s not in locks]

# --- старые обогащённые карточки ---
txt = open(FULL, encoding='utf-8').read()
cards = {}
for m in re.finditer(r'^\d+\.\s+(\S+)\s+\(текущий балл аудита:\s*([^)]+)\)\s*\n(.+?)(?=\n\n\d+\.|\Z)', txt, re.M | re.S):
    cards[m.group(1)] = (m.group(2).strip(), m.group(3).strip())
print(f'в полном файле карточек: {len(cards)}')

# --- баллы аудита ---
report = json.load(open(f'{ROOT}/scripts/realism-report.json'))
def score_of(slug):
    if slug in cards:
        try: return int(str(cards[slug][1]))
        except ValueError: pass
    e = report.get(slug)
    if isinstance(e, dict) and e.get('score', -1) >= 0: return e['score']
    return 0  # неизвестно

# --- стиль-блок v7 для доборки ---
STYLE_V7 = ('straight-on eye-level camera angle, on a warm terracotta tiled table, '
    'softly blurred dark wooden wall with linen textiles in the background, '
    'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, '
    'served on handmade glazed ceramic tableware, simple cutlery and a folded beige linen napkin beside the dish, '
    'a few raw ingredients and spices scattered around that naturally match this dish, '
    'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, muted natural colors, '
    'matte realistic food textures: visible grains and crumb, uneven browning, slightly irregular homemade shapes, '
    'sauces with a light oil sheen, a few crumbs on the table, casual home snapshot look, '
    'unedited photo from a real home cook, shallow depth of field, 50mm lens look, static view of the table, '
    'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark, '
    'plastic sheen, artificial gloss, oversharpened, hyperrealistic, 3d render, cgi, fake, synthetic, '
    'overly perfect, clinical, sterile, moody dark lighting, dramatic shadows.')
subjects = json.load(open(f'{ROOT}/scripts/photo-subjects.json'))

rows = []
fallback = []
for slug in pending:
    if slug in cards:
        rows.append((slug, score_of(slug), cards[slug][1]))
    else:
        subj = subjects.get(slug)
        if not subj: print(f'!! нет subject для {slug}'); continue
        fallback.append(slug)
        rows.append((slug, score_of(slug), subj + ', ' + STYLE_V7))

rows.sort(key=lambda r: (r[1], r[0]))  # худшие сверху
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(f'СканРецепт — ОСТАТОК очереди ручной генерации в Gemini: {len(rows)} карточек (худшие сверху, стиль v7).\n')
    f.write('Формат: ландшафт (3:2 или 4:3). Присылайте пачками по 10-15 — каждая проверяется критиком и ставится на замок.\n')
    f.write(f'(Статус: {len(pending)} блюд осталось; локальный генератор уже принял часть очереди — этот список синхронизирован с конвейером.)\n\n')
    for i, (slug, sc, prompt) in enumerate(rows, 1):
        f.write(f'{i}. {slug}  (текущий балл аудита: {sc})\n{prompt}\n\n')
print(f'готово: {OUT} — {len(rows)} карточек')
print('доборка из subjects (нет в старом файле):', fallback or 'нет')
