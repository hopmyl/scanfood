#!/usr/bin/env bash
# Обновление ОБОИХ зеркал СканРецепт:
#   1) корень https://hopmyl.github.io/          (репозиторий hopmyl.github.io, main)
#   2) сабпат https://hopmyl.github.io/scanfood/ (репозиторий scanfood, ветка gh-pages, base=/scanfood/)
# Использование: bash scripts/deploy-all.sh "комментарий"
set -uo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-deploy: $(date -u '+%Y-%m-%d %H:%M UTC')}"

echo "[1/4] Корень hopmyl.github.io..."
bash scripts/deploy-pages.sh "$MSG" || echo "WARN: root mirror failed (продолжаю)"

echo "[2/4] Сборка сабпата base=/scanfood/..."
node scripts/make-photo-manifest.mjs || echo "WARN: манифест фото не обновился"
if ! GITHUB_ACTIONS=true npx vite build --outDir /tmp/mroot --emptyOutDir >/dev/null 2>&1; then
  echo "WARN: subpath build failed"; exit 0
fi
cp /tmp/mroot/index.html /tmp/mroot/404.html

echo "[3/4] Синк .mirror (ветка gh-pages)..."
if [ ! -d .mirror/.git ]; then
  rm -rf .mirror
  git clone -q --single-branch -b gh-pages "$(git remote get-url origin)" .mirror || { echo "WARN: clone failed"; exit 0; }
fi
cp -r /tmp/mroot/* .mirror/
cd .mirror
git add -A
if ! git -c user.name="deploy-bot" -c user.email="deploy@local" commit -qm "pages: ${MSG}"; then
  echo "сабпат: без изменений"
else
  git push -q origin gh-pages || echo "WARN: gh-pages push failed"
fi

echo "[4/4] Готово. Сабпат-бандл: $(grep -o 'index-[^"]*\.js' index.html | head -1)"
