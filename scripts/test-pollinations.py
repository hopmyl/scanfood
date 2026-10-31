#!/usr/bin/env python3
# Тест Pollinations.ai (бесплатный GET без ключа, под капотом Flux):
# генерирует указанные блюда с нашим промптом v6 и собирает лист сравнения
# «слева текущее z-ai / справа Pollinations».
# Запуск: python3 scripts/test-pollinations.py id1 id2 ...
import importlib.util
import json
import os
import sys
import time
import urllib.parse

import requests
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location(
    'gdp', '/home/z/my-project/scripts/generate-dish-photos-gemini.py')
gdp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gdp)

ROOT = '/home/z/my-project'
subjects = json.load(open(ROOT + '/scripts/photo-subjects.json', encoding='utf-8'))
ids = sys.argv[1:] or ['spaghetti-bolognese', 'borscht', 'greek-salad']
outdir = ROOT + '/scripts/photo-tmp/pollinations'
os.makedirs(outdir, exist_ok=True)

for dish_id in ids:
    prompt = (f"{subjects.get(dish_id, dish_id)}, {gdp.scene_for(dish_id)}, "
              f"{gdp.DISH_STYLE_BASE}")
    url = ('https://image.pollinations.ai/prompt/' + urllib.parse.quote(prompt)
           + '?width=1024&height=1024&model=flux&nologo=true&seed=7&safe=false')
    for attempt in range(4):
        t0 = time.time()
        try:
            r = requests.get(url, timeout=150)
            ctype = r.headers.get('content-type', '')
            print(dish_id, f'попытка {attempt + 1}', 'HTTP', r.status_code, ctype,
                  len(r.content) // 1024, 'KB', f'{time.time() - t0:.0f}s')
            if r.status_code == 200 and ctype.startswith('image'):
                open(f'{outdir}/{dish_id}.jpg', 'wb').write(r.content)
                break
            wait = 55
        except Exception as e:
            print(dish_id, 'ERR', str(e)[:150])
            wait = 55
        time.sleep(wait)
    time.sleep(50)  # free tier: 1 картинка / 45s на IP

# Лист сравнения: левая колонка — текущие фото (public/dishes), правая — Pollinations
TH = 500
rows = [i for i in ids if os.path.exists(f'{outdir}/{i}.jpg')]
if rows:
    sheet = Image.new('RGB', (TH * 2 + 12, (TH + 34) * len(rows)), '#222')
    d = ImageDraw.Draw(sheet)
    for r_i, dish_id in enumerate(rows):
        y = r_i * (TH + 34)
        left = Image.open(f'{ROOT}/public/dishes/{dish_id}.jpg').resize((TH, TH))
        right = Image.open(f'{outdir}/{dish_id}.jpg').resize((TH, TH))
        sheet.paste(left, (0, y + 34))
        sheet.paste(right, (TH + 12, y + 34))
        d.text((6, y + 8), f'{dish_id} | LEFT: z-ai  RIGHT: pollinations', fill='white')
    out = ROOT + '/download/compare-pollinations.jpg'
    sheet.save(out, 'JPEG', quality=88)
    print('COMPARE ->', out, f'({len(rows)} рядов)')
else:
    print('нет успешных генераций для сравнения')
