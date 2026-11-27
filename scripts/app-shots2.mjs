// Досъёмка: вкладка «План» (клик по кнопке роли button) + низ Скан-экрана
import { chromium } from 'playwright';
const base = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

await page.goto(`${base}/diary`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'План', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shots/m-plan.png' });
await page.close();

const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p2.goto(`${base}/scan`, { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(900);
await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p2.waitForTimeout(400);
await p2.screenshot({ path: '/tmp/shots/m-scan-bottom.png' });
await p2.close();

await browser.close();
console.log('re-shots done');
