#!/usr/bin/env python3
# Приём батча-7 от пользователя (Gemini, 2026-11-09, «забирай», 8 файлов) — 8/9,
# hash-browns не прислан (остаётся в очереди, попадёт в партию №8).
# Дубль: ntwhrl послан дважды («(1)» — gateway-переименование, MAD 0.95), принят один.
# Партия №7 (промпты отданы после приёма батча-6, стиль v7):
#            hong-shao-rou, harira, hand-torn-cabbage, general-tso-chicken, fried-calamari,
#            jambalaya, hummus-classic, hot-sour-soup.
# QA: визуальная проверка по монтажам /tmp/photo-inbox/b7-m1.jpg, b7-m2.jpg
# (все фотореалистичны, анти-слоп ок, соответствие блюдам и промптам),
# пиксельная сверка: дублей с продом (260 карт) нет (min MAD 43).
# Формат сайта: 1024x1024, Q88. Ландшафтные (ntwhrl 2752x1536, 9mzf2c 2752x1536)
# -> центровой кроп до квадрата, затем ресайз.
import json, hashlib, os
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
BATCH = [
    ('upload/Gemini_Generated_Image_ntwhrlntwhrlntwh.jfif', 'hong-shao-rou', 9),
    ('upload/Gemini_Generated_Image_ns8xt5ns8xt5ns8x.jfif', 'harira', 9),
    ('upload/Gemini_Generated_Image_7iy7hw7iy7hw7iy7.jfif', 'hand-torn-cabbage', 9),
    ('upload/Gemini_Generated_Image_ek5t5pek5t5pek5t.jfif', 'general-tso-chicken', 9),
    ('upload/Gemini_Generated_Image_z6ysjqz6ysjqz6ys.jfif', 'fried-calamari', 9),
    ('upload/Gemini_Generated_Image_9mzf2c9mzf2c9mzf.jfif', 'jambalaya', 9),
    ('upload/Gemini_Generated_Image_4pg3kn4pg3kn4pg3.jfif', 'hummus-classic', 9),
    ('upload/Gemini_Generated_Image_mkdc4jmkdc4jmkdc.jfif', 'hot-sour-soup', 9),
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
    w, h = im.size
    if w != h:
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    accepted[dish] = {'sha256': new_sha, 'score': score, 'old': old_sha}
    print(f"{dish:20s} src={w}x{h} -> 1024x1024  {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

# --- photo-locks.json ---
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

# --- qa-approve.txt ---
ap = os.path.join(ROOT, 'scripts', 'qa-approve.txt')
approved = [l.strip() for l in open(ap) if l.strip()]
add = [d for d in accepted if d not in approved]
approved += add
open(ap, 'w').write('\n'.join(approved) + '\n')
print('qa-approve: +', len(add), '| всего', len(approved))

# --- regen-progress.txt ---
pp = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in accepted if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', len(addp), '| всего', len(prog))

# --- логи ---
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-7 пользователя, 8/9, hash-browns не прислан): {', '.join(accepted)} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} приём батча-7: 8 фото пользователя установлены ({', '.join(accepted)}), замки +8; hash-browns остался в очереди"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
