#!/usr/bin/env python3
# Генерация фото блюд через Gemini API (Imagen 3) — альтернативный/ускоряющий
# конвейер параллельно с z-ai. Тот же стиль v6 «тёплая домашняя рустик-подача»,
# та же очередь и прогресс-файл, что и у Node-скрипта — pipelines совместимы.
#
# Ключ: файл scripts/.env со строкой GEMINI_API_KEY=...  (в .gitignore!)
# Запуск: python3 scripts/generate-dish-photos-gemini.py --limit 30
#         python3 scripts/generate-dish-photos-gemini.py --only=id1,id2
# Резюмируемость: готовые id пропускаются по scripts/regen-progress.txt.
import base64
import io
import json
import os
import sys
import time
import argparse

import requests
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SUBJECTS_FILE = os.path.join(ROOT, 'scripts', 'photo-subjects.json')
QUEUE_FILE = os.path.join(ROOT, 'scripts', 'regen-queue.txt')
PROGRESS_FILE = os.path.join(ROOT, 'scripts', 'regen-progress.txt')
OUT_DIR = os.path.join(ROOT, 'public', 'dishes')
ENV_FILE = os.path.join(BASE, '.env')

# Тот же стиль v6, что в scripts/generate-dish-photos.mjs — держать синхронно!
# v6: тёплая домашняя рустик-подача (по референсам пользователя от 2026-10-31):
# тёмное дерево, лён, керамика ручной работы, тёплый боковой свет, вокруг блюда
# — родственные сырые ингредиенты. Пустой стол больше не нужен — «rustic» не
# провоцирует бокалы. Разброс ракурс/стол/фон по хэшу id — с v5.
DISH_STYLE_BASE = (
    'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, '
    'served on handmade glazed ceramic tableware, '
    'simple cutlery and a folded beige linen napkin beside the dish, '
    'a few raw ingredients and spices scattered around that naturally match this dish, '
    'warm natural side light, golden warm tone, soft gentle shadows, rich but natural colors, '
    'real food textures: visible grains and crumb, uneven browning, natural imperfect shapes, glossy natural sauces, '
    'shallow depth of field, 50mm lens look, static view of the table, '
    'appetizing, mouth-watering, '
    'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark'
)

ANGLES = [
    'camera at a slight 45-degree angle above the table',
    'straight-on eye-level camera angle',
    'top-down overhead camera angle looking straight down at the dish',
    'low camera angle close to the table surface',
    'camera at a gentle 30-degree angle close to the dish',
]
TABLES = [
    'on a dark walnut wooden table',
    'on a rustic oak wooden table',
    'on a weathered dark wooden table',
    'on a beige linen cloth over a wooden table',
    'on a warm terracotta tiled table',
    'on a light pine wooden table',
]
BACKGROUNDS = [
    'softly blurred cozy rustic kitchen in the background',
    'softly blurred dark wooden wall with linen textiles in the background',
    'warmly blurred kitchen shelves with jars and herbs in the background',
    'softly blurred bright window with sheer curtains in the background',
    'gently blurred dark dining room corner in the background',
]


def pick_variant(arr: list, dish_id: str) -> str:
    h = 0
    for c in dish_id:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return arr[h % len(arr)]


def scene_for(dish_id: str) -> str:
    return ', '.join([
        pick_variant(ANGLES, dish_id),
        pick_variant(TABLES, dish_id),
        pick_variant(BACKGROUNDS, dish_id),
    ])

MODELS = ['imagen-3.0-generate-002', 'imagen-3.0-generate-001']
API = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:predict'

# Nano banana (та модель, что делала референс-коллажи пользователя) через
# generateContent — работает на том же ключе, если включён платный тариф.
CHAT_MODEL = 'gemini-2.5-flash-image'
API_CHAT = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'


def load_key():
    key = os.environ.get('GEMINI_API_KEY', '')
    if key:
        return key
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding='utf-8'):
            line = line.strip()
            if line.startswith('GEMINI_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"\'')
    return ''


def read_lines(path):
    if not os.path.exists(path):
        return []
    return [s.strip() for s in open(path, encoding='utf-8') if s.strip()]


def generate_one(key, model, prompt, timeout=90):
    """Возвращает bytes картинки или бросает RuntimeError с текстом ошибки."""
    resp = requests.post(
        API.format(model=model),
        params={'key': key},
        json={
            'instances': [{'prompt': prompt}],
            'parameters': {
                'sampleCount': 1,
                'aspectRatio': '1:1',
                # Из скрипта, присланного пользователем 2026-10-31: страховка
                # от людей в кадре на уровне API (не в тексте промпта — там
                # негативы вредят, модель начинает рисовать запретное).
                'personGeneration': 'dont_allow',
            },
        },
        timeout=timeout,
    )
    if resp.status_code == 429:
        raise RuntimeError('429')
    if resp.status_code == 403:
        raise RuntimeError('403: ' + resp.text[:200])
    if resp.status_code == 404:
        raise RuntimeError('404: модель недоступна на этом ключе')
    resp.raise_for_status()
    data = resp.json()
    b64 = data.get('predictions', [{}])[0].get('bytesBase64Encoded')
    if not b64:
        raise RuntimeError('пустой ответ: ' + json.dumps(data)[:200])
    return base64.b64decode(b64)


def generate_one_chat(key, prompt, timeout=120):
    """Nano banana через generateContent. Возвращает bytes или RuntimeError."""
    resp = requests.post(
        API_CHAT.format(model=CHAT_MODEL),
        headers={'x-goog-api-key': key, 'Content-Type': 'application/json'},
        json={
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {
                'responseModalities': ['IMAGE'],
                'imageConfig': {'aspectRatio': '1:1'},
            },
        },
        timeout=timeout,
    )
    if resp.status_code == 429:
        msg = resp.text
        # limit: 0 = модель закрыта на бесплатном тарифе (нужен биллинг)
        if 'limit: 0' in msg:
            raise RuntimeError('429 LIMIT0: бесплатный тариф — 0 запросов/день, нужен биллинг')
        raise RuntimeError('429')
    if resp.status_code == 403:
        raise RuntimeError('403: ' + resp.text[:200])
    if resp.status_code == 404:
        raise RuntimeError('404: модель недоступна на этом ключе')
    resp.raise_for_status()
    data = resp.json()
    parts = (data.get('candidates') or [{}])[0].get('content', {}).get('parts', [])
    for p in parts:
        if p.get('inlineData', {}).get('data'):
            return base64.b64decode(p['inlineData']['data'])
    raise RuntimeError('нет изображения: ' + json.dumps(data)[:200])


def save_jpg(raw, out_path):
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    img.save(out_path, 'JPEG', quality=85, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=30, help='сколько блюд за запуск')
    ap.add_argument('--only', type=str, default='', help='csv конкретных id (игнорируя прогресс)')
    args = ap.parse_args()

    key = load_key()
    if not key:
        print('FATAL: нет ключа. Создай scripts/.env со строкой GEMINI_API_KEY=...')
        sys.exit(1)

    subjects = json.load(open(SUBJECTS_FILE, encoding='utf-8'))
    queue = read_lines(QUEUE_FILE) or list(subjects.keys())
    done = set(read_lines(PROGRESS_FILE))

    if args.only:
        todo = [s.strip() for s in args.only.split(',') if s.strip()]
    else:
        todo = [i for i in queue if i not in done]
    todo = todo[: args.limit]

    if not todo:
        print('QUEUE EMPTY')
        return

    # Выбор движка: 1) Imagen predict; 2) nano banana generateContent.
    engine = None
    for m in MODELS:
        try:
            generate_one(key, m, 'a cup of coffee on a table', timeout=30)
            engine = ('predict', m)
            break
        except RuntimeError as e:
            print(f'модель {m}: {e}')
    if not engine:
        try:
            generate_one_chat(key, 'a cup of coffee on a table')
            engine = ('chat', CHAT_MODEL)
        except RuntimeError as e:
            print(f'модель {CHAT_MODEL}: {e}')
    if not engine:
        print('FATAL: ни Imagen, ни nano banana недоступны на этом ключе '
              '(image-модели требуют платный тариф: включите биллинг в AI Studio '
              'или остаёмся на конвейере z-ai).')
        sys.exit(2)
    kind, model = engine
    print(f'движок: {kind} ({model})')

    ok, fails = 0, []
    for i, dish_id in enumerate(todo, 1):
        subject = subjects.get(dish_id, dish_id)
        prompt = f'{subject}, {scene_for(dish_id)}, {DISH_STYLE_BASE}'
        attempt = 0
        while attempt < 4:
            attempt += 1
            try:
                raw = (generate_one(key, model, prompt) if kind == 'predict'
                       else generate_one_chat(key, prompt))
                save_jpg(raw, os.path.join(OUT_DIR, f'{dish_id}.jpg'))
                with open(PROGRESS_FILE, 'a', encoding='utf-8') as f:
                    f.write(dish_id + '\n')
                ok += 1
                print(f'[{i}/{len(todo)}] OK {dish_id}')
                break
            except RuntimeError as e:
                if 'LIMIT0' in str(e):
                    print(f'[{i}/{len(todo)}] {dish_id}: {e} — стоп, ключ без биллинга')
                    fails.append(dish_id)
                    break
                wait = 60 if '429' in str(e) else 15
                print(f'[{i}/{len(todo)}] {dish_id}: {e} — жду {wait}s (попытка {attempt})')
                time.sleep(wait)
        else:
            fails.append(dish_id)
        time.sleep(5)  # троттлинг ~12 RPM

    print(f'=== ИТОГ: успешно {ok}/{len(todo)}; прогресс {len(done) + ok}/399')
    if fails:
        print('Провалы:', ', '.join(fails))
        sys.exit(2)


if __name__ == '__main__':
    main()
