# Деплой СканРецепт на Vercel (бесплатно)

## Что уже готово

- `api/scan.ts` и `api/barcode.ts` — serverless-функции Vercel. Они **самодостаточные**
  (без импортов из `../server/…`): Vercel собирает `api/*.ts` как ESM, а Node-ESM
  не разрешает импорты без расширения файла — из-за этого функция падает с
  FUNCTION_INVOCATION_FAILED. Логика продублирована из `server/scan-core.ts`.
- `server/scan-core.ts` — ядро для локальной разработки (`scan-api.ts`, Vite-плагин):
  поддерживает оба провайдера (gemini и zai).
- `api/ping.ts` — диагностический: `GET /api/ping` → `{ ok, node, hasGeminiKey }`.
- `vercel.json` — SPA-роутинг (React Router) + таймаут функций 60 с.

## Провайдеры распознавания (`server.mjs` и `api/scan.ts`)

Провайдер выбирается автоматически по наличию ключа (первый заданный побеждает):

| Приоритет | Переменные | Сервис | Доступность из РФ |
|---|---|---|---|
| 1 | `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` | Любой OpenAI-совместимый (Groq, HuggingFace router, VseGPT, ProxyAPI…) | зависит от сервиса |
| 2 | `OPENROUTER_API_KEY` (+ `OPENROUTER_MODEL`) | OpenRouter, модель по умолчанию `google/gemma-4-31b-it:free` | сайт/API открыт без VPN |
| 3 | `GEMINI_API_KEY` (+ `GEMINI_MODEL`) | Gemini, модель по умолчанию `gemini-3.5-flash-lite` | только ключ из-за рубежа |

Примеры универсального слота:

```
# Groq (бесплатно, llama-4-scout видит картинки):
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# HuggingFace Inference (бесплатные кредиты):
AI_BASE_URL=https://router.huggingface.co/v1
AI_API_KEY=hf_...
AI_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

Без ключей `/api/scan` отвечает `501 no_provider` — приложение показывает демо-режим.

Модель: по умолчанию `gemini-3.5-flash-lite` (без «размышлений», исторически самая
щедрая бесплатная квота). Важно: `gemini-2.0-flash` Google выключил 01.06.2026 —
гайды с ним больше не работают. Более свежую модель (например `gemini-3.8-flash`)
можно задать переменной `GEMINI_MODEL`.

Квоты бесплатного тарифа (RPM/RPD) Google регулярно меняет: у Flash-моделей бывало
и ~20, и ~250, и ~1500 сканов/день. Точные цифры своего проекта — в AI Studio →
«View active rate limits». Ориентир: даже 250 сканов/день хватает на ~50 пользователей
при лимите Лайт 5 сканов/день.

## Шаги деплоя

0. Если проект уже импортирован в Vercel — опубликовать новую версию просто:
   `git add -A && git commit -m "update" && git push` — Vercel сам пересоберёт и выкатит.
1. Запушь проект в GitHub-репозиторий.
2. Vercel → Add New Project → импортируй репозиторий. Framework Preset подхватится автоматически (Vite), менять ничего не надо.
3. Settings → Environment Variables — добавь:
   - `GEMINI_API_KEY` = твой ключ Google AI Studio
   - (опционально) `SCAN_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.5-flash-lite`
4. Deploy. Готово: PWA на `*.vercel.app`, сканы — на бесплатном Gemini, штрих-коды — бесплатный Open Food Facts.

## Проверка после деплоя

- `https://<твой-проект>.vercel.app/api/barcode?code=3017620422003` → JSON с Nutella.
- Скан фото в приложении → список продуктов.

## Нюансы бесплатного тарифа Gemini

- Квоты пересчитываются Google время от времени; при 429 скан вернёт ошибку — клиент показывает «Не получилось распознать», можно повторить.
- На бесплатном тарифе Google может использовать запросы для улучшения моделей (фото продуктов — не персональные данные).
- Для EEA/UK-пользователей условия бесплатного тарифа ограничены — если аудитория Европа, понадобится платный тариф Gemini или другой провайдер.
- Hobby-план Vercel формально для некоммерческих проектов; когда пойдут деньги — Pro $20/мес или Cloudflare Pages/VPS.

## Локальная разработка

Всё работает как раньше: `npm run dev` поднимает те же эндпоинты внутри Vite.
Чтобы локально проверить Gemini — добавь в `.env.local`:

```
SCAN_PROVIDER=gemini
GEMINI_API_KEY=твой-ключ
```
