#!/usr/bin/env python3
# Генерация фото блюд через Gemini API (Imagen 3) — альтернативный/ускоряющий
# конвейер параллельно с z-ai. Тот же стиль v4 «дорогой ресторан», та же
# очередь и прогресс-файл, что и у Node-скрипта — pipelines совместимы.
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

# Тот же стиль v4, что в scripts/generate-dish-photos.mjs — держать синхронно!
RESTAURANT_STYLE = (
    'real photograph of an elegant dish served at an upscale restaurant, chef plating on a matte ceramic plate, '
    'neat restaurant portion, natural sauce sheen, garnished appropriately for this dish, '
    'natural daylight from a large restaurant window, soft side light, gentle shadows, muted natural colors, '
    'real food textures: visible grains and crumb, uneven browning, slight natural imperfections in shape, '
    'photo taken a few minutes after serving when the dish has settled, clean clear air, '
    'shallow depth of field, softly blurred restaurant dining room in the background, 50mm lens look, '
    'camera at a slight 45-degree angle, static view of the table, '
    'elegant cutlery and a folded linen napkin beside the plate, clean tabletop around the plate, '
    'appetizing, not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark'
)

MODELS = ['imagen-3.0-generate-002', 'imagen-3.0-generate-001']
API = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:predict'


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
            'parameters': {'sampleCount': 1, 'aspectRatio': '1:1'},
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

    # Выбор рабочей модели: пробуем по списку, фиксируем первую живую
    model = None
    for m in MODELS:
        try:
            generate_one(key, m, 'a cup of coffee on a table', timeout=30)
            model = m
            break
        except RuntimeError as e:
            print(f'модель {m}: {e}')
    if not model:
        print('FATAL: ни одна Imagen-модель не доступна на этом ключе '
              '(вероятно нужен платный тариф). Конвейер z-ai продолжает работать.')
        sys.exit(2)
    print(f'модель: {model}')

    ok, fails = 0, []
    for i, dish_id in enumerate(todo, 1):
        subject = subjects.get(dish_id, dish_id)
        prompt = f'{subject}, {RESTAURANT_STYLE}'
        attempt = 0
        while attempt < 4:
            attempt += 1
            try:
                raw = generate_one(key, model, prompt)
                save_jpg(raw, os.path.join(OUT_DIR, f'{dish_id}.jpg'))
                with open(PROGRESS_FILE, 'a', encoding='utf-8') as f:
                    f.write(dish_id + '\n')
                ok += 1
                print(f'[{i}/{len(todo)}] OK {dish_id}')
                break
            except RuntimeError as e:
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
