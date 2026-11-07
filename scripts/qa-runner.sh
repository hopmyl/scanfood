#!/bin/bash
# QA-конвейер СканРецепт: одна партия за прогон.
# Приоритет: 1) брак из аудита (regen-shortlist.txt, не в прогрессе);
#            2) блюда очереди без фото (regen-queue.txt).
# Второй аргумент "nonew" — НЕ генерировать новые блюда (заморозка новой
# генерации, решено пользователем 2026-10-31): только переделка брака.
# Каждый кадр генератора проходит контроль агента-критика (photo-critic.mjs):
# пластик/пар/леттеринг/руки/не-то-блюдо => автореролл (до 3 попыток, лучший в файл).
# Партии сами докатываются: готовое пишется в regen-progress.txt и скипается.
# После партии — срез АГЕНТА-ПОВАРА (chef-critic.mjs, glm-4.6, дёшево):
# проверка рецептов и порядка шагов; пишет chef-report.json, брак — в
# chef-fixlist.txt (запрос пользователя 2026-11-02: проверки и переделка
# «с учётом критика и повара»).
# Запуск: bash scripts/qa-runner.sh [N] [nonew]   (N блюд за прогон, по умолчанию 12)
set -u
cd /home/z/my-project
N="${1:-12}"
MODE="${2:-}"
LOG=/tmp/qa-runner.log
echo "=== qa-runner START $(date) N=$N mode=$MODE ===" >> "$LOG"

# --- ПАУЗА РЕМОНТА ФОТО (запрос пользователя 2026-11-07: прекратить 429-спам) ---
# scripts/photo-repair-paused.flag — генерация и natural-regen пропускаются.
# FORCE_REPAIR=1 — принудительный запуск мимо паузы (автоснятие при ZAI_OK).
if [ -f scripts/photo-repair-paused.flag ] && [ "${FORCE_REPAIR:-}" != "1" ]; then
  echo "=== photo-repair SKIPPED (пауза по запросу пользователя) $(date) ===" >> "$LOG"
else
NEED=$(node -e "
  const fs=require('fs'), crypto=require('crypto');
  const mode=process.argv[1]||'';
  const rd=f=>{try{return fs.readFileSync(f,'utf8').split('\n').map(s=>s.trim()).filter(Boolean)}catch(e){return[]}};
  const prog=new Set(rd('scripts/regen-progress.txt'));
  const appr=new Set(rd('scripts/qa-approve.txt')); // утверждены пользователем — не трогать
  // ФИНАЛЬНЫЕ ЗАМКИ (natural-regen v7, 2026-11-05): замороженные фото (sha256
  // совпадает с photo-locks.json) конвейеру запрещены — «чтобы не переделывать»
  let LOCKS={};try{LOCKS=JSON.parse(fs.readFileSync('scripts/photo-locks.json','utf8'))}catch(e){}
  const isLocked=id=>{try{const l=LOCKS[id];if(!l)return false;
    const h=crypto.createHash('sha256').update(fs.readFileSync('public/dishes/'+id+'.jpg')).digest('hex');
    return h===l.sha256}catch(e){return false}};
  const short=rd('scripts/regen-shortlist.txt').filter(id=>!prog.has(id)&&!appr.has(id)&&!isLocked(id));
  const photos=new Set(fs.readdirSync('public/dishes').filter(f=>f.endsWith('.jpg')).map(f=>f.slice(0,-4)));
  const queue=mode==='nonew'?[]:rd('scripts/regen-queue.txt').filter(id=>!photos.has(id)&&!short.includes(id)&&!appr.has(id)&&!isLocked(id));
  const need=[...short,...queue].slice(0,${N});
  console.log(need.join(','));
  console.error('статистика: шортлист-пендинг='+short.length+' очередь-без-фото='+queue.length);
" "$MODE")

if [ -z "$NEED" ]; then
  echo "=== QUEUE EMPTY $(date) ===" >> "$LOG"
  echo "QUEUE EMPTY"
else
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
fi

# --- НАТУРАЛ v7: финальная перегенерация брака с замками (2026-11-05) ---
# Очередь сама: брак отчёта + qa-manual + пендинг шортлиста (без approved/locked).
# Каналы: платный OR (если есть кредиты) → z-ai → turbo; критик z-ai → OR-фолбэк
# (стойкий суточный кап, квота сканера не трогается). Гейт score>=8 без флагов
# => ЗАМОК (photo-locks.json) — больше никогда не переделывается. До 3 блюд
# за прогон: 15 бракованных докатываются за ~3 часа крона.
echo "=== natural-regen START $(date) ===" >> "$LOG"
timeout 240 node scripts/natural-regen.mjs --limit=3 >> "$LOG" 2>&1 || true
echo "=== natural-regen EXIT $(date) ===" >> "$LOG"
fi # конец блока ремонта (пауза)

# --- Срез агента-повара: рецепты и порядок шагов (инкрементально) ---
# ПАУЗА ПОВАРА (запрос пользователя 2026-11-02 ~13:40: «повара на паузу,
# сначала делаем фото»): пока существует scripts/chef-paused.flag, срез
# пропускается. Вернуть повара: удалить файл scripts/chef-paused.flag.
if [ -f scripts/chef-paused.flag ]; then
  echo "=== chef-slice SKIPPED (пауза по запросу пользователя) $(date) ===" >> "$LOG"
else
  echo "=== chef-slice START $(date) ===" >> "$LOG"
  timeout 240 node scripts/chef-critic.mjs --limit=10 >> "$LOG" 2>&1
  echo "=== chef-slice EXIT $(date) ===" >> "$LOG"
fi

DONE=$(grep -c . scripts/regen-progress.txt 2>/dev/null || echo 0)
echo "=== qa-runner EXIT $(date): прогресс $DONE строк ===" >> "$LOG"
