#!/usr/bin/env python3
# Санитизация scripts/photo-subjects.json под стиль v6 (2026-10-31):
# 1) срезает устаревшие хвосты v4 «elegant restaurant plating, matte ceramic
#    plate» / «generous restaurant portion, elegant plating» — они дублируют и
#    противоречат базовому стилю (rustic handmade ceramic);
# 2) короткие заглушки (<75 знаков после чистки) заменяет детальными
#    формулировками из массива DISHES в scripts/generate-dish-photos.mjs;
# 3) три «упрямых» блюда (сырники, блины, борщ) — усиленные ручные промпты.
# Идемпотентно: повторный запуск ничего не портит.
import json
import re
import sys

ROOT = '/home/z/my-project'
SUBJECTS = ROOT + '/scripts/photo-subjects.json'
MJS = ROOT + '/scripts/generate-dish-photos.mjs'

STALE = re.compile(
    r'[\s.]*(?:elegant restaurant plating, matte ceramic plate|'
    r'generous restaurant portion, elegant plating)\s*$'
)

# Ручные усиления: модель дважды уходила от описания (сырники -> блинчики,
# блины -> оладьи, борщ -> рагу). Только позитивные формулировки.
MANUAL = {
    'cottage-cheese-pancakes': (
        'Russian syrniki: five small thick round cottage cheese fritters with '
        'golden crispy crust, each fritter about 2 cm thick, visible curd '
        'texture, dollop of sour cream on top, powdered sugar, fresh '
        'raspberries aside'
    ),
    'milk-blini': (
        'Stack of thin golden Russian blini crepes with lacy browned edges, '
        'several crepes rolled into triangles, small bowl of sour cream and '
        'berry jam aside'
    ),
    'borscht': (
        'Borscht: deep crimson beetroot soup with visible shredded beet and '
        'cabbage pieces, swirl of white sour cream and fresh dill on top, '
        'pieces of beef, garlic bread on the side'
    ),
}


def parse_mjs_dishes():
    """Достаёт пары ['id','text'] из массива DISHES в .mjs (простые литералы)."""
    src = open(MJS, encoding='utf-8').read()
    block = src.split('const DISHES = [', 1)[1].split('];', 1)[0]
    pairs = re.findall(r"\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]", block)
    return dict(pairs)


def main():
    subjects = json.load(open(SUBJECTS, encoding='utf-8'))
    mjs = parse_mjs_dishes()
    print('DISHES в .mjs:', len(mjs))

    stripped = enriched = manual = 0
    for dish_id, text in subjects.items():
        new = STALE.sub('', text).strip()
        new = re.sub(r'\s*,\s*$', '', new).strip()
        if new != text:
            stripped += 1
        if dish_id in MANUAL:
            new = MANUAL[dish_id]
            manual += 1
        elif len(new) < 75 and dish_id in mjs and len(mjs[dish_id]) > len(new):
            new = mjs[dish_id]
            enriched += 1
        subjects[dish_id] = new

    json.dump(subjects, open(SUBJECTS, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    short_left = [k for k, v in subjects.items() if len(v) < 75]
    print(f'срезано хвостов v4: {stripped}; обогащено из .mjs: {enriched}; '
          f'ручных: {manual}; осталось коротких: {len(short_left)}')
    if short_left:
        print('короткие без замены:', ', '.join(short_left[:20]))


if __name__ == '__main__':
    sys.exit(main())
