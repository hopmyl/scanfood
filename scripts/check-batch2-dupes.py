#!/usr/bin/env python3
# Батч-2 (10 файлов): пиксельная сверка с продом (public/dishes) и между собой
# + монтажи 2x3 с подписями для визуальной идентификации.
import os, hashlib
from PIL import Image, ImageDraw, ImageFont

UP = '/home/z/my-project/upload'
DISHES = '/home/z/my-project/public/dishes'
OUT = '/tmp/photo-inbox'
os.makedirs(OUT, exist_ok=True)

FILES = [  # (короткий id, имя файла)
    ('ib8icj', 'Gemini_Generated_Image_ib8icjib8icjib8i.jfif'),
    ('je6cb',  'Gemini_Generated_Image_je6cbje6cbje6cbj.jfif'),
    ('hhv3wd', 'Gemini_Generated_Image_hhv3wdhhv3wdhhv3.jfif'),
    ('445utl', 'Gemini_Generated_Image_445utl445utl445u.jfif'),
    ('296qjw', 'Gemini_Generated_Image_296qjw296qjw296q.jfif'),
    ('1yjv57', 'Gemini_Generated_Image_1yjv571yjv571yjv.jfif'),
    ('dyy369', 'Gemini_Generated_Image_dyy369dyy369dyy3.jfif'),
    ('ewv6ze', 'Gemini_Generated_Image_ewv6zeewv6zeewv6.jfif'),
    ('qt4tl9', 'Gemini_Generated_Image_qt4tl9qt4tl9qt4t.jfif'),
    ('uhkjqy', 'Gemini_Generated_Image_uhkjqyuhkjqyuhkj.jfif'),
]

def pxhash(im):
    return hashlib.sha256(im.convert('L').resize((256, 256), Image.LANCZOS).tobytes()).hexdigest()

# --- хэши входящих ---
incoming = {}
for sid, fn in FILES:
    im = Image.open(os.path.join(UP, fn))
    incoming[sid] = (pxhash(im), im.size)
    print(f"{sid}: {im.size}")

# --- хэши прода ---
prod = {}
for fn in os.listdir(DISHES):
    if fn.endswith('.jpg'):
        try:
            prod[fn[:-4]] = pxhash(Image.open(os.path.join(DISHES, fn)))
        except Exception as e:
            print('ERR', fn, e)

hash2slug = {}
for slug, h in prod.items():
    hash2slug.setdefault(h, []).append(slug)

print('\n--- сверка с продом ---')
dup = False
for sid, fn in FILES:
    h = incoming[sid][0]
    if h in hash2slug:
        dup = True
        print(f"DUP! {sid} == прод: {', '.join(hash2slug[h])}")
print('прод-дубликаты:', 'ЕСТЬ' if dup else 'нет')

print('\n--- сверка между собой ---')
inter = False
seen = {}
for sid, fn in FILES:
    h = incoming[sid][0]
    if h in seen:
        inter = True
        print(f"DUP! {sid} == {seen[h]}")
    seen[h] = sid
print('внутренние дубликаты:', 'ЕСТЬ' if inter else 'нет')

# --- монтажи 2x3 ---
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 36)
except Exception:
    font = ImageFont.load_default()
CELL = 560
groups = [FILES[:5], FILES[5:]]
for gi, grp in enumerate(groups, 1):
    cols, rows = 2, 3
    canvas = Image.new('RGB', (cols*CELL, rows*(CELL+46)), 'white')
    dr = ImageDraw.Draw(canvas)
    for idx, (sid, fn) in enumerate(grp):
        im = Image.open(os.path.join(UP, fn)).convert('RGB')
        im.thumbnail((CELL, CELL))
        r, c = divmod(idx, cols)
        y0 = r*(CELL+46)
        canvas.paste(im, (c*CELL + (CELL-im.width)//2, y0 + 46 + (CELL-im.height)//2))
        dr.rectangle([c*CELL, y0, c*CELL+CELL, y0+46], fill='#d32f2f')
        dr.text((c*CELL+10, y0+4), f"#{gi}-{idx+1} {sid}", fill='white', font=font)
    out = os.path.join(OUT, f'b2-m{gi}.jpg')
    canvas.save(out, quality=88)
    print('montage', out, canvas.size)
print('done')
