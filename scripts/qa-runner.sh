#!/bin/bash
# QA-конвейер СканРецепт: одна партия за прогон.
# Приоритет: 1) брак из аудита (regen-shortlist.txt, не в прогрессе);
#            2) блюда очереди без фото (regen-queue.txt).
# Второй аргумент "nonew" — НЕ генерировать новые блюда (заморозка новой
# генерации, решено пользователем 2026-10-31): только переделка брака.
# Каждый кадр генератора проходит контроль агента-критика (photo-critic.mjs):
# пластик/пар/леттеринг/руки/не-то-блюдо => автореролл (до 3 попыток, лучший в файл).
# Партии сами докатываются: готовое пишется в regen-progress.txt и скипается.
# Запуск: bash scripts/qa-runner.sh [N] [nonew]   (N блюд за прогон, по умолчанию 12)
set -u
cd /home/z/my-project
N="${1:-12}"
MODE="${2:-}"
LOG=/tmp/qa-runner.log
echo "=== qa-runner START $(date) N=$N mode=$MODE ===" >> "$LOG"

NEED=$(node -e "
  const fs=require('fs');
  const mode=process.argv[1]||'';
  const rd=f=>{try{return fs.readFileSync(f,'utf8').split('\n').map(s=>s.trim()).filter(Boolean)}catch(e){return[]}};
  const prog=new Set(rd('scripts/regen-progress.txt'));
  const appr=new Set(rd('scripts/qa-approve.txt')); // утверждены пользователем — не трогать
  const short=rd('scripts/regen-shortlist.txt').filter(id=>!prog.has(id)&&!appr.has(id));
  const photos=new Set(fs.readdirSync('public/dishes').filter(f=>f.endsWith('.jpg')).map(f=>f.slice(0,-4)));
  const queue=mode==='nonew'?[]:rd('scripts/regen-queue.txt').filter(id=>!photos.has(id)&&!short.includes(id)&&!appr.has(id));
  const need=[...short,...queue].slice(0,${N});
  console.log(need.join(','));
  console.error('статистика: шортлист-пендинг='+short.length+' очередь-без-фото='+queue.length);
" "$MODE")

if [ -z "$NEED" ]; then
  echo "=== QUEUE EMPTY $(date) ===" >> "$LOG"
  echo "QUEUE EMPTY"
  exit 0
fi

echo "=== партия: $NEED ===" >> "$LOG"
for i in 1 2; do
  # остаток = партия минус уже записанное в прогресс (докат после таймаута)
  REMAIN=$(printf '%s' "$NEED" | tr ',' '\n' | while read -r id; do
    grep -qx "$id" scripts/regen-progress.txt 2>/dev/null || echo "$id"
  done | paste -sd, -)
  [ -z "$REMAIN" ] && break
  echo "=== attempt $i: $REMAIN ===" >> "$LOG"
  timeout 550 node scripts/generate-dish-photos.mjs 0 1 --only="$REMAIN" >> "$LOG" 2>&1
  sleep 20
done

DONE=$(grep -c . scripts/regen-progress.txt 2>/dev/null || echo 0)
echo "=== qa-runner EXIT $(date): прогресс $DONE строк ===" >> "$LOG"
