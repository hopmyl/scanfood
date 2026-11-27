// Функциональная проверка правок 26.11 (баг-репорт пользователя):
//  1) результаты скана переживают переключение вкладок;
//  2) «Фри из батата» и «Печенье с арахисовой пастой» больше не в «из запасов»;
//  3) на залоченной PRO-карточке ровно один бейдж PRO.
import { chromium } from 'playwright';
const base = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(12000);
const log = (s) => console.log(`-- ${s}`);

let fails = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) fails++;
};

// --- 2) кладовая: ложных матчингов нет ---
log('открываю кладовую');
await page.goto(`${base}/pantry`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
log('читаю текст кладовой');
const pantryText = await page.textContent('body');
check('фри из батата НЕ в «из запасов»', !pantryText.includes('Фри из батата'));
check(
  'печенье с арахисовой пастой НЕ в «из запасов»',
  !pantryText.includes('Печенье с арахисовой пастой'),
);

// --- 1) скан: демо-результат живёт между вкладками ---
log('открываю скан');
await page.goto(`${base}/scan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
log('клик Демо-скан');
await page.getByRole('button', { name: 'Демо-скан' }).click();
await page.waitForTimeout(500);
check('демо-скан показал результат', (await page.textContent('body')).includes('ДЕМО'));
log('клик Штрих-код');
await page.getByRole('button', { name: 'Штрих-код' }).click();
await page.waitForTimeout(500);
const barcodeShown = (await page.textContent('body')).includes('Или введи код вручную');
check('переключились на штрих-код', barcodeShown);
log('клик Продукты (возврат)');
await page.getByRole('button', { name: 'Продукты' }).click();
await page.waitForTimeout(500);
check('результат демо-скана сохранился после возврата', (await page.textContent('body')).includes('ДЕМО'));

// --- 3) один PRO-бейдж на залоченной карточке ---
log('открываю каталог');
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
log('ищу залоченную карточку');
const lockedCard = page.locator('a', { hasText: 'PRO-рецепт' }).first();
await lockedCard.scrollIntoViewIfNeeded();
const proBadges = await lockedCard.locator('span', { hasText: /^PRO$/ }).count();
check(`на PRO-карточке один бейдж PRO (найдено ${proBadges})`, proBadges === 1);

await browser.close();
console.log(fails === 0 ? 'ALL PASS' : `FAILED: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
