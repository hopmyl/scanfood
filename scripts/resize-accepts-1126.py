#!/usr/bin/env python3
# Нормализация двух принятых фото 26.11 под вес сайта (130-200КБ у прод-карточек):
# max 1600px по большей стороне, JPEG q88. Обновление sha в photo-locks.json + верификация.
import json, hashlib
from PIL import Image

ROOT = '/home/z/my-project'
DISHES = ['lazy-vareniki', 'son-in-law-eggs']  # sushi-set (1024px, 132KB) — норм

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

locks = json.load(open(f'{ROOT}/scripts/photo-locks.json'))
for dish in DISHES:
    p = f'{ROOT}/public/dishes/{dish}.jpg'
    im = Image.open(p)
    w, h = im.size
    scale = 1600 / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(p, 'JPEG', quality=88, optimize=True)
    new_sha = sha256(p)
    locks[dish]['sha256'] = new_sha
    print(f'{dish}: {w}x{h} -> {im.size[0]}x{im.size[1]}, {round(__import__("os").path.getsize(p)/1024)}KB, sha={new_sha[:8]}')

json.dump(locks, open(f'{ROOT}/scripts/photo-locks.json', 'w'), indent=1, ensure_ascii=False)
ok = all(sha256(f'{ROOT}/public/dishes/{d}.jpg') == locks[d]['sha256'] for d in DISHES)
print('lock verification:', 'PASS' if ok else 'FAIL')
