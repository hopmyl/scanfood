/**
 * Сборка превью-листа из указанных блюд: node scripts/make-preview.mjs <out.jpg> <id1,id2,...>
 * Тайлы 550px, 2 колонки, подписи id. Имя файла — только ASCII.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [outName, idsArg] = process.argv.slice(2);
if (!outName || !idsArg) {
  console.error('Использование: node scripts/make-preview.mjs <download/ИМЯ.jpg> <id1,id2,...>');
  process.exit(1);
}
const DIR = 'public/dishes';
const ids = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
const TH = 550;
const COLS = 2;
const ROWS = Math.ceil(ids.length / COLS);

const comps = [];
for (let i = 0; i < ids.length; i++) {
  const src = path.join(DIR, `${ids[i]}.jpg`);
  if (!fs.existsSync(src)) {
    console.error(`НЕТ ФАЙЛА: ${src} — пропуск`);
    continue;
  }
  const buf = await sharp(src).resize(TH, TH, { fit: 'cover' }).toBuffer();
  const labeled = await sharp(buf)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${TH}" height="44"><rect width="${TH}" height="44" fill="black" opacity="0.75"/><text x="12" y="31" font-size="26" font-family="sans-serif" fill="white">${i + 1}. ${ids[i]}</text></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
  comps.push({ input: labeled, left: (i % COLS) * TH, top: Math.floor(i / COLS) * TH });
}

await sharp({
  create: { width: COLS * TH, height: ROWS * TH, channels: 3, background: '#222' },
})
  .composite(comps)
  .jpeg({ quality: 88 })
  .toFile(path.join('download', outName));

const stat = fs.statSync(path.join('download', outName));
console.log(`OK download/${outName}: ${comps.length} тайлов, ${(stat.size / 1024).toFixed(0)} KB`);
