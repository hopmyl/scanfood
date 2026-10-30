#!/bin/bash
# Удаление 228 фото с дефектами (пластик/пар/руки/текст) после проверки нового промпта.
# Git хранит историю — ничего не теряется. Дальше шард-режим догенерирует всё с новым REAL_STYLE.
cd /home/z/my-project
n=0
while read -r id; do
  [ -z "$id" ] && continue
  # Только что перегенерированные (уже с новым промптом) не трогаем
  if grep -qx "$id" scripts/regen-progress.txt 2>/dev/null; then
    echo "skip (fresh): $id"
    continue
  fi
  if [ -f "public/dishes/$id.jpg" ]; then
    rm -f "public/dishes/$id.jpg"
    n=$((n+1))
  fi
done < scripts/regen-flags.txt
echo "deleted: $n; remaining photos: $(ls public/dishes/*.jpg 2>/dev/null | wc -l)"
