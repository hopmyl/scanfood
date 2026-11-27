// Визуальная проверка правок 26.11: скриншоты ключевых экранов (мобайл 390×844 + десктоп 1280×800).
// Запуск: npx vite preview --port 3000 & node scripts/app-shots.mjs
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: `/tmp/shots/${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);

// 1) Каталог (мобайл): подписи фильтров, быстрые чипсы, сетка 2 кол
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await wait(1200);
await shot('m-catalog');

// 2) Каталог, низ: пагинация «Показать ещё», отступ под навбар
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await wait(500);
await shot('m-catalog-bottom');

// 3) Кладовая: «Пополнить» под шкафчиком (автоскролл)
await page.goto(`${base}/pantry`, { waitUntil: 'domcontentloaded' });
await wait(900);
await page.click('text=Пополнить');
await wait(900);
await shot('m-pantry-picker');

// 4) Скан: низ страницы — подпись не под центральной кнопкой
await page.goto(`${base}/scan`, { waitUntil: 'domcontentloaded' });
await wait(900);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await wait(400);
await shot('m-scan-bottom');

// 5) Карточка PRO-блюда (залочено): теги + кнопка дневника, без дубля PRO
await page.goto(`${base}/dish/sushi-set`, { waitUntil: 'domcontentloaded' });
await wait(1100);
await shot('m-dish-pro');

// 6) Дневник: лента недели, итоги, график, приёмы пищи
await page.goto(`${base}/diary`, { waitUntil: 'domcontentloaded' });
await wait(900);
await shot('m-diary');

// 7) План на неделю
await page.click('text=План');
await wait(500);
await shot('m-plan');
await page.close();

// 8) Каталог (десктоп): 4 колонки, чипсы переносятся
const dpage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await dpage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await dpage.waitForTimeout(1300);
await dpage.screenshot({ path: '/tmp/shots/d-catalog.png' });
await dpage.close();

await browser.close();
console.log('shots done -> /tmp/shots');
