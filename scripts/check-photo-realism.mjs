// Проверка фотореалистичности блюд через VLM (glm-4.5v).
// Для каждого public/dishes/<id>.jpg — оценка 1-10 + вердикт.
// Результат инкрементально пишется в scripts/realism-report.json,
// повторный запуск пропускает уже проверенные (если нет --rerun).
// Запуск: node scripts/check-photo-realism.mjs [--rerun] [--only=id1,id2]
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/dishes';
const REPORT = 'scripts/realism-report.json';

const rerun = process.argv.includes('--rerun');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyIds = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const report = fs.existsSync(REPORT) && !rerun
  ? JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  : {};

const PROMPT =
  'Ты — эксперт по компьютерному зрению и food-фотографии. Оцени это изображение блюда. ' +
  'Строго реалистично ли фото (как будто снято на телефон обычным человеком) или это похоже на 3D-рендер, ' +
  'CGI, иллюстрацию, рисунок или искусственный глянец? Ответь ТОЛЬКО JSON без markdown: ' +
  '{"score": 1-10, "kind": "photo|render|illustration|unclear", "note": "кратко по-русски, максимум 8 слов"}';

async function checkOne(zai, id) {
  const file = path.join(OUT_DIR, `${id}.jpg`);
  const b64 = fs.readFileSync(file).toString('base64');
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await zai.chat.completions.createVision({
        model: 'glm-4.5v',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });
      const text = String(res?.choices?.[0]?.message?.content ?? '');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('нет JSON в ответе');
      const parsed = JSON.parse(m[0]);
      return {
        score: Number(parsed.score) || 0,
        kind: String(parsed.kind ?? 'unclear'),
        note: String(parsed.note ?? ''),
      };
    } catch (err) {
      console.error(`[${id}] попытка ${attempt}: ${err.message}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  return { score: -1, kind: 'error', note: 'ошибка проверки' };
}

async function main() {
  const zai = await ZAI.create();
  const ids = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => f.replace('.jpg', ''))
    .filter((id) => (onlyIds ? onlyIds.includes(id) : true))
    .filter((id) => rerun || onlyIds || !(id in report))
    .sort();

  console.log(`К проверке: ${ids.length}`);
  let done = 0;
  for (const id of ids) {
    const r = await checkOne(zai, id);
    report[id] = r;
    done++;
    if (done % 5 === 0 || done === ids.length) {
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
      console.log(`[${done}/${ids.length}] ${id}: ${r.score} ${r.kind}`);
    }
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

  const bad = Object.entries(report)
    .filter(([, r]) => r.score >= 0 && r.score < 6)
    .map(([id, r]) => `${id}(${r.score},${r.kind})`);
  console.log(`=== ИТОГ: проверено ${Object.keys(report).length}, плохих (<6): ${bad.length}`);
  if (bad.length) console.log(bad.join(', '));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
