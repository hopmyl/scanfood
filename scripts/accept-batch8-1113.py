#!/usr/bin/env python3
# Приём батча-8 (частично, 4 фото, Gemini от пользователя 2026-11-13 «Держи пока 4»).
# Сопоставление по содержимому (subjects + промпты v7 очереди):
#   yu-xiang-eggplant  (китайский баклажан в чесночном соусе, красный перец) — очередь №42
#   lyulya-kebab       (3 продолговатых кебаба, лук-сумах, лаваш, лимон)     — очередь №8
#   wonton-soup        (суп с вонтонами и бок-чой)                            — очередь №40
#   kefir-pancakes     (оладьи со сметаной и мёдом, ягоды)                    — очередь №2
# QA: монтажная/визуальная проверка — приём только после MAD-дубль-чека против 260 прод-фото (порог 8.0).
import json, hashlib, os, sys
from PIL import Image, ImageChops, ImageStat
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
BATCH = [
    ('upload/1794559928522.jpg', 'yu-xiang-eggplant', 9),
    ('upload/1794559687046.jpg', 'lyulya-kebab', 9),
    ('upload/1794559671572.jpg', 'wonton-soup', 9),
    ('upload/1794559933688.jpg', 'kefir-pancakes', 9),
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

# --- сигнатуры прод-фото до записи ---
prod_sigs = {}
for f in sorted(os.listdir(f'{ROOT}/public/dishes')):
    if f.endswith('.jpg'):
        try:
            prod_sigs[f[:-4]] = sig(Image.open(f'{ROOT}/public/dishes/{f}'))
        except Exception as e:
            print(f'sig skip {f}: {e}')

now = datetime.now(timezone.utc).isoformat(timespec='seconds')
accepted = {}
skipped = []
for src_rel, dish, score in BATCH:
    src = os.path.join(ROOT, src_rel)
    if not os.path.exists(src):
        print(f'MISSING: {src_rel}')
        skipped.append((dish, 'file-missing'))
        continue
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    w, h = im.size
    if w != h:
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    s_new = sig(im)
    worst = min((mad(s_new, s), d2) for d2, s in prod_sigs.items() if d2 != dish) if prod_sigs else (99, '-')
    if worst[0] < 8.0:
        print(f'DUPE: {dish} vs {worst[1]} MAD={worst[0]:.1f} < 8.0 — отклонено')
        skipped.append((dish, f'dupe {worst[1]} MAD {worst[0]:.1f}'))
        continue
    dst = os.path.join(ROOT, 'public', 'dishes', dish + '.jpg')
    old_sha = sha256(dst) if os.path.exists(dst) else None
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    prod_sigs[dish] = s_new
    accepted[dish] = {'sha256': new_sha, 'score': score, 'old': old_sha}
    print(f'{dish:20s} src={w}x{h} -> 1024x1024 {os.path.getsize(dst)//1024}KB '
          f'MAD-min={worst[0]:.1f}({worst[1]}) old={old_sha[:8] if old_sha else "-"} new={new_sha[:8]}')

if not accepted:
    print('Ничего не принято — стоп, файлы не меняю')
    sys.exit(1)

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
dishes_str = ', '.join(accepted)
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === РУЧНОЙ ПРИЁМ (Gemini, батч-8, часть 1: 4 фото пользователя): {dishes_str} — замки + approve + progress ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} приём батча-8 (часть 1): 4 фото пользователя установлены ({dishes_str}), замки +4"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')

if skipped:
    print('Пропущено:', skipped)

# --- верификация замков ---
ok = all(sha256(os.path.join(ROOT, 'public', 'dishes', d + '.jpg')) == locks[d]['sha256'] for d in accepted)
print('lock verification:', 'PASS' if ok else 'FAIL')
