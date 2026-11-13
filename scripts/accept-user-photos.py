#!/usr/bin/env python3
# Ручной приём фото от пользователя (Gemini, партия 2026-11-07).
# QA: визуальная проверка Z.ai (все 6 — фотореализм, анти-слоп ок, соответствие блюду).
# Формат 1024x687 (3:2) — карточки сайта 4:3 object-cover, боковой кроп ~5%, композиция цела.
import json, hashlib, shutil, os
from PIL import Image

ROOT = '/home/z/my-project'
MAP = {
    'pasted_image_1794049953186.png': ('falafel-wrap', 9),
    'pasted_image_1794049980168.png': ('philly-cheesesteak', 9),
    'pasted_image_1794049992276.png': ('chicken-cutlets', 8),
    'pasted_image_1794050006934.png': ('sloppy-joes', 9),
    'pasted_image_1794050019930.png': ('cinnamon-rolls', 9),
    'pasted_image_1794050032206.png': ('turkish-pide', 9),
}

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

accepted = {}
for fname, (dish, score) in MAP.items():
    src = os.path.join(ROOT, 'upload', fname)
    dst = os.path.join(ROOT, 'public', 'dishes', dish + '.jpg')
    old_sha = sha256(dst)
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    accepted[dish] = {'sha256': new_sha, 'score': score, 'old': old_sha, 'size': os.path.getsize(dst)}
    print(f"{dish:22s} {im.size} {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

# --- photo-locks.json ---
lp = os.path.join(ROOT, 'scripts', 'photo-locks.json')
locks = json.load(open(lp))
from datetime import datetime, timezone
now = datetime.now(timezone.utc).isoformat(timespec='seconds')
for dish, info in accepted.items():
    locks[dish] = {'sha256': info['sha256'], 'at': now, 'score': info['score'], 'src': 'human-pass-gemini-user'}
json.dump(locks, open(lp, 'w'), indent=1, ensure_ascii=False)
print('locks:', len(locks), '(+6)')

# --- qa-approve.txt (человеческий апрув: блокирует badFromReport) ---
ap = os.path.join(ROOT, 'scripts', 'qa-approve.txt')
approved = [l.strip() for l in open(ap) if l.strip()]
add = [d for d in list(accepted) + ['beef-burger', 'tuna-sandwich'] if d not in approved]
approved += add
open(ap, 'w').write('\n'.join(approved) + '\n')
print('qa-approve: +', add)

# --- qa-manual.txt (решённые slop-карты убрать) ---
mp = os.path.join(ROOT, 'scripts', 'qa-manual.txt')
manual = [l.strip() for l in open(mp) if l.strip()]
resolved = {'beef-burger','chicken-cutlets','cinnamon-rolls','falafel-wrap','philly-cheesesteak','sloppy-joes','tuna-sandwich','turkish-pide'}
kept = [m for m in manual if m not in resolved]
open(mp, 'w').write('\n'.join(kept) + '\n' if kept else '')
print('qa-manual: убраны', sorted(set(manual) - set(kept)), '| осталось', kept)

# --- regen-progress.txt (старый конвейер не трогает) ---
pp = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in list(accepted) + ['beef-burger'] if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', addp, '| всего', len(prog))

# --- natural-state.json (балл записанного кадра) ---
sp = os.path.join(ROOT, 'scripts', 'natural-state.json')
state = json.load(open(sp))
for dish, info in accepted.items():
    state[dish] = info['score']
json.dump(state, open(sp, 'w'), indent=1, ensure_ascii=False)
print('natural-state: +6')

# --- логи ---
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, партия пользователя): {', '.join(accepted)} — замки + approve, qa-manual очищен ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} manual-accept: 6 фото пользователя (Gemini) приняты, замки установлены, кампания 10/229"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

# --- верификация замков: sha файла == sha замка ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
