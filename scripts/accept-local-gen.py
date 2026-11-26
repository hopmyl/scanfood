#!/usr/bin/env python3
# Приём фото, сгенерированных локальным генератором песочницы (z-ai) и
# прошедших критика конвейера glm-4.5v (score >= 7, флаги чистые).
# Отличие от accept-user-photos.py: источник фото — download/<slug>-test.png,
# src замка — local-gen-zai (не human). Остальная бухгалтерия та же.
import json, hashlib, os, sys
from PIL import Image
from datetime import datetime, timezone

ROOT = '/home/z/my-project'
# slug -> (score, вердикт критика). Источник: результаты батча ИЛИ хардкод.
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    _res = json.load(open(sys.argv[1]))
    MAP = {slug: (info['score'], info['note']) for slug, info in _res['pass'].items()}
    _suffix = '-gen'
    print(f"источник: {sys.argv[1]} (pass={len(MAP)}, fail={len(_res.get('fail', {}))})")
else:
    MAP = {
        'yam-nuea': (7, 'Реалистичный тайский говяжий салат, лайм и перец на месте'),
    }
    _suffix = '-test'

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

now = datetime.now(timezone.utc).isoformat(timespec='seconds')
accepted = {}
for slug, (score, note) in MAP.items():
    src = os.path.join(ROOT, 'download', slug + _suffix + '.png')
    dst = os.path.join(ROOT, 'public', 'dishes', slug + '.jpg')
    if not os.path.exists(src):
        print(f'НЕТ ФАЙЛА {src}, пропуск'); continue
    old_sha = sha256(dst) if os.path.exists(dst) else '-'
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(dst, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(dst)
    accepted[slug] = {'sha256': new_sha, 'score': score, 'note': note,
                      'old': old_sha, 'size': os.path.getsize(dst)}
    print(f"{slug:22s} {im.size} {os.path.getsize(dst)//1024}KB  old={old_sha[:8]} new={new_sha[:8]}")

# --- photo-locks.json ---
lp = os.path.join(ROOT, 'scripts', 'photo-locks.json')
locks = json.load(open(lp))
for slug, info in accepted.items():
    locks[slug] = {'sha256': info['sha256'], 'at': now,
                   'score': info['score'], 'src': 'local-gen-zai-critic-pass'}
json.dump(locks, open(lp, 'w'), indent=1, ensure_ascii=False)
print('locks:', len(locks), f'(+{len(accepted)})')

# --- qa-approve.txt ---
ap = os.path.join(ROOT, 'scripts', 'qa-approve.txt')
approved = [l.strip() for l in open(ap) if l.strip()]
add = [d for d in accepted if d not in approved]
approved += add
open(ap, 'w').write('\n'.join(approved) + '\n')
print('qa-approve: +', add)

# --- regen-progress.txt ---
pp = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
prog = [l.strip() for l in open(pp) if l.strip()]
addp = [d for d in accepted if d not in prog]
prog += addp
open(pp, 'w').write('\n'.join(prog) + '\n')
print('regen-progress: +', addp, '| всего', len(prog))

# --- natural-state.json ---
sp = os.path.join(ROOT, 'scripts', 'natural-state.json')
state = json.load(open(sp))
for slug, info in accepted.items():
    state[slug] = info['score']
json.dump(state, open(sp, 'w'), indent=1, ensure_ascii=False)
print('natural-state: +', len(accepted))

# --- логи ---
_slugs = ', '.join(accepted)
_scores = ', '.join(f"{s}:{i['score']}" for s, i in accepted.items())
for logf, line in [
    (os.path.join(ROOT, 'scripts', 'natural-log.txt'),
     f"{now} === ЛОКАЛЬНАЯ ГЕНЕРАЦИЯ (z-ai): {_slugs} — замки + approve ==="),
    (os.path.join(ROOT, 'scripts', 'heartbeat.log'),
     f"{now} local-gen: {_slugs} сгенерированы песочницей (z-ai), критик {_scores}, залочены"),
]:
    with open(logf, 'a') as f:
        f.write(line + '\n')
print('logs appended')
