// Агент-критик фото блюд (glm-4.5v) — ЕДИНАЯ рубрика для всего конвейера.
// Используется в двух местах:
//   1) generate-dish-photos.mjs — инлайн-контроль каждого СВЕЖЕГО кадра:
//      не прошёл критику => автореролл с другой сценой, берётся лучший из N.
//   2) check-photo-realism.mjs — периодический аудит уже готовых фото.
// Рубрика собрана из всех уроков аудитов 2026-10: рисованный пар (круассан),
// восковой «пластиковый» глянец (марморные томаты, спагетти-пластик),
// леттеринг («Fine Dining» на пельменях), кривые бокалы, дрейф блюда
// (сырники -> блины). Негативы в промпт ГЕНЕРАТОРА не возвращаем — тут
// критик наоборот обязан ЗАМЕТИТЬ эти дефекты, поэтому перечисляем их явно.
// Критик движко-независимый: z-ai, Gemini, локальный SD — подходит для любого.

// Проходной балл: >=7 и ни одного флага. Калибровался на 6 утверждённых
// v6-фото (см. scripts/qa-log.txt за 2026-10-31) — они дали 8-10.
export const PASS_SCORE = 7;
// Жёсткий брак: <6 или любой флаг => перегенерация + ручной список.
export const BAD_SCORE = 6;

export function isPass(qa) {
  return (
    qa &&
    qa.score >= PASS_SCORE &&
    !qa.steam &&
    !qa.plastic &&
    !qa.text &&
    !qa.people &&
    !qa.wrong
  );
}

export function isBad(qa) {
  return (
    !qa ||
    qa.score < 0 || // ошибка критика — пусть попадает в переаудит, не в брак
    qa.score < BAD_SCORE ||
    qa.steam ||
    qa.plastic ||
    qa.text ||
    qa.people ||
    qa.wrong
  );
}

export function flagsStr(qa) {
  if (!qa) return 'нет-критики';
  const f = [];
  if (qa.steam) f.push('пар');
  if (qa.plastic) f.push('пластик');
  if (qa.text) f.push('текст');
  if (qa.people) f.push('люди');
  if (qa.wrong) f.push('не-то-блюдо');
  return f.length ? f.join('+') : 'чисто';
}

export function criticPrompt(subject) {
  return (
    'Ты — строгий food-фотограф и эксперт по компьютерному зрению. Перед тобой фото блюда.\n' +
    'Ожидаемое блюдо (описание): «' +
    subject +
    '»\n' +
    'Проверь фото по всем пунктам и ответь ТОЛЬКО JSON без markdown:\n' +
    '{"score": 1-10, "steam": true/false, "plastic": true/false, "text": true/false, ' +
    '"people": true/false, "wrong": true/false, "note": "кратко по-русски, максимум 8 слов"}\n' +
    'Правила:\n' +
    '- score — выглядит ли кадр НАСТОЯЩИМ снимком на камеру, а не рендером: 9-10 неотличим от реального, ' +
    '7-8 реалистичен, 5-6 есть сомнения, 1-4 явно ИИ/рендер.\n' +
    '- steam=true, если над едой нарисован пар или дымок (витиеватые белые завитки, декоративный «дым») — ' +
    'настоящий пар на фото почти не виден. Нарисованный пар — score не выше 4.\n' +
    '- plastic=true, если еда выглядит восковой, пластиковой, пластилиновой, мраморной, ' +
    'глянцево-пластмассовой или с слишком однородной «нейронной» текстурой. Пластик — score не выше 4.\n' +
    '- text=true, если на фото есть читаемые буквы, надписи, леттеринг, водяные знаки, логотипы ' +
    '(нечитаемые размытые этикетки на заднем плане в сильном расфокусе — не считаются).\n' +
    '- people=true, если видны руки, пальцы, лица или любые части тела.\n' +
    '- wrong=true, если в кадре ДРУГАЯ ключевая еда, чем в описании: просили сырники — на фото блины, ' +
    'просили борщ — на фото коричневое рагу, просили пасту — на фото рис. ' +
    'ДРУГОЕ БЛЮДО, но та же еда — НЕ wrong: форма подачи (плоская тарелка вместо глубокой миски), ' +
    'наличие/отсутствие сметаны, масла, зелени, сахара, гарнира, цвет посуды, порция — всё это НЕ основание для wrong. ' +
    'Отличия сервировки при верной ключевой еде — вообще не снижают score.\n' +
    '- Будь строг к пластику и рисованным эффектам, но не придирайся к ракурсу и сервировке: ' +
    'лёгкая неидеальность домашней подачи — это нормально и даже хорошо.'
  );
}

// critiquePhoto(zai, imageBufferOrPath, subject) -> {score, steam, plastic, text, people, wrong, note, error?}
// Сетевые ретраи внутри: 429 -> ждём окно квоты 70с (как в генераторе), прочее -> 5с*попытка.
// Полный провал связи -> {score:-1, error:true}: генератор в этом случае fail-open
// (принимает кадр без критики), аудит просто перепроверит позже.
export async function critiquePhoto(zai, image, subject, { attempts = 4 } = {}) {
  let b64;
  if (Buffer.isBuffer(image)) b64 = image.toString('base64');
  else b64 = (await import('node:fs')).readFileSync(image).toString('base64');

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await zai.chat.completions.createVision({
        model: 'glm-4.5v',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
              { type: 'text', text: criticPrompt(subject) },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });
      const text = String(res?.choices?.[0]?.message?.content ?? '');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('нет JSON в ответе критика');
      const p = JSON.parse(m[0]);
      return {
        score: Number(p.score) || 0,
        steam: p.steam === true,
        plastic: p.plastic === true,
        text: p.text === true,
        people: p.people === true,
        wrong: p.wrong === true,
        note: String(p.note ?? '').slice(0, 80),
      };
    } catch (err) {
      const isRate = String(err?.message).includes('429');
      console.error(`  [критик] попытка ${attempt}: ${err.message}`);
      if (attempt < attempts)
        await new Promise((r) => setTimeout(r, isRate ? 70000 : 5000 * attempt));
    }
  }
  return { score: -1, steam: false, plastic: false, text: false, people: false, wrong: false, note: 'ошибка критика', error: true };
}
