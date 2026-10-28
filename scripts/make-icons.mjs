// Генерация PWA-иконок СканРецепт из SVG (sharp)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#EA580C"/>
  <g stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="M20 26v-4a2 2 0 0 1 2-2h4"/>
    <path d="M38 20h4a2 2 0 0 1 2 2v4"/>
    <path d="M44 38v4a2 2 0 0 1-2 2h-4"/>
    <path d="M26 44h-4a2 2 0 0 1-2-2v-4"/>
  </g>
  <circle cx="32" cy="32" r="6" fill="#FFFFFF"/>
</svg>`;

// maskable: полный квадрат без скруглений + большие поля для безопасной зоны
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#EA580C"/>
  <g stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" fill="none" transform="translate(6.4 6.4) scale(0.8)">
    <path d="M20 26v-4a2 2 0 0 1 2-2h4"/>
    <path d="M38 20h4a2 2 0 0 1 2 2v4"/>
    <path d="M44 38v4a2 2 0 0 1-2 2h-4"/>
    <path d="M26 44h-4a2 2 0 0 1-2-2v-4"/>
  </g>
  <circle cx="32" cy="32" r="4.8" fill="#FFFFFF"/>
</svg>`;

await mkdir('public/icons', { recursive: true });

await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile('public/icons/maskable-512.png');

console.log('icons done');
