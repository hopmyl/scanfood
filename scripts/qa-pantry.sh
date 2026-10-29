#!/bin/bash
# QA экрана «Запасы»: одинаковые баночки, перенос длинных названий,
# новые эмодзи, блок «Скоро испортится» со ссылками. Вьюпорт 360px.
cd /home/z/my-project

npm run preview >/tmp/preview.log 2>&1 &
PREVIEW_PID=$!
sleep 4

agent-browser set viewport 360 780
agent-browser open http://localhost:3000/pantry
agent-browser wait 1500

# Тестовый набор: 20 баночек (5 полок), длинные имена, новые эмодзи, сроки
agent-browser eval "localStorage.setItem('skan-recept-store', JSON.stringify({state:{userProfile:{isPro:false,scansLeft:5,scannedTotal:0},favorites:[],shoppingList:[],pantry:['Мука','Яйца','Молоко','Сахар','Соль','Рис','Паста','Лук','Чеснок','Морковь','Помидоры','Сыр','Картофель','Крабовые палочки','Оливки и маслины','Нори','Соевый соус','Творог','Йогурт','Кефир'],pantryExpiry:{'Творог':'2026-10-30','Яйца':'2026-10-29','Кефир':'2026-11-05'},theme:'light'},version:3}))"
agent-browser reload
agent-browser wait 2500

agent-browser screenshot --full /home/z/my-project/download/qa-pantry-360.png
echo '--- JS errors ---'
agent-browser errors
agent-browser close
kill $PREVIEW_PID 2>/dev/null
echo DONE
