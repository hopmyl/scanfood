#!/usr/bin/env python3
# Монтаж 14 входящих фото для визуальной идентификации (2x2, label на каждой ячейке)
from PIL import Image, ImageDraw, ImageFont
import os

UP = '/home/z/my-project/upload'
INBOX = '/tmp/photo-inbox'
OUT = '/tmp/photo-inbox'

jfifs = ['2vqxtn2vqxtn2vqx','6a3c46a3c46a3c46','blnjzmblnjzmblnj','bz2ogjbz2ogjbz2o',
         'h4i0ffh4i0ffh4i0','m4cinum4cinum4ci','p3tkbzp3tkbzp3tk','qjo5b6qjo5b6qjo5',
         'sxaqmmsxaqmmsxaq','wilnspwilnspwiln']
recs = ['rec_4t1yv3','rec_ucp0np']
pngs = ['p1','p2']

groups = [
    ('m1.jpg', [('J%d'%i, os.path.join(INBOX, 'jfif_%s.jfif'%j)) for i,j in enumerate(jfifs[:4],1)]),
    ('m2.jpg', [('J%d'%i, os.path.join(INBOX, 'jfif_%s.jfif'%j)) for i,j in enumerate(jfifs[4:8],5)]),
    ('m3.jpg', [('J%d'%i, os.path.join(INBOX, 'jfif_%s.jfif'%j)) for i,j in enumerate(jfifs[8:],9)] +
               [('R1', os.path.join(INBOX,'rec_4t1yv3.jfif')), ('R2', os.path.join(INBOX,'rec_ucp0np.jfif'))]),
    ('m4.jpg', [('P1', os.path.join(INBOX,pngs[0]+'.png')), ('P2', os.path.join(INBOX,pngs[1]+'.png'))]),
]

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 42)
except Exception:
    font = ImageFont.load_default()

CELL = 640
for outname, items in groups:
    n = len(items)
    cols = 2
    rows = (n + cols - 1)//cols
    canvas = Image.new('RGB', (cols*CELL, rows*(CELL+50)), 'white')
    dr = ImageDraw.Draw(canvas)
    for idx, (label, path) in enumerate(items):
        im = Image.open(path).convert('RGB')
        im.thumbnail((CELL, CELL))
        r, c = divmod(idx, cols)
        canvas.paste(im, (c*CELL + (CELL-im.width)//2, r*(CELL+50) + 50 + (CELL-im.height)//2))
        dr.rectangle([c*CELL, r*(CELL+50), c*CELL+CELL, r*(CELL+50)+50], fill='#d32f2f')
        dr.text((c*CELL+10, r*(CELL+50)+4), label+' '+os.path.basename(path)[:28], fill='white', font=font)
    canvas.save(os.path.join(OUT, outname), quality=88)
    print(outname, canvas.size, 'ok')
print('done')
