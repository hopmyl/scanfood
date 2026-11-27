/**
 * Режим готовки на кухне (стратегия PRO 26.11):
 *  — крупный шрифт: шаг виден с расстояния вытянутой руки;
 *  — Wake Lock: экран не гаснет, пока готовишь (с фолбэком, если API нет);
 *  — таймеры прямо в шагах: «Варить 12 минут» → чип «▶ 12:00» с бипом;
 *  — финал: «Готово — съел» → запись в дневник + авто-вычитание из запасов.
 * Без внешних зависимостей: интервалы + WebAudio-бип.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import type { Dish } from '../data/dishes';
import { cn } from '../lib/utils';

/** «Варить 12 минут», «жарь по 2–3 минуты», «на 45 сек» → {sec: 720} */
function parseTimerSec(step: string): number | null {
  const m = /(\d{1,3})\s*[-–—]?\s*(\d{1,3})?\s*(мин|сек)/i.exec(step);
  if (!m) return null;
  const unit = m[3].toLowerCase();
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const max = Math.max(a, b);
  return unit.startsWith('мин') ? max * 60 : max;
}

const fmtClock = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Короткий тройной бип без внешних файлов (WebAudio) */
function beep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const t = ctx.currentTime + i * 0.45;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.36);
    }
    window.setTimeout(() => void ctx.close(), 1800);
  } catch {
    /* звук не критичен */
  }
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', fn: () => void) => void;
}

export default function CookMode({
  dish,
  onClose,
  onCooked,
}: {
  dish: Dish;
  onClose: () => void;
  /** Нажали «Готово — съел»: экран блюда запишет в дневник и вычтет запасы */
  onCooked: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);

  const step = dish.steps[stepIdx];
  const timerSec = parseTimerSec(step);

  // Экран не гаснет: Wake Lock + перезахват после возврата в приложение
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      try {
        const wl = (navigator as unknown as {
          wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> };
        }).wakeLock;
        if (!wl) return;
        const sentinel = await wl.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeRef.current = sentinel;
      } catch {
        /* нет поддержки или пользователь свернул — не критично */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeRef.current) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (wakeRef.current && !wakeRef.current.released) void wakeRef.current.release();
      wakeRef.current = null;
    };
  }, []);

  // Обратный отсчёт
  useEffect(() => {
    if (!running || left === null) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v === null) return null;
        if (v <= 1) {
          beep();
          setRunning(false);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, left === null]);

  // Сброс таймера при переходе к другому шагу
  useEffect(() => {
    setLeft(null);
    setRunning(false);
  }, [stepIdx]);

  const startTimer = () => {
    if (!timerSec) return;
    setLeft(timerSec);
    setRunning(true);
  };

  /** «Готово — съел»: экран блюда запишет в дневник и вычтет продукты из запасов */
  const finish = () => {
    onCooked();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app" role="dialog" aria-modal="true" aria-label="Режим готовки">
      {/* Шапка */}
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{dish.nameRu}</p>
          <p className="text-xs text-ink-2">
            Шаг {stepIdx + 1} из {dish.steps.length}
            {dish.timeMin !== undefined ? ` · ~${dish.timeMin} мин` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Выйти из режима готовки"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink-2 shadow-sm transition-colors hover:text-ink"
        >
          <X size={20} />
        </button>
      </header>

      {/* Прогресс */}
      <div className="mx-4 mb-3 flex gap-1" aria-hidden>
        {dish.steps.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < stepIdx ? 'bg-good' : i === stepIdx ? 'bg-accent' : 'bg-line',
            )}
          />
        ))}
      </div>

      {/* Шаг крупным шрифтом */}
      <div className="flex flex-1 flex-col justify-center px-6 pb-2">
        <p className="text-2xl leading-relaxed font-semibold text-ink">{step}</p>

        {/* Таймер из текста шага */}
        {timerSec !== null && (
          <div className="mt-6">
            {left === null ? (
              <button
                type="button"
                onClick={startTimer}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-bold text-on-accent shadow-lg shadow-accent/25 transition-colors hover:bg-accent-strong"
              >
                <Play size={18} className="fill-current" />
                Таймер {fmtClock(timerSec)}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'rounded-2xl px-6 py-3 text-3xl font-bold tabular-nums',
                    left === 0 ? 'bg-good text-white' : 'bg-card text-ink shadow-sm',
                  )}
                  aria-live="polite"
                >
                  {fmtClock(left)}
                </span>
                {left > 0 && (
                  <button
                    type="button"
                    onClick={() => setRunning((v) => !v)}
                    aria-label={running ? 'Пауза таймера' : 'Продолжить таймер'}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:text-accent"
                  >
                    {running ? <Pause size={20} /> : <Play size={20} className="fill-current" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLeft(null);
                    setRunning(false);
                  }}
                  className="rounded-full bg-soft px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
                >
                  Сбросить
                </button>
                {left === 0 && (
                  <span className="text-sm font-bold text-good" role="status">
                    Готово! 🔔
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Навигация и финал */}
      <footer className="px-4 pb-safe pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            aria-label="Предыдущий шаг"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-card text-ink transition-colors hover:bg-soft disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.min(dish.steps.length - 1, i + 1))}
            disabled={stepIdx === dish.steps.length - 1}
            className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-accent text-base font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            Следующий шаг
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          type="button"
          onClick={finish}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-good py-3.5 text-sm font-bold text-white shadow-lg shadow-good/25 transition-opacity hover:opacity-95"
        >
          Готово — съел
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-3">
          Экран не погаснет, пока открыта готовка · «Готово» запишет ужин в дневник и вычтет продукты из запасов
        </p>
      </footer>
    </div>
  );
}
