#!/usr/bin/env python3
# Репликация buildQueue() из natural-regen.mjs (v7) + сборка следующей партии
# промптов для ручной генерации пользователем в Gemini.
import json, os, hashlib

ROOT = '/home/z/my-project'

def read_ids(p):
    try:
        return [l.strip() for l in open(p) if l.strip()]
    except FileNotFoundError:
        return []

report = json.load(open(f'{ROOT}/scripts/realism-report.json'))
locks = json.load(open(f'{ROOT}/scripts/photo-locks.json'))
approved = set(read_ids(f'{ROOT}/scripts/qa-approve.txt'))
manual = set(read_ids(f'{ROOT}/scripts/qa-manual.txt'))
progress = set(read_ids(f'{ROOT}/scripts/regen-progress.txt'))
shortlist = read_ids(f'{ROOT}/scripts/regen-shortlist.txt')
subjects = json.load(open(f'{ROOT}/scripts/photo-subjects.json'))

def file_sha(dish):
    p = f'{ROOT}/public/dishes/{dish}.jpg'
    if not os.path.exists(p):
        return None
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

FLAGS = ('steam', 'plastic', 'text', 'people', 'wrong', 'glamor')
def is_bad(r):
    return r['score'] < 6 or any(r.get(f) for f in FLAGS)
def is_locked(dish):
    l = locks.get(dish)
    return bool(l) and file_sha(dish) == l['sha256']

bad = [i for i, r in report.items() if r.get('score', -1) >= 0 and is_bad(r) and i not in approved]
pending = [i for i in shortlist if i not in progress and i not in approved]
queue = sorted(set(bad) | manual | set(pending))
queue = [i for i in queue if not is_locked(i)]
queue.sort(key=lambda i: report[i]['score'] if report.get(i, {}).get('score', -1) >= 0 else 0)

print(f'Очередь: {len(queue)} | из отчёта(bad): {len(bad)} | shortlist-pending: {len(pending)} | manual: {len(manual)}')

# --- промпт-сборка v7 (как в natural-regen.mjs, salt=v1, не-paid: i+1=1) ---
ANGLES = ['camera at a slight 45-degree angle above the table',
          'straight-on eye-level camera angle',
          'top-down overhead camera angle looking straight down at the dish',
          'low camera angle close to the table surface',
          'camera at a gentle 30-degree angle close to the dish']
TABLES = ['on a dark walnut wooden table', 'on a rustic oak wooden table',
          'on a weathered dark wooden table', 'on a beige linen cloth over a wooden table',
          'on a warm terracotta tiled table', 'on a light pine wooden table']
BACKGROUNDS = ['softly blurred cozy rustic kitchen in the background',
               'softly blurred dark wooden wall with linen textiles in the background',
               'warmly blurred kitchen shelves with jars and herbs in the background',
               'softly blurred bright window with sheer curtains in the background',
               'gently blurred dark dining room corner in the background']
STYLE = ('real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, '
         'served on handmade glazed ceramic tableware, '
         'simple cutlery and a folded beige linen napkin beside the dish, '
         'a few raw ingredients and spices scattered around that naturally match this dish, '
         'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, '
         'muted natural colors, matte realistic food textures: visible grains and crumb, '
         'uneven browning, slightly irregular homemade shapes, sauces with a light oil sheen, '
         'a few crumbs on the table, casual home snapshot look, unedited photo from a real home cook, '
         'shallow depth of field, 50mm lens look, static view of the table, '
         'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark')
NEG = json.load(open(f'{ROOT}/scripts/prompt-overrides.json')).get('_negative', '')

def pick(arr, salt):
    h = 0
    for c in salt:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return arr[h % len(arr)]

def prompt_for(dish):
    subj = subjects.get(dish, dish)
    salt = f'{dish}::v1'
    scene = f'{pick(ANGLES, salt)}, {pick(TABLES, salt)}, {pick(BACKGROUNDS, salt)}'
    return f'{subj}, {scene}, {STYLE}, {NEG}'

BATCH = 12
out = []
for n, dish in enumerate(queue[:BATCH], 1):
    sc = report.get(dish, {}).get('score', '?')
    out.append(f'{n}. {dish}  (текущий балл аудита: {sc})\n{prompt_for(dish)}')

txt = ('СканРецепт — партия для Gemini №1 (худшие из очереди, стиль v7).\n'
       'Формат: ландшафт (3:2 или 4:3). Прислать пачкой — сверю по содержимому.\n\n'
       + '\n\n'.join(out) + '\n')
open(f'{ROOT}/download/gemini-batch-prompts.txt', 'w').write(txt)
print(f'Партия: {min(BATCH, len(queue))} промптов -> download/gemini-batch-prompts.txt')
for line in out:
    print(line.split('\n')[0])
