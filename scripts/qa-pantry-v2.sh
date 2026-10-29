#!/bin/bash
# QA: Запасы (баночки+сроки+пресеты) и экран скана (чипы зума). Вьюпорт 360px.
cd /home/z/my-project

agent-browser set viewport 360 780
agent-browser open http://localhost:3000/pantry
agent-browser wait 1500

# Тестовый набор: сроки относительно сегодня (2026-10-29):
# Яйца — сегодня (красный), Творог — завтра (красный), Кефир — +7 (янтарный)
agent-browser eval "localStorage.setItem('skan-recept-store', JSON.stringify({state:{userProfile:{isPro:false,scansLeft:5,scannedTotal:0},favorites:[],shoppingList:[],pantry:['Мука','Яйца','Молоко','Сахар','Соль','Рис','Паста','Лук','Чеснок','Морковь','Помидоры','Сыр','Картофель','Крабовые палочки','Оливки и маслины','Нори','Соевый соус','Творог','Йогурт','Кефир'],pantryExpiry:{'Творог':'2026-10-30','Яйца':'2026-10-29','Кефир':'2026-11-05'},theme:'light'},version:3}))"
agent-browser reload
agent-browser wait 2500
agent-browser screenshot --full /home/z/my-project/download/qa-pantry-v2.png

# Диалог срока: клик по баночке Творог
agent-browser eval "document.querySelector('button[aria-label=\"Срок годности «Творог»\"]')?.click(); 'clicked'"
agent-browser wait 800
agent-browser screenshot /home/z/my-project/download/qa-expiry-dialog.png
agent-browser eval "document.querySelectorAll('button').length ? [...document.querySelectorAll('div.fixed button')].map(b=>b.textContent?.trim()).filter(Boolean).slice(0,10).join('|') : 'no-dialog'"
agent-browser press Escape 2>/dev/null || true

# Экран скана: чипы зума (камера в headless не запустится, но разметка проверяется)
agent-browser open http://localhost:3000/scan
agent-browser wait 2000
agent-browser screenshot /home/z/my-project/download/qa-scan-chips.png

echo '--- JS errors ---'
agent-browser errors
agent-browser close
echo DONE
