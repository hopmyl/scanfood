#!/bin/bash
# Перегенерация фото по очереди scripts/regen-queue.txt (P1-дефекты → VLM-флаги →
# старый стиль → блюда без фото). Прогресс — scripts/regen-progress.txt (там только
# фото, реально сгенерированные НОВЫМ «домашним» стилем).
# Запуск: bash scripts/queue-runner.sh [N]  (N — сколько блюд за прогон, по умолчанию 14)
set -u
cd /home/z/my-project
N="${1:-14}"
LOG=/tmp/queue-runner.log
echo "=== queue-runner START $(date) N=$N ===" >> "$LOG"

need() {
  # id из головы очереди, которых ещё нет в прогрессе
  node -e "
    const fs=require('fs');
    const q=fs.readFileSync('scripts/regen-queue.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
    let done=new Set();
    try{done=new Set(fs.readFileSync('scripts/regen-progress.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean));}catch(e){}
    console.log(q.filter(id=>!done.has(id)).slice(0,${N}).join(','));
  "
}

for i in $(seq 1 2); do
  MISS=$(need)
  [ -z "$MISS" ] && { echo "=== QUEUE EMPTY $(date) ===" >> "$LOG"; exit 0; }
  echo "=== attempt $i: $MISS ===" >> "$LOG"
  timeout 560 node scripts/generate-dish-photos.mjs 0 1 --only="$MISS" >> "$LOG" 2>&1
  # если всё упало в 429 — пауза и повтор той же партии
  sleep 30
done
DONE=$(wc -l < scripts/regen-progress.txt 2>/dev/null || echo 0)
echo "=== queue-runner EXIT $(date): done $DONE/399 ===" >> "$LOG"
