// Тест бесплатного vision-провайдера Pollinations (без ключа, CORS открыт).
// POST https://text.pollinations.ai/openai — OpenAI-совместимый формат.
import fs from 'node:fs';

const payload = JSON.parse(fs.readFileSync('scripts/scan-test-payload.json', 'utf8'));
const t0 = Date.now();
try {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      referrer: 'skanrecept',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Перечисли ВСЕ съедобные продукты на фото. Ответ — СТРОГО валидный JSON без markdown: {"ingredients": [{"name": "сыр", "confidence": "high"}]}',
            },
            { type: 'image_url', image_url: { url: payload.image } },
          ],
        },
      ],
      max_tokens: 400,
    }),
  });
  console.log('status:', res.status, Date.now() - t0 + 'ms');
  const txt = await res.text();
  console.log('body:', txt.slice(0, 500));
} catch (e) {
  console.log('FAIL', Date.now() - t0 + 'ms', String(e).slice(0, 200));
}
