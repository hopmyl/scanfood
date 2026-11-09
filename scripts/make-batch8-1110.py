#!/usr/bin/env python3
# Партия №8 для ручной генерации в Gemini: avocado-toast (просьба пользователя,
# замок снят 2026-11-09) первым, hash-browns вторым (в партии-7 пришёл дубль,
# фото не доставлено), далее 7 худших из очереди (кроме этих двух).
import re, sys

ROOT = '/home/z/my-project'
FULL = f'{ROOT}/download/gemini-full-queue-prompts.txt'
OUT = f'{ROOT}/download/gemini-batch8-prompts.txt'

ORDER = ['avocado-toast', 'hash-browns', 'kefir-pancakes', 'khao-man-gai',
         'kofte-turkish', 'kung-pao-chicken', 'larb-chicken', 'lazy-vareniki',
         'lyulya-kebab']

txt = open(FULL).read()
# Блоки: "N. slug  (текущий балл аудита: X)\n<prompt>" до следующего "N. " или конца
blocks = {}
for m in re.finditer(r'^\d+\.\s+(\S+)\s+\(текущий балл аудита: ([^)]+)\)\n(.*?)(?=^\d+\.\s|\Z)',
                     txt, re.M | re.S):
    blocks[m.group(1)] = (m.group(2), m.group(3).strip())

missing = [d for d in ORDER if d not in blocks]
if missing:
    print('MISSING:', missing); sys.exit(1)

out = ['СканРецепт — партия №8 для Gemini (9 шт, стиль v7).',
       '№1 — avocado-toast: переделка по просьбе пользователя (старый замок снят 2026-11-09).',
       '№2 — hash-browns: не доехал в партии-7 (присланный файл был дублем другого фото).',
       'Остальные — худшие из очереди. Формат: ландшафт (3:2 или 4:3). Прислать пачкой — сверю по содержимому.',
       '']
for n, dish in enumerate(ORDER, 1):
    sc, prompt = blocks[dish]
    out.append(f'{n}. {dish}  (текущий балл аудита: {sc})')
    out.append(prompt)
    out.append('')

open(OUT, 'w').write('\n'.join(out))
print(f'Партия-8: {len(ORDER)} промптов -> {OUT}')
for d in ORDER:
    print(f'  - {d} (score {blocks[d][0]})')
