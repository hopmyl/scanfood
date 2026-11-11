#!/usr/bin/env python3
# ЛОКАЛЬНЫЙ фолбэк: генерация партии Gemini на компьютере пользователя.
# Регион пользователя поддерживается (AI Studio web работает), в отличие от
# песочницы. На вход — файл промптов (download/gemini-batchN-prompts.txt),
# на выходе — папка с <slug>.jpg (1024x1024, JPEG Q88), которую просто
# прислать в чат как обычную пачку — приём не меняется.
# Запуск:  pip install pillow requests
#          GEMINI_API_KEY=... python3 gemini-local-generate.py gemini-batch8-prompts.txt
import json, os, re, sys, time, base64, io, urllib.request, urllib.error
from PIL import Image

KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL = 'gemini-2.5-flash-image'
SRC = sys.argv[1] if len(sys.argv) > 1 else 'gemini-batch8-prompts.txt'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'gemini-out'
os.makedirs(OUT, exist_ok=True)

if not KEY:
    sys.exit('Задай ключ: GEMINI_API_KEY=... python3 ' + sys.argv[0])

txt = open(SRC).read()
items = re.findall(r'^\d+\.\s+(\S+)\s+\(текущий балл аудита: [^)]+\)\n(.+?)(?=\n\d+\.\s|\Z)',
                   txt, re.M | re.S)
print(f'Партия: {len(items)} промптов из {SRC} -> {OUT}/')

def api_generate(prompt, tries=3):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE']},
    }).encode()
    for t in range(1, tries + 1):
        req = urllib.request.Request(url, data=body, method='POST', headers={
            'Content-Type': 'application/json', 'x-goog-api-key': KEY})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            for part in d.get('candidates', [{}])[0].get('content', {}).get('parts', []):
                il = part.get('inlineData')
                if il and il.get('data'):
                    return base64.b64decode(il['data'])
            print('  нет картинки в ответе')
        except urllib.error.HTTPError as e:
            print(f'  HTTP {e.code} (попытка {t}/{tries})')
            if e.code == 429:
                print('  квота: подожди минуту-другую и перезапусти скрипт (готовые файлы не трогаются)')
                time.sleep(45)
        except Exception as e:
            print(f'  ошибка: {e}')
            time.sleep(10)
    return None

ok = 0
for n, (slug, prompt) in enumerate(items, 1):
    out = f'{OUT}/{slug}.jpg'
    if os.path.exists(out):
        print(f'[{n}/{len(items)}] {slug}: уже есть, пропуск')
        continue
    print(f'[{n}/{len(items)}] {slug}: генерация...')
    raw = api_generate(prompt.strip())
    if not raw:
        print(f'  НЕ УДАЛОСЬ, пропусти и перезапусти')
        continue
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    w, h = img.size
    if w != h:
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    img = img.resize((1024, 1024), Image.LANCZOS)
    img.save(out, 'JPEG', quality=88, optimize=True)
    ok += 1
    print(f'  OK -> {out}')
print(f'Готово: {ok}/{len(items)} в папке {OUT}/ — пришли файлы пачкой в чат.')
