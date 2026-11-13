#!/usr/bin/env python3
# Приём батча-5 от пользователя (Gemini, 2026-11-09, «забирай», 9 файлов) — ПОЛНЫЙ, 9/9.
# Партия №5 (промпты отдала prev-сессия после приёма батча-4, худшие из очереди, стиль v7):
#            yam-woon-sen, white-bean-tuna-salad, wedge-salad, walnut-shrimp, tuna-egg-salad,
#            tomato-egg-stirfry, tofu-larb, thai-spring-rolls, spanish-tortilla.
# QA: визуальная проверка агентом по монтажам /tmp/photo-inbox/b5-m1.jpg, b5-m2.jpg
# (все фотореалистичны, анти-слоп ок, соответствие блюдам и промптам),
# пиксельная сверка: дублей с продом (260 карт) и между собой нет (min MAD 50).
# Формат сайта: 1024x1024 (как все карточки), Q88. ИЗМЕНЕНИЕ к батчу-4: 6 исходников
# ландшафтные (2752x1536, промпты v7 просят ландшафт) -> центровой кроп до квадрата,
# затем ресайз; 3 квадратных (2048x2048) -> ресайз как раньше.
import json, hashlib, os
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
# (файл-источник, slug, визуальный балл)
BATCH = [
    ('upload/Gemini_Generated_Image_o8uouvo8uouvo8uo.jfif', 'yam-woon-sen', 9),
    ('upload/Gemini_Generated_Image_onxlb9onxlb9onxl.jfif', 'white-bean-tuna-salad', 9),
    ('upload/Gemini_Generated_Image_tb5wigtb5wigtb5w.jfif', 'wedge-salad', 9),
    ('upload/Gemini_Generated_Image_ucfotzucfotzucfo.jfif', 'walnut-shrimp', 9),
    ('upload/Gemini_Generated_Image_s9k89ts9k89ts9k8.jfif', 'tuna-egg-salad', 9),
    ('upload/Gemini_Generated_Image_eu1cdbeu1cdbeu1c.jfif', 'tomato-egg-stirfry', 9),
    ('upload/Gemini_Generated_Image_lahudplahudplahu.jfif', 'tofu-larb', 9),
    ('upload/Gemini_Generated_Image_h5io9ah5io9ah5io.jfif', 'thai-spring-rolls', 9),
    ('upload/Gemini_Generated_Image_dpgcmkdpgcmkdpgc.jfif', 'spanish-tortilla', 9),
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
    if w != h:  # ландшафт/портрет -> центровой квадратный кроп (без искажений)
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    accepted[dish] = {'sha256': new_sha, 'score': score, 'old': old_sha}
    print(f"{dish:26s} src={w}x{h} -> 1024x1024  {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

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
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-5 пользователя, полный 9/9): {', '.join(accepted)} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} приём батча-5: 9 фото пользователя установлены ({', '.join(accepted)}), замки +9; партия-5 закрыта полностью"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
