#!/usr/bin/env bash
# Деплой статического зеркала СканРецепт на GitHub Pages (hopmyl.github.io).
# Использование: bash scripts/deploy-pages.sh "комментарий"
# Сборка -> 404.html (SPA-фолбэк) -> force-push в ветку main репозитория-зеркала.
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-deploy: $(date -u '+%Y-%m-%d %H:%M UTC')}"
TOKEN=$(git remote get-url origin | sed -E 's#https://([^@]+)@.*#\1#')
REMOTE="https://${TOKEN}@github.com/hopmyl/hopmyl.github.io.git"

echo "[1/3] Сборка..."
npm run build >/dev/null 2>&1
cp dist/index.html dist/404.html

echo "[2/3] Коммит зеркала: ${MSG}"
BUNDLE_ID=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)
cd dist
git init -q -b main 2>/dev/null || git init -q
git add -A
git -c user.name="deploy-bot" -c user.email="deploy@local" commit -qm "${MSG} (${BUNDLE_ID})" || echo "нет изменений для коммита"

echo "[3/3] Пуш в hopmyl.github.io..."
git push -q --force "$REMOTE" main
cd ..
echo "Готово: https://hopmyl.github.io  (бандл ${BUNDLE_ID})"
