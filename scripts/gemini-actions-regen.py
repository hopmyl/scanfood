#!/usr/bin/env python3
# Gemini API автогенерация брака (заморозка соблюдена: только существующие блюда).
# Запускается в GitHub Actions (runners в поддерживаемом регионе) или локально.
# Ключ — только из env GEMINI_API_KEY (в Actions — repo SECRET), никогда не из кода.
# Двухфазная схема: здесь только ГЕНЕРАЦИЯ+приём файла; баллы и замки ставит
# крон-аудит (check-photo-realism.mjs) на следующем прогоне.
import json, os, sys, time, base64, hashlib, io, urllib.request, urllib.error

ROOT = os.environ.get('REPO_ROOT', os.getcwd())  # в Actions = checkout
KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image')
N = 6
for a in sys.argv:
    if a.startswith('--n='):
        N = int(a.split('=', 1)[1])

LOG = f'{ROOT}/scripts/gemini-api-log.txt'

def read_ids(p):
    try:
        return [l.strip() for l in open(f'{ROOT}/{p}') if l.strip()]
    except FileNotFoundError:
        return []

report = json.load(open(f'{ROOT}/scripts/realism-report.json'))
locks = json.load(open(f'{ROOT}/scripts/photo-locks.json'))
approved = set(read_ids('scripts/qa-approve.txt'))
manual = set(read_ids('scripts/qa-manual.txt'))
progress = set(read_ids('scripts/regen-progress.txt'))
shortlist = read_ids('scripts/regen-shortlist.txt')
reserved = set(read_ids('scripts/gemini-api-reserved.txt'))
subjects = json.load(open(f'{ROOT}/scripts/photo-subjects.json'))

FLAGS = ('steam', 'plastic', 'text', 'people', 'wrong', 'glamor')
def is_bad(r):
    return r['score'] < 6 or any(r.get(f) for f in FLAGS)
def is_locked(dish):
    l = locks.get(dish)
    if not l:
        return False
    p = f'{ROOT}/public/dishes/{dish}.jpg'
    if not os.path.exists(p):
        return False
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() == l['sha256']

bad = [i for i, r in report.items() if r.get('score', -1) >= 0 and is_bad(r) and i not in approved]
pending = [i for i in shortlist if i not in progress and i not in approved]
queue = sorted(set(bad) | manual | set(pending))
queue = [i for i in queue if not is_locked(i) and i not in reserved]
queue.sort(key=lambda i: report[i]['score'] if report.get(i, {}).get('score', -1) >= 0 else 0)
batch = queue[:N]
print(f'Очередь API: {len(queue)} (reserved {len(reserved)}), берём {len(batch)}: {", ".join(batch)}')
if not batch:
    sys.exit(0)

# --- промпт v7 (репликация natural-regen.mjs / next-gemini-batch.py, salt=v1) ---
ANGLES = ['camera at a slight 45-degree angle above the table',
          'straight-on eye-level camera angle',
          'top-down overhead camera angle looking straight down at the dish',
          'low camera angle close to the table surface',
          'camera at a gentle 30-degree angle close to the dish']
TABLES = ['on a dark walnut wooden table', 'on a rustic oak wooden table',
          'on a weathered dark wooden table', 'on a beige linen cloth over a wooden table',
          'on a warm terracotta tiled table', 'on a light pine wooden table']
BACKGROUNDS = ['softly blurred cozy rustic kitchen in the background',
               'softly blurred dark wooden wall with linen textiles in the background',
               'warmly blurred kitchen shelves with jars and herbs in the background',
               'softly blurred bright window with sheer curtains in the background',
               'gently blurred dark dining room corner in the background']
STYLE = ('real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, '
         'served on handmade glazed ceramic tableware, '
         'simple cutlery and a folded beige linen napkin beside the dish, '
         'a few raw ingredients and spices scattered around that naturally match this dish, '
         'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, '
         'muted natural colors, matte realistic food textures: visible grains and crumb, '
         'uneven browning, slightly irregular homemade shapes, sauces with a light oil sheen, '
         'a few crumbs on the table, casual home snapshot look, unedited photo from a real home cook, '
         'shallow depth of field, 50mm lens look, static view of the table, '
         'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark')
NEG = json.load(open(f'{ROOT}/scripts/prompt-overrides.json')).get('_negative', '')

def pick(arr, salt):
    h = 0
    for c in salt:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return arr[h % len(arr)]

def prompt_for(dish):
    subj = subjects.get(dish, dish)
    salt = f'{dish}::v1'
    scene = f'{pick(ANGLES, salt)}, {pick(TABLES, salt)}, {pick(BACKGROUNDS, salt)}'
    return f'{subj}, {scene}, {STYLE}, {NEG}'

# --- сигнатуры прод-фото для дубль-чека (PIL L 256x256, MAD, порог 8.0) ---
from PIL import Image, ImageChops, ImageStat

def sig(img):
    return img.convert('L').resize((256, 256), Image.LANCZOS)

def mad(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]

prod_sigs = {}
for f in sorted(os.listdir(f'{ROOT}/public/dishes')):
    if f.endswith('.jpg'):
        try:
            prod_sigs[f[:-4]] = sig(Image.open(f'{ROOT}/public/dishes/{f}'))
        except Exception as e:
            print(f'  sig skip {f}: {e}')

def api_generate(prompt, tries=2):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE']},
    }).encode()
    for t in range(1, tries + 1):
        req = urllib.request.Request(url, data=body, method='POST', headers={
            'Content-Type': 'application/json', 'x-goog-api-key': KEY})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            for part in d.get('candidates', [{}])[0].get('content', {}).get('parts', []):
                il = part.get('inlineData')
                if il and il.get('data'):
                    return base64.b64decode(il['data'])
            print(f'  нет картинки в ответе (попытка {t})')
        except urllib.error.HTTPError as e:
            print(f'  HTTP {e.code} (попытка {t}): {e.read()[:150]}')
            if e.code == 429:
                time.sleep(25)
        except Exception as e:
            print(f'  ошибка (попытка {t}): {e}')
            time.sleep(10)
    return None

done, skipped = [], []
log = open(LOG, 'a')
for n, dish in enumerate(batch, 1):
    print(f'[{n}/{len(batch)}] {dish}: генерация...')
    raw = api_generate(prompt_for(dish))
    if not raw:
        skipped.append((dish, 'api-fail'))
        continue
    try:
        img = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception as e:
        skipped.append((dish, f'bad-image {e}'))
        continue
    w, h = img.size
    if w != h:  # центровой кроп до квадрата, без искажений
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    img = img.resize((1024, 1024), Image.LANCZOS)
    s_new = sig(img)
    worst = min((mad(s_new, s), d2) for d2, s in prod_sigs.items() if d2 != dish) \
        if prod_sigs else (99, '-')
    same_old = mad(s_new, prod_sigs[dish]) if dish in prod_sigs else 99
    print(f'  MAD: vs худшая чужая {worst[0]:.1f} ({worst[1]}), vs своё старое {same_old:.1f}')
    if worst[0] < 8.0 or same_old < 8.0:
        skipped.append((dish, f'dupe MAD {min(worst[0], same_old):.1f}'))
        continue
    out = f'{ROOT}/public/dishes/{dish}.jpg'
    img.save(out, 'JPEG', quality=88, optimize=True)
    prod_sigs[dish] = s_new
    done.append(dish)
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    log.write(f'{ts} gemini-api {dish} OK (тест-приём, замок после аудита)\n')
    log.flush()
log.close()

print(f'ИТОГ: принято {len(done)}: {", ".join(done)}')
print(f'Пропущено {len(skipped)}: {skipped}')
json.dump({'done': done, 'skipped': [[d, r] for d, r in skipped],
           'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())},
          open(f'{ROOT}/scripts/gemini-api-last-run.json', 'w'), ensure_ascii=False, indent=1)
