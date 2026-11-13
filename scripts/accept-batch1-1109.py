#!/usr/bin/env python3
# Приём батча-1 от пользователя (Gemini, 2026-11-09, «лови 10 фото» + recovery).
# 12 фото = 12 блюд из выданной пользователю партии №1.
# QA: визуальная проверка агентом (все фотореалистичны, анти-слоп ок, соответствие блюдам).
# Формат сайта: 1024x1024 (как все карточки), Q88.
import json, hashlib, os
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
INBOX = '/tmp/photo-inbox'
# (файл-источник, slug, визуальный балл)
BATCH = [
    ('jfif_2vqxtn2vqxtn2vqx.jfif', 'kuay-teow-beef-soup', 9),
    ('jfif_6a3c46a3c46a3c46.jfif', 'yogurt-honey-walnuts', 9),
    ('jfif_blnjzmblnjzmblnj.jfif', 'cabbage-pie', 9),
    ('jfif_bz2ogjbz2ogjbz2o.jfif', 'tu-dou-si', 9),
    ('jfif_h4i0ffh4i0ffh4i0.jfif', 'turkish-lentil-soup', 9),
    ('jfif_m4cinum4cinum4ci.jfif', 'chicken-stir-fry', 9),
    ('jfif_p3tkbzp3tkbzp3tk.jfif', 'poke-bowl', 9),
    ('jfif_qjo5b6qjo5b6qjo5.jfif', 'baozi-steamed-buns', 9),
    ('jfif_sxaqmmsxaqmmsxaq.jfif', 'kluay-buat-chi', 8),
    ('jfif_wilnspwilnspwiln.jfif', 'cumin-lamb', 9),
    ('rec_4t1yv3.jfif', 'corn-chicken-soup', 8),
    ('rec_ucp0np.jfif', 'tuna-steak-sesame', 9),
]

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

now = datetime.now(timezone.utc).isoformat(timespec='seconds')
accepted = {}
for fname, dish, score in BATCH:
    src = os.path.join(INBOX, fname)
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
    print(f"{dish:22s} {im.size} {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

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
print('qa-approve: +', add, '| всего', len(approved))

# --- regen-progress.txt (очередь Gemini и старый конвейер считают выполненным) ---
pp = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in accepted if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', addp, '| всего', len(prog))

# --- логи ---
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-1 пользователя): {', '.join(accepted)} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} прогон 17:11: пользователь прислал 12 фото Gemini (батч-1) — все установлены ({', '.join(accepted)}), замки +12; 2 фото пропущены (нет блюда на сайте: лосось-спаржа и лава-кейк)"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
