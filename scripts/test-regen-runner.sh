#!/bin/bash
# Тестовая перегенерация 2 блюд новым промптом (анти-пластик).
# Ловит окно квоты: цикл попыток с паузами, до успеха или лимита времени.
cd /home/z/my-project
LOG=/tmp/test-regen.log
echo "=== START $(date) ===" >> "$LOG"
for i in $(seq 1 8); do
  echo "=== attempt $i $(date) ===" >> "$LOG"
  timeout 580 node scripts/generate-dish-photos.mjs 0 1 --only=croissant-salmon,blt-sandwich >> "$LOG" 2>&1
  if grep -q "croissant-salmon" scripts/regen-progress.txt && grep -q "blt-sandwich" scripts/regen-progress.txt; then
    echo "=== BOTH DONE $(date) ===" >> "$LOG"
    exit 0
  fi
  sleep 15
done
echo "=== NOT FULLY DONE $(date) ===" >> "$LOG"
