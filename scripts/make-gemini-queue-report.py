#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Отчёт для пользователя: оставшиеся генерации + готовые промпты для Gemini.
Источник: regen-shortlist.txt (худшие-сначала), photo-locks.json (закрыто),
photo-subjects.json (сцены), prompt-overrides.json (промпты маркетолога),
realism-report.json (старые оценки для сортировки)."""
import json, os, datetime

ROOT = '/home/z/my-project'
S = lambda p: os.path.join(ROOT, 'scripts', p)

locks = json.load(open(S('photo-locks.json')))
overrides = json.load(open(S('prompt-overrides.json')))
subjects = json.load(open(S('photo-subjects.json')))
report = json.load(open(S('realism-report.json')))
shortlist = [l.strip() for l in open(S('regen-shortlist.txt')) if l.strip()]
progress = set(l.strip() for l in open(S('regen-progress.txt')) if l.strip())

NEG = overrides.get('_negative', 'plastic sheen, artificial gloss, oversharpened, hyperrealistic, 3d render, cgi, fake, synthetic.')

STYLE = ('real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, '
         'served on handmade glazed ceramic tableware, simple cutlery and a folded beige linen napkin beside the dish, '
         'a few raw ingredients and spices scattered around that naturally match this dish, '
         'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, '
         'muted natural colors, matte realistic food textures: visible grains and crumb, uneven browning, '
         'slightly irregular homemade shapes, sauces with a light oil sheen, a few crumbs on the table, '
         'casual home snapshot look, unedited photo from a real home cook, shallow depth of field, 50mm lens look, '
         'static view of the table, square 1:1 format. '
         'STRICTLY AVOID: ' + NEG)

def score_of(dish):
    r = report.get(dish)
    if isinstance(r, dict) and isinstance(r.get('score'), (int, float)) and r['score'] >= 0:
        return r['score']
    return 0

pending = [d for d in shortlist if d not in progress and d not in locks]
pending.sort(key=lambda d: (score_of(d), d))

def prompt_for(dish):
    """Готовый промпт: приоритет — промпт маркетолога, иначе сцена + анти-слоп стиль."""
    ov = overrides.get(dish)
    if isinstance(ov, dict) and ov.get('base'):
        return ov['base'].strip(), 'маркетолог', ov.get('variants') or []
    subj = (subjects.get(dish) or dish.replace('-', ' ')).strip()
    return f"{subj}. {STYLE}", 'сцена+стиль v7', []

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
lines = []
lines.append(f'# СканРецепт — очередь генераций для Gemini ({now})\n')
lines.append('## Как работать\n')
lines.append('1. Генерируешь фото в Gemini по промпту из списка (квадрат 1:1).')
lines.append('2. Присылаешь мне в чат: «держи фото <id>» (id — название из списка).')
lines.append('3. Я проверяю как фотограф (свет/текстуры/слоп), ставлю замок — карта выбывает из очереди.')
lines.append('4. Брак (пластик, глянец, HDR) — перегенерируй тем же промптом или его вариантом.\n')
lines.append('Общие правила для всех карт: естественный дневной свет из окна, матовые текстуры,')
lines.append('домашняя «неровность», никакого глянца/пластика/3D-рендера. Формат 1:1.\n')

done = len([d for d in shortlist if d in locks])
lines.append(f'## Статус кампании\n')
lines.append(f'- Закрыто замком: **5** карт — beef-burger (ваш, принят 8/8), tuna-sandwich, apple-pie, arroz-con-pollo, avgolemono')
lines.append(f'- Осталось: **{len(pending)}** карт (автоконвейер ZAI стоит 429 уже сутки — ручная генерация сильно ускорит дело)')
lines.append(f'- Первые в очереди — карты с промптами маркетолога, затем худшие по старому аудиту\n')

lines.append('## БЛОК 1 — Карты маркетолога (приоритет)\n')
block1 = [d for d in pending if d in overrides]
for i, dish in enumerate(block1, 1):
    p, src, variants = prompt_for(dish)
    lines.append(f'### {i}. {dish} (старый балл: {score_of(dish)})')
    lines.append(f'**Промпт:** {p}')
    if variants:
        lines.append(f'**Вариант (если основной зает):** {variants[0]}')
    lines.append('')

lines.append('## БЛОК 2 — Остальные карты (худшие — первыми)\n')
block2 = [d for d in pending if d not in overrides]
for i, dish in enumerate(block2, 1):
    p, src, _ = prompt_for(dish)
    lines.append(f'### {len(block1)+i}. {dish} (старый балл: {score_of(dish)})')
    lines.append(f'**Промпт:** {p}')
    lines.append('')

out = os.path.join(ROOT, 'download', 'gemini-generation-queue.md')
open(out, 'w', encoding='utf-8').write('\n'.join(lines))
print(f'OK: {out}')
print(f'pending={len(pending)}, marketer_block={len(block1)}, rest={len(block2)}')
print('top10:', ', '.join(pending[:10]))
