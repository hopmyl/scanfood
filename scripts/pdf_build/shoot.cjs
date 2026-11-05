// Screenshot diagram HTML -> PNG @2x (diagrams are PNG sub-elements for ReportLab Image())
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const files = [
    ['diagram_arch.html', 'diagram_arch.png'],
    ['diagram_pipeline.html', 'diagram_pipeline.png'],
  ];
  const browser = await chromium.launch();
  for (const [src, out] of files) {
    const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1040, height: 1400 } });
    await page.goto('file://' + path.resolve(__dirname, src));
    await page.waitForTimeout(300);
    const el = await page.$('.canvas');
    await el.screenshot({ path: path.resolve(__dirname, out) });
    console.log('shot', out);
    await page.close();
  }
  await browser.close();
})();
