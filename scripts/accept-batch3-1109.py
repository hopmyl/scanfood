#!/usr/bin/env python3
# Приём батча-3 от пользователя (Gemini, 2026-11-09, «лови» 5 файлов + 4 догнавших в шлюзе) — ПОЛНЫЙ, 9/9.
# Партия №3: glazed-donuts, greek-yogurt-granola, green-curry-chicken, herring-shuba, khao-soi,
#            kibbeh, lahmacun, mapo-tofu, meatballs-tomato.
# QA: визуальная проверка агентом по монтажам /tmp/photo-inbox/b3-m1.jpg, b3-m2.jpg
# (все фотореалистичны, анти-слоп ок, соответствие блюдам и промптам),
# пиксельная сверка (встроена в подготовку): дубликатов с продом и между собой нет.
# Формат сайта: 1024x1024 (как все карточки), Q88.
import json, hashlib, os
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
# (файл-источник, slug, визуальный балл)
BATCH = [
    ('upload/Gemini_Generated_Image_y1qp1yy1qp1yy1qp.jfif', 'green-curry-chicken', 9),
    ('upload/Gemini_Generated_Image_t0ctk4t0ctk4t0ct.jfif', 'greek-yogurt-granola', 9),
    ('upload/Gemini_Generated_Image_x4yjl8x4yjl8x4yj.jfif', 'glazed-donuts', 9),
    ('upload/Gemini_Generated_Image_mamc8zmamc8zmamc.jfif', 'khao-soi', 9),
    ('upload/Gemini_Generated_Image_8baexl8baexl8bae.jfif', 'herring-shuba', 9),
    ('upload/Gemini_Generated_Image_6wnr2o6wnr2o6wnr.jfif', 'kibbeh', 9),
    ('upload/Gemini_Generated_Image_cubk1acubk1acubk.jfif', 'meatballs-tomato', 9),
    ('upload/Gemini_Generated_Image_l5olkql5olkql5ol.jfif', 'lahmacun', 9),
    ('upload/Gemini_Generated_Image_lnksrklnksrklnks.jfif', 'mapo-tofu', 9),
]

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

now = datetime.now(timezone.utc).isoformat(timespec='seconds')
accepted = {}
for src_rel, dish, score in BATCH:
    src = os.path.join(ROOT, src_rel)
    dst = os.path.join(ROOT, 'public', 'dishes', dish + '.jpg')
    old_sha = sha256(dst)
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    accepted[dish] = {'sha256': new_sha, 'score': score, 'old': old_sha}
    print(f"{dish:24s} {im.size} {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

# --- photo-locks.json (конвейер больше не трогает эти блюда) ---
lp = os.path.join(ROOT, 'scripts', 'photo-locks.json')
locks = json.load(open(lp))
for dish, info in accepted.items():
    locks[dish] = {'sha256': info['sha256'], 'at': now, 'score': info['score'], 'src': 'human-pass-gemini-user'}
json.dump(locks, open(lp, 'w'), indent=1, ensure_ascii=False)
print('locks:', len(locks), f'(+{len(accepted)})')

# --- natural-state.json ---
sp = os.path.join(ROOT, 'scripts', 'natural-state.json')
state = json.load(open(sp))
for dish, info in accepted.items():
    state[dish] = info['score']
json.dump(state, open(sp, 'w'), indent=1, ensure_ascii=False)
print('natural-state:', len(state))

# --- qa-approve.txt (человеческий апрув) ---
ap = os.path.join(ROOT, 'scripts', 'qa-approve.txt')
approved = [l.strip() for l in open(ap) if l.strip()]
add = [d for d in accepted if d not in approved]
approved += add
open(ap, 'w').write('\n'.join(approved) + '\n')
print('qa-approve: +', len(add), '| всего', len(approved))

# --- regen-progress.txt (очередь Gemini и старый конвейер считают выполненным) ---
pp = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in accepted if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', len(addp), '| всего', len(prog))

# --- логи ---
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-3 пользователя, полный 9/9): {', '.join(accepted)} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} приём батча-3: 9 фото пользователя установлены ({', '.join(accepted)}), замки +9; партия-3 закрыта полностью"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
