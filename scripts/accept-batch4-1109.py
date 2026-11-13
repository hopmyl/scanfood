#!/usr/bin/env python3
# Приём батча-4 от пользователя (Gemini, 2026-11-09, «держи», 9 файлов) — ПОЛНЫЙ, 9/9.
# Партия №4: ukha, mediterranean-lentil-salad, mushroom-risotto, okroshka, pad-kee-mao,
#            paella-seafood, shakshuka, shrimp-prik-king, spaghetti-bolognese.
# QA: визуальная проверка агентом по монтажам /tmp/photo-inbox/b4-m1.jpg, b4-m2.jpg
# (все фотореалистичны, анти-слоп ок, соответствие блюдам и промптам),
# пиксельная сверка: дубликатов с продом и между собой нет.
# Формат сайта: 1024x1024 (как все карточки), Q88.
import json, hashlib, os
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
# (файл-источник, slug, визуальный балл)
BATCH = [
    ('upload/Gemini_Generated_Image_r9w21cr9w21cr9w2.jfif', 'pad-kee-mao', 9),
    ('upload/Gemini_Generated_Image_7g86qd7g86qd7g86.jfif', 'okroshka', 9),
    ('upload/Gemini_Generated_Image_b619nxb619nxb619.jfif', 'mushroom-risotto', 9),
    ('upload/Gemini_Generated_Image_6t5ydk6t5ydk6t5y.jfif', 'mediterranean-lentil-salad', 9),
    ('upload/Gemini_Generated_Image_50a3y550a3y550a3.jfif', 'ukha', 9),
    ('upload/Gemini_Generated_Image_dqi0tedqi0tedqi0.jfif', 'spaghetti-bolognese', 9),
    ('upload/Gemini_Generated_Image_s0417es0417es041.jfif', 'shrimp-prik-king', 9),
    ('upload/Gemini_Generated_Image_d6346ad6346ad634.jfif', 'shakshuka', 9),
    ('upload/Gemini_Generated_Image_pzs0p2pzs0p2pzs0.jfif', 'paella-seafood', 9),
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
    print(f"{dish:26s} {im.size} {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

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
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-4 пользователя, полный 9/9): {', '.join(accepted)} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} приём батча-4: 9 фото пользователя установлены ({', '.join(accepted)}), замки +9; партия-4 закрыта полностью"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
