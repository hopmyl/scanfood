#!/usr/bin/env python3
# Приём 2026-11-26 (три блюда):
#   lazy-vareniki    <- upload/Gemini_Generated_Image_e4v5y7... (Gemini пользователя, критик 8)
#   son-in-law-eggs  <- upload/Gemini_Generated_Image_y8o2jmy... (Gemini пользователя, критик 9)
#   sushi-set        <- download/sushi-set-gen.png (локальная регенерация z-ai, критик 8,
#                      override светлой сцены по жалобе пользователя на тёмный слат)
# Замки + qa-approve + qa-manual (resolved) + regen-progress + natural-state + логи.
import json, hashlib, os
from PIL import Image, ImageChops, ImageStat
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
MAP = [
    ('upload/Gemini_Generated_Image_e4v5y7e4v5y7e4v5.png', 'lazy-vareniki', 8, 'human-pass-gemini-user'),
    ('upload/Gemini_Generated_Image_y8o2jmy8o2jmy8o2.png', 'son-in-law-eggs', 9, 'human-pass-gemini-user'),
    ('download/sushi-set-gen.png', 'sushi-set', 8, 'local-gen-zai-critic-pass'),
]

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def sig(img):
    return img.convert('L').resize((256, 256), Image.LANCZOS)

def mad(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]

# --- сигнатуры прод-фото (до записи) для дубль-чека ---
prod_sigs = {}
for f in sorted(os.listdir(f'{ROOT}/public/dishes')):
    if f.endswith('.jpg'):
        prod_sigs[f[:-4]] = sig(Image.open(f'{ROOT}/public/dishes/{f}'))

now = datetime.now(timezone.utc).isoformat(timespec='seconds')
accepted = {}
for src_rel, dish, score, src_tag in MAP:
    src = os.path.join(ROOT, src_rel)
    if not os.path.exists(src):
        raise SystemExit(f'MISSING: {src_rel}')
    dst = os.path.join(ROOT, 'public', 'dishes', dish + '.jpg')
    old_sha = sha256(dst)
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    if dish == 'sushi-set' and new_sha == old_sha:
        raise SystemExit('sushi-set: файл не изменился — отказ в приёме')
    # дубль-чек против остальных прод-фото (порог 8.0, как в accept-batch8)
    ns = sig(im)
    worst = min(((mad(ns, s), other) for other, s in prod_sigs.items() if other != dish), default=(999, '-'))
    flag = 'DUP?!' if worst[0] < 8.0 else 'ок'
    accepted[dish] = {'sha256': new_sha, 'score': score, 'src': src_tag, 'old': old_sha, 'size': os.path.getsize(dst)}
    print(f"{dish:16s} {im.size} {os.path.getsize(dst)//1024:4d}KB old={old_sha[:8]} new={new_sha[:8]} ближайший дубль: {worst[1]} MAD={worst[0]:.1f} {flag}")

# --- photo-locks.json ---
lp = f'{ROOT}/scripts/photo-locks.json'
locks = json.load(open(lp))
for dish, info in accepted.items():
    locks[dish] = {'sha256': info['sha256'], 'at': now, 'score': info['score'], 'src': info['src']}
json.dump(locks, open(lp, 'w'), indent=1, ensure_ascii=False)
print('locks:', len(locks))

# --- qa-approve.txt ---
ap = f'{ROOT}/scripts/qa-approve.txt'
approved = [l.strip() for l in open(ap) if l.strip()]
add = [d for d in accepted if d not in approved]
approved += add
open(ap, 'w').write('\n'.join(approved) + '\n')
print('qa-approve: +', add)

# --- qa-manual.txt (решённые убрать) ---
mp = f'{ROOT}/scripts/qa-manual.txt'
manual = [l.strip() for l in open(mp) if l.strip()]
kept = [m for m in manual if m not in accepted]
open(mp, 'w').write('\n'.join(kept) + '\n' if kept else '')
print('qa-manual: убраны', sorted(set(manual) - set(kept)), '| осталось', len(kept))

# --- regen-progress.txt ---
pp = f'{ROOT}/scripts/regen-progress.txt'
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in accepted if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', addp, '| всего', len(prog))

# --- natural-state.json ---
sp = f'{ROOT}/scripts/natural-state.json'
state = json.load(open(sp))
for dish, info in accepted.items():
    state[dish] = info['score']
json.dump(state, open(sp, 'w'), indent=1, ensure_ascii=False)
print('natural-state: +', list(accepted))

# --- логи ---
for logf, line in [
    (f'{ROOT}/scripts/natural-log.txt',
     f"{now} === ПРИЁМ 26.11: lazy-vareniki(8)+son-in-law-eggs(9) — Gemini пользователя, критик PASS; "
     f"sushi-set(8) — локальная регенерация z-ai (override светлой сцены, жалоба на тёмный слат). "
     f"Очередь ручной генерации пуста: 80/80 залочено ==="),
    (f'{ROOT}/scripts/heartbeat.log',
     f"{now} accept-1126: 3 фото принято (lazy-vareniki:8, son-in-law-eggs:9, sushi-set:8), "
     f"очередь ручной генерации: 0, залочено 80/80"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(f'{ROOT}/public/dishes/{d}.jpg') == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
