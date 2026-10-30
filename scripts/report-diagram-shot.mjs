#!/usr/bin/env node
/**
 * Скриншот HTML-диаграмм для PDF-отчёта: element #root → PNG @2x.
 * Использование: node scripts/report-diagram-shot.mjs <in.html> <out.png> [minWidth]
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const [inHtml, outPng, minWidth = '0'] = process.argv.slice(2);
if (!inHtml || !outPng) {
  console.error('usage: node report-diagram-shot.mjs <in.html> <out.png> [minWidth]');
  process.exit(1);
}
const htmlPath = resolve(inHtml);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 2,
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const root = page.locator('#root');
const box = await root.boundingBox();
const needW = Math.max(Number(minWidth), Math.ceil(box.width));
if (needW > page.viewportSize().width) {
  await page.setViewportSize({ width: needW, height: 1400 });
  await page.waitForTimeout(250);
}
const finalBox = await root.boundingBox();
await page.setViewportSize({
  width: Math.ceil(finalBox.width) + 2,
  height: Math.ceil(finalBox.y + finalBox.height) + 2,
});
await page.waitForTimeout(150);
await root.screenshot({ path: outPng });
await browser.close();
console.log('OK', outPng);
