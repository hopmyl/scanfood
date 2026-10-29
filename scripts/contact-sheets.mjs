/**
 * Контакт-листы для визуальной проверки фото блюд.
 * 6×4 фото на лист (1920×1280), с подписями id.
 * Запуск: node scripts/contact-sheets.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/dishes';
const OUT = 'download/sheets';
fs.mkdirSync(OUT, { recursive: true });

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.jpg'))
  .sort();
const TH = 320; // thumb size
const COLS = 6;
const ROWS = 4;
const PER = COLS * ROWS;

async function makeSheet(names, idx) {
  const comps = [];
  for (let i = 0; i < names.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const buf = await sharp(path.join(DIR, names[i]))
      .resize(TH, TH, { fit: 'cover' })
      .toBuffer();
    const labeled = await sharp(buf)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${TH}" height="34"><rect width="${TH}" height="34" fill="black" opacity="0.7"/><text x="8" y="24" font-size="18" font-family="sans-serif" fill="white">${names[i].replace('.jpg', '').slice(0, 40)}</text></svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();
    comps.push({ input: labeled, left: col * TH, top: row * TH });
  }
  await sharp({
    create: {
      width: COLS * TH,
      height: ROWS * TH,
      channels: 3,
      background: '#222',
    },
  })
    .composite(comps)
    .jpeg({ quality: 88 })
    .toFile(path.join(OUT, `sheet-${String(idx).padStart(2, '0')}.jpg`));
  return names.length;
}

let idx = 0;
for (let i = 0; i < files.length; i += PER) {
  const slice = files.slice(i, i + PER);
  await makeSheet(slice, idx++);
  console.log(
    `sheet-${String(idx - 1).padStart(2, '0')}: ${slice[0].replace('.jpg', '')} … ${slice[slice.length - 1].replace('.jpg', '')} (${slice.length})`,
  );
}
console.log(`Всего листов: ${idx}, фото: ${files.length}`);
