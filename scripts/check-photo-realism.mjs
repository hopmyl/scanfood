// Проверка фотореалистичности блюд через VLM (glm-4.5v).
// Для каждого public/dishes/<id>.jpg — оценка 1-10 + вердикт.
// Особое внимание: нарисованный пар/дым и восковой «пластиковый» глянец —
// главные признаки ИИ-фото (уроки аудита: круассан-пластилин, марморные томаты).
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
  'Ты — эксперт по компьютерному зрению и food-фотографии. Оцени это изображение блюда как рецензент: ' +
  'может ли это фото пройти за снимок, сделанный обычным человеком на телефон? ' +
  'Особо проверь типичные ИИ-артефакты: 1) нарисованный пар или дымок над блюдом (витиеватые белые завитки) — ' +
  'настоящий пар на фото почти не виден; 2) восковой или пластиковый глянец, пластилиновая или мраморная поверхность еды; ' +
  '3) неестественно идеальные одинаковые элементы; 4) странные текстуры хлеба, сыра, соуса. ' +
  'Нарисованный пар или восковая поверхность — максимум 4 балла. ' +
  'Ответь ТОЛЬКО JSON без markdown: ' +
  '{"score": 1-10, "kind": "photo|render|illustration|unclear", "steam": true/false, "note": "кратко по-русски, максимум 8 слов"}';

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
        steam: parsed.steam === true,
        note: String(parsed.note ?? ''),
      };
    } catch (err) {
      console.error(`[${id}] попытка ${attempt}: ${err.message}`);
      // 429 — квота закрыта: терпеливо ждём окно (как в генераторе фото)
      const isRate = String(err?.message).includes('429');
      if (attempt < 4) await new Promise((r) => setTimeout(r, isRate ? 70000 : 5000 * attempt));
    }
  }
  return { score: -1, kind: 'error', steam: false, note: 'ошибка проверки' };
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
      console.log(`[${done}/${ids.length}] ${id}: ${r.score} ${r.kind}${r.steam ? ' ПАР' : ''}`);
    }
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

  const bad = Object.entries(report)
    .filter(([, r]) => (r.score >= 0 && r.score < 6) || r.steam === true)
    .map(([id, r]) => `${id}(${r.score}${r.steam ? ',пар' : ''})`);
  console.log(`=== ИТОГ: проверено ${Object.keys(report).length}, на перегенерацию (<6 или пар): ${bad.length}`);
  if (bad.length) {
    console.log(bad.join(', '));
    fs.writeFileSync(
      'scripts/regen-shortlist.txt',
      bad.map((b) => b.replace(/\(.*\)$/, '')).join('\n'),
    );
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
