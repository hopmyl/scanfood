// Разовая проба трёх каналов генерации/критики для алгоритма «Натурал v7».
// 1) z-ai картинка (текущий генератор)  2) Pollinations flux (бесплатный)
// 3) OpenRouter google/gemini-2.5-flash-image-preview (платный, проверка доступа)
// 4) z-ai критик glm-4.5v на готовом фото
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';

// Ключ читаем из scripts/.env (в .gitignore) — в коде его быть не должно
// (урок: GitHub push protection блокирует пуши с ключами).
let OR_KEY = process.env.OPENROUTER_API_KEY || '';
try {
  for (const line of fs.readFileSync('scripts/.env', 'utf8').split('\n')) {
    const m = line.match(/^OPENROUTER_API_KEY=(.*)$/);
    if (m) OR_KEY = m[1].trim();
  }
} catch {}

async function probeZaiImage() {
  try {
    const zai = await ZAI.create();
    const r = await zai.images.generations.create({
      prompt: 'real photograph of a homemade apple pie slice on a wooden table, natural window light',
      size: '1024x1024',
    });
    const b64 = r?.data?.[0]?.base64;
    console.log('ZAI_IMAGE: OK,', b64 ? Math.round(b64.length / 1024) + 'KB(b64)' : 'пусто');
    return !!b64;
  } catch (e) {
    console.log('ZAI_IMAGE: FAIL —', String(e.message).slice(0, 120));
    return false;
  }
}

async function probeFlux() {
  try {
    const prompt = encodeURIComponent(
      'real photograph of a homemade apple pie slice on a wooden table, natural window light, casual snapshot',
    );
    const t0 = Date.now();
    const r = await fetch(
      `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&model=flux&nologo=true&seed=${Date.now() % 100000}`,
      { signal: AbortSignal.timeout(150000) },
    );
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(
      `FLUX: HTTP ${r.status} ${ct.split(';')[0]}, ${Math.round(buf.length / 1024)}KB, ${Math.round((Date.now() - t0) / 1000)}s`,
    );
    if (r.status === 200 && ct.startsWith('image')) fs.writeFileSync('scripts/photo-tmp/probe-flux.jpg', buf);
    return r.status === 200 && ct.startsWith('image');
  } catch (e) {
    console.log('FLUX: FAIL —', String(e.message).slice(0, 120));
    return false;
  }
}

async function probeOrImage() {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: 'Generate a real photograph of a homemade apple pie slice on a wooden table, natural window light.',
          },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
    const j = await r.json().catch(() => ({}));
    const img = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    console.log(
      `OR_IMAGE: HTTP ${r.status}, ${j?.error ? 'error: ' + String(j.error.message).slice(0, 100) : img ? 'IMAGE OK ' + Math.round(img.length / 1024) + 'KB(b64)' : 'без картинки'}`,
    );
    return !!img;
  } catch (e) {
    console.log('OR_IMAGE: FAIL —', String(e.message).slice(0, 120));
    return false;
  }
}

async function probeCritic() {
  try {
    const zai = await ZAI.create();
    const b64 = fs.readFileSync('public/dishes/pelmeni.jpg').toString('base64');
    const res = await zai.chat.completions.createVision({
      model: 'glm-4.5v',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
            { type: 'text', text: 'Ответь одним словом: что на фото?' },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });
    console.log('CRITIC: OK —', String(res?.choices?.[0]?.message?.content ?? '').slice(0, 80));
    return true;
  } catch (e) {
    console.log('CRITIC: FAIL —', String(e.message).slice(0, 120));
    return false;
  }
}

const results = await Promise.all([probeFlux(), probeOrImage(), probeCritic()]);
const zaiOk = await probeZaiImage();
console.log('ИТОГ: flux=' + results[0] + ' or_image=' + results[1] + ' critic=' + results[2] + ' zai_image=' + zaiOk);
