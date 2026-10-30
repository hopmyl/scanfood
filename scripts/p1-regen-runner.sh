#!/bin/bash
# Перегенерация P1-фото (критичные дефекты) новым промптом.
# Цикл до успеха всех id или лимита попыток; прогресс в scripts/regen-progress.txt.
cd /home/z/my-project
LOG=/tmp/p1-regen.log
P1="blt-sandwich,huang-men-ji,kuay-teow-beef-soup,cobb-salad,glazed-donuts,baozi-steamed-buns,buttermilk-biscuits,potato-skins,cinnamon-rolls,banana-pudding,american-pancakes,club-sandwich,tuna-melt,smoothie-bowl,chicago-hot-dog,apple-charlotte,banana-bread,blueberry-muffins"
need() {
  local miss=""
  echo "$P1" | tr ',' '\n' | while read -r id; do
    grep -qx "$id" scripts/regen-progress.txt 2>/dev/null || echo "$id"
  done
}
echo "=== P1 runner START $(date) ===" >> "$LOG"
for i in $(seq 1 12); do
  MISS=$(need | tr '\n' ',' | sed 's/,$//')
  [ -z "$MISS" ] && { echo "=== ALL P1 DONE $(date) ===" >> "$LOG"; exit 0; }
  echo "=== attempt $i $(date) need: $MISS ===" >> "$LOG"
  timeout 580 node scripts/generate-dish-photos.mjs 0 1 --only="$MISS" >> "$LOG" 2>&1
  sleep 20
done
echo "=== P1 runner EXIT $(date) ===" >> "$LOG"
