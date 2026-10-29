import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import {
  Barcode as BarcodeIcon,
  Camera,
  CameraOff,
  Check,
  CookingPot,
  Crown,
  ImagePlus,
  Infinity as InfinityIcon,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ScanBarcode,
  ScanLine,
  Sparkles,
  Store,
} from 'lucide-react';
import { FRIDGE_PRODUCTS, SCAN_POOL } from '../data/dishes';
import { emojiFor, matchDishes, type MatchResult } from '../lib/match';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

type Phase = 'idle' | 'scanning' | 'result' | 'paywall';
type ScanMode = 'products' | 'barcode';
type CamState = 'starting' | 'on' | 'denied';
/** Ступень зума как в системной камере: 1x / 2x / 3x */
type ZoomLevel = 1 | 2 | 3;
/** Уверенность распознавания: high — точно, medium — возможно */
type Confidence = 'high' | 'medium';
/** Продукт из распознавания: имя + уверенность + отметка пользователя */
interface ScanItem {
  name: string;
  confidence: Confidence;
  /** зелёные отмечены по умолчанию, жёлтые — нет */
  checked: boolean;
}
/** Причина неудачи распознавания: null — нет ошибки */
type ScanFail = null | 'generic' | 'noprovider';
type ProductState =
  | { kind: 'idle' }
  | { kind: 'loading'; code: string }
  | { kind: 'found'; code: string; product: BarcodeProduct }
  | { kind: 'notfound'; code: string }
  | { kind: 'error'; code: string };

interface BarcodeProduct {
  barcode: string;
  name: string;
  brands: string;
  image: string | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  ingredientsText: string;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

// --- Автоподбор самой широкой задней камеры ---
// Часть телефонов (в т.ч. realme и др.) по умолчанию включает телеобъектив
// или «склеенный» блок, у которого минимальный зум 2-2.5x: чип «1x» врёт,
// холодильник вблизи не снять. Перебираем задние камеры и ищем самую широкую.

/** Кеш самой широкой задней камеры — зондирование один раз за сессию */
const WIDE_CAM_KEY = 'skanrecept-wide-cam';

/** Мин зум трека или null, если зум не поддерживается */
function trackZoomMin(track: MediaStreamTrack | null | undefined): number | null {
  if (!track || typeof track.getCapabilities !== 'function') return null;
  try {
    const caps = track.getCapabilities() as unknown as { zoom?: { min?: number; max?: number } };
    if (caps.zoom && typeof caps.zoom.min === 'number') return caps.zoom.min;
  } catch {
    /* некоторые движки кидают на getCapabilities — считаем, что зума нет */
  }
  return null;
}

/** Быстро открыть камеру по id, узнать её минимальный зум и сразу закрыть */
async function probeZoomMin(deviceId: string, timeoutMs = 2500): Promise<number | null> {
  let stream: MediaStream | null = null;
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  const gump = navigator.mediaDevices
    .getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false })
    .then((s) => {
      stream = s;
      return s;
    });
  try {
    const s = await Promise.race([
      gump,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('probe timeout')), timeoutMs),
      ),
    ]);
    const track = s.getVideoTracks()[0] ?? null;
    // Страховка: вдруг попали на фронталку — её в подбор не берём
    if (track?.getSettings?.().facingMode === 'user') {
      stop();
      return null;
    }
    const min = trackZoomMin(track);
    stop();
    return min;
  } catch {
    // Таймаут: getUserMedia может разрешиться позже — гасим камеру тогда,
    // иначе на медленном телефоне она останется включённой
    void gump.then(stop).catch(stop);
    return null;
  }
}

/**
 * Перебираем «задние» камеры по подписи и ищем самую широкую (min zoom).
 * На десктопе (нет «задних» подписей) и iOS (нет getCapabilities) — no-op.
 */
async function findWidestBackCamera(
  currentDeviceId: string | null,
): Promise<{ deviceId: string; min: number } | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const isFront = (label: string) => /front|фронт|передн|user|face/i.test(label);
    const backs = devices
      .filter((d) => d.kind === 'videoinput' && d.label && !isFront(d.label))
      .slice(0, 6);
    if (backs.length === 0) return null;
    let best: { deviceId: string; min: number } | null = null;
    for (const d of backs) {
      if (currentDeviceId && d.deviceId === currentDeviceId) continue;
      const min = await probeZoomMin(d.deviceId);
      if (min !== null && min < (best?.min ?? Infinity)) best = { deviceId: d.deviceId, min };
      if (best && best.min <= 0.71) break; // ультраширик найден — хватит
    }
    return best;
  } catch {
    return null;
  }
}

/** Приводим распознанную строку к каноническому продукту справочника */
function mapToCanonical(raw: string): string {
  const n = raw.toLowerCase();
  for (const p of FRIDGE_PRODUCTS) {
    if (p.keys.some((k) => n.includes(k))) return p.name;
  }
  return raw;
}

/**
 * Снимок кадра видео в JPEG-датаURL с уменьшением до 1024px.
 * digitalZoom — цифровой зум (CSS fallback): кадр кропается по центру,
 * чтобы снимок совпадал с тем, что видит пользователь.
 */
function frameToDataUrl(video: HTMLVideoElement, digitalZoom: number): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const zoom = Math.max(1, digitalZoom);
  const sw = video.videoWidth / zoom;
  const sh = video.videoHeight / zoom;
  const sx = (video.videoWidth - sw) / 2;
  const sy = (video.videoHeight - sh) / 2;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Файл из галереи → уменьшенный JPEG-датаURL (с учётом EXIF-поворота) */
async function fileToDataUrl(file: File): Promise<string> {
  // createImageBitmap уважает EXIF-поворот — фото с телефона часто повёрнуты,
  // и без этого блюда распознаются «лёжа на боку»
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      /* фолбэк ниже — через Image */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode'));
    };
    img.src = url;
  });
}

export default function ScanScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const scansLeft = useAppStore((s) => s.userProfile.scansLeft);
  const performScan = useAppStore((s) => s.performScan);
  const addToPantry = useAppStore((s) => s.addToPantry);
  const addToShoppingList = useAppStore((s) => s.addToShoppingList);
  const pantry = useAppStore((s) => s.pantry);

  const [mode, setMode] = useState<ScanMode>('products');
  const [phase, setPhase] = useState<Phase>('idle');
  const [camState, setCamState] = useState<CamState>('starting');
  /** Распознанные продукты с уверенностью и отметками */
  const [items, setItems] = useState<ScanItem[]>([]);
  /** Имя продукта, который сейчас переименовывают */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [scanFailed, setScanFailed] = useState<ScanFail>(null);
  /** Детали ошибки от сервера (например, «на фото не найдено продуктов») */
  const [scanDetail, setScanDetail] = useState<string | null>(null);
  /** Реальный аспект потока камеры — видоискатель подстраивается, ничего не обрезая */
  const [streamAR, setStreamAR] = useState<number | null>(null);

  // --- штрих-код ---
  const [productState, setProductState] = useState<ProductState>({ kind: 'idle' });
  const [manualCode, setManualCode] = useState('');
  const [productInList, setProductInList] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zxingRef = useRef<IScannerControls | null>(null);
  /** Последний снимок — для кнопки «Повторить» после ошибки */
  const lastShotRef = useRef<string | null>(null);

  // --- зум камеры ---
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);
  /** Цифровой зум (CSS scale) — только когда нативный track.zoom недоступен */
  const [cssZoom, setCssZoom] = useState(1);
  const cssZoomRef = useRef(1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nativeZoomRef = useRef<{ min: number; max: number } | null>(null);
  /** Зум потока при старте = честная 1x в единицах устройства (калибровка) */
  const baseZoomRef = useRef(1);

  /** Переключение зума: нативный зум объектива, иначе CSS-кроп.
   *  Цели считаем от базовой точки — зума только что открытого потока
   *  (он равен родному полю зрения камеры в ЛЮБЫХ единицах: у ряда телефонов
   *  min диапазона — не 1x, из-за чего чип «1x» оказывался реальными 2-2.5x). */
  const applyZoom = async (level: ZoomLevel) => {
    setZoomLevel(level);
    const caps = nativeZoomRef.current;
    const track = trackRef.current;
    if (caps && track) {
      const target = Math.min(caps.max, Math.max(caps.min, baseZoomRef.current * level));
      try {
        await track.applyConstraints(
          { advanced: [{ zoom: target }] } as unknown as MediaTrackConstraints,
        );
        cssZoomRef.current = 1;
        setCssZoom(1);
        return;
      } catch {
        /* нативный зум не применился — уходим в цифровой */
      }
    }
    cssZoomRef.current = level;
    setCssZoom(level);
  };

  // ================= Камера (продукты) =================
  useEffect(() => {
    if (mode !== 'products') return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    /** Подключить поток и дождаться метаданных, вернуть реальную ориентацию кадра */
    const attach = async (s: MediaStream): Promise<'portrait' | 'landscape'> => {
      const video = videoRef.current;
      if (!video) return 'landscape';
      video.srcObject = s;
      await video.play().catch(() => undefined);
      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 3000);
          video.addEventListener(
            'loadedmetadata',
            () => {
              window.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
      return video.videoWidth > 0 && video.videoWidth / video.videoHeight > 1.05
        ? 'landscape'
        : 'portrait';
    };

    setCamState('starting');
    (async () => {
      /** Базовые видео-констрейнты: без жёсткого aspectRatio — принудительный 3:4
       *  заставляет часть HAL кропировать сенсор (ложный «зум 2-2.5x»). */
      const VIDEO_BASE: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      const VIDEO_PORTRAIT: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 1280 },
      };
      /** Открыть поток, опционально на конкретной камере */
      const openWith = async (deviceId?: string | null) => {
        const video: MediaTrackConstraints = deviceId
          ? { ...VIDEO_BASE, deviceId: { exact: deviceId } }
          : { ...VIDEO_BASE };
        return navigator.mediaDevices.getUserMedia({ video, audio: false });
      };
      /** Перезапуск в портрете, не теряя выбранную камеру */
      const restartPortrait = async (deviceId?: string | null) => {
        const video: MediaTrackConstraints = deviceId
          ? { ...VIDEO_PORTRAIT, deviceId: { exact: deviceId } }
          : { ...VIDEO_PORTRAIT };
        return navigator.mediaDevices.getUserMedia({ video, audio: false });
      };

      try {
        // Быстрый путь: в прошлый раз уже нашли самую широкую заднюю камеру
        let cachedWide: string | null = null;
        try {
          cachedWide = sessionStorage.getItem(WIDE_CAM_KEY);
        } catch {
          /* нет доступа к хранилищу */
        }
        if (cachedWide) {
          try {
            stream = await openWith(cachedWide);
          } catch {
            try {
              sessionStorage.removeItem(WIDE_CAM_KEY);
            } catch {
              /* не критично */
            }
            stream = null;
          }
        }
        if (!stream) {
          stream = await openWith();
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const deviceIdOf = (s: MediaStream | null): string | null => {
          const id = s?.getVideoTracks()[0]?.getSettings?.().deviceId;
          return typeof id === 'string' && id ? id : null;
        };
        let activeDeviceId = deviceIdOf(stream);

        // Альбомный кадр в портретном видоискателе = скрытый кроп-зум —
        // перезапускаем поток явно портретными размерами (камеру сохраняем)
        let orientation = await attach(stream);
        if (orientation === 'landscape') {
          stream.getTracks().forEach((t) => t.stop());
          stream = await restartPortrait(activeDeviceId);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          activeDeviceId = deviceIdOf(stream);
          orientation = await attach(stream);
          if (orientation === 'landscape') {
            // Телефон отдаёт только ландшафт — принимаем: видоискатель object-contain,
            // покажет весь кадр без обрезки, так что «1x» остаётся честным 1x
            console.info('[scan] камера отдаёт ландшафтный поток, показываем весь кадр');
          }
        }

        // Подбор самой широкой камеры: если у текущей min зум заметно больше 1 —
        // вероятно, попали на телеобъектив. Ищем шире и переключаемся.
        let track = stream.getVideoTracks()[0] ?? null;
        const currentMin = trackZoomMin(track);
        if (currentMin !== null && currentMin > 1.05) {
          const wider = await findWidestBackCamera(activeDeviceId);
          if (wider && wider.min < currentMin) {
            try {
              sessionStorage.setItem(WIDE_CAM_KEY, wider.deviceId);
            } catch {
              /* нет доступа к хранилищу — просто будем искать каждый раз */
            }
            stream.getTracks().forEach((t) => t.stop());
            if (cancelled) return;
            stream = await openWith(wider.deviceId);
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            activeDeviceId = deviceIdOf(stream);
            orientation = await attach(stream);
            if (orientation === 'landscape') {
              stream.getTracks().forEach((t) => t.stop());
              try {
                stream = await restartPortrait(activeDeviceId);
                if (cancelled) {
                  stream.getTracks().forEach((t) => t.stop());
                  return;
                }
                await attach(stream);
              } catch {
                /* не вышло — оставляем как есть, снимок всё равно кропается под превью */
              }
            }
            track = stream.getVideoTracks()[0] ?? null;
          }
        }

        const video = videoRef.current;
        setStreamAR(
          video && video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 3 / 4,
        );

        // Калибровка зума: запоминаем диапазон нативного зума и ТОЧКУ ОТСЧЁТА —
        // текущий зум свежего потока (getSettings().zoom), а не min диапазона.
        trackRef.current = track;
        nativeZoomRef.current = null;
        baseZoomRef.current = 1;
        if (track) {
          if (typeof track.getCapabilities === 'function') {
            const caps = track.getCapabilities() as unknown as {
              zoom?: { min?: number; max?: number };
            };
            if (
              caps.zoom &&
              typeof caps.zoom.min === 'number' &&
              typeof caps.zoom.max === 'number' &&
              caps.zoom.max > caps.zoom.min
            ) {
              nativeZoomRef.current = { min: caps.zoom.min, max: caps.zoom.max };
            }
          }
          const settings = track.getSettings() as unknown as { zoom?: number };
          if (typeof settings.zoom === 'number' && settings.zoom > 0) {
            // Свежий поток уже находится в своей честной 1x — фиксируем её как базу
            baseZoomRef.current = settings.zoom;
          } else if (nativeZoomRef.current) {
            // Единицы не рассказывают, где 1x, — берём min: хуже не станет,
            // потому что принудительный сброс зума мы больше не делаем
            baseZoomRef.current = nativeZoomRef.current.min;
          }
        }

        setCamState('on');
      } catch {
        if (!cancelled) setCamState('denied');
      }
    })();

    return () => {
      cancelled = true;
      trackRef.current = null;
      nativeZoomRef.current = null;
      baseZoomRef.current = 1;
      cssZoomRef.current = 1;
      setZoomLevel(1);
      setCssZoom(1);
      setStreamAR(null);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  // ================= Сканер штрих-кода =================
  useEffect(() => {
    if (mode !== 'barcode') return;
    let cancelled = false;

    setCamState('starting');
    (async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelled) {
              void handleBarcode(result.getText());
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingRef.current = controls;
        setCamState('on');
      } catch {
        if (!cancelled) setCamState('denied');
      }
    })();

    return () => {
      cancelled = true;
      zxingRef.current?.stop();
      zxingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** Пересчитать подборку рецептов из отмеченных продуктов + запасов */
  const recomputeMatch = (list: ScanItem[]) => {
    const checked = list.filter((i) => i.checked).map((i) => i.name);
    setMatch(checked.length > 0 ? matchDishes([...checked, ...pantry]) : null);
  };

  // ================= Распознавание фото =================
  const runRecognition = async (dataUrl: string) => {
    const result = performScan();
    if (result === 'limit') {
      setPhase('paywall');
      return;
    }

    setPhase('scanning');
    setScanFailed(null);
    setScanDetail(null);
    setIsDemo(false);
    lastShotRef.current = dataUrl;
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (r.status === 501) {
        // на сервере не настроен vision-провайдер — честно предлагаем демо
        setPhase('idle');
        setScanFailed('noprovider');
        return;
      }
      if (!r.ok) {
        // достаём детали ошибки сервера, чтобы показать пользователю причину
        let detail = '';
        try {
          const j = (await r.json()) as { detail?: unknown; error?: unknown };
          if (j.error === 'no_ingredients') detail = 'на фото не удалось найти продукты';
          else if (typeof j.detail === 'string') detail = j.detail.slice(0, 160);
        } catch {
          /* тела нет — обойдёмся без деталей */
        }
        throw new Error(detail || `scan api ${r.status}`);
      }
      const data = (await r.json()) as {
        ingredients?: string[];
        products?: Array<{ name: string; confidence?: string }>;
      };
      // продукты с уверенностью; если сервер вернул старый формат (строки) — считаем их точными
      const raw: Array<{ name: string; confidence?: string }> =
        data.products ?? (data.ingredients ?? []).map((name) => ({ name }));
      const byName = new Map<string, Confidence>();
      for (const p of raw) {
        const name = mapToCanonical(String(p.name ?? '')).trim();
        if (name.length < 2) continue;
        const conf: Confidence = p.confidence === 'medium' || p.confidence === 'low' ? 'medium' : 'high';
        byName.set(name, byName.get(name) === 'high' ? 'high' : conf);
      }
      if (byName.size === 0) throw new Error('на фото не удалось найти продукты');

      const list: ScanItem[] = [...byName.entries()].map(([name, confidence]) => ({
        name,
        confidence,
        // зелёные отмечены сразу, жёлтые ждут ручной проверки
        checked: confidence === 'high',
      }));
      setItems(list);
      recomputeMatch(list);
      setSavedToPantry(false);
      setAddedNames([]);
      setRenaming(null);
      setPhase('result');
    } catch (err) {
      setPhase('idle');
      setScanFailed('generic');
      setScanDetail(err instanceof Error ? err.message.slice(0, 160) : null);
    }
  };

  const capture = () => {
    const dataUrl = videoRef.current
      ? frameToDataUrl(videoRef.current, cssZoomRef.current)
      : null;
    if (!dataUrl) return;
    void runRecognition(dataUrl);
  };

  const onFilePicked = (file: File | undefined | null) => {
    if (!file) return;
    fileToDataUrl(file)
      .then((dataUrl) => runRecognition(dataUrl))
      .catch(() => {
        setScanFailed('generic');
        setScanDetail('не удалось прочитать выбранное фото');
      });
  };

  /** Демо-скан: фолбэк без списания скана */
  const demoScan = () => {
    const detected = pickRandom(SCAN_POOL, 5 + Math.floor(Math.random() * 3));
    // имитируем реальную уверенность модели: часть продуктов «под вопросом»
    const list: ScanItem[] = detected.map((name, i) => ({
      name,
      confidence: i < detected.length - 2 ? 'high' : 'medium',
      checked: i < detected.length - 2,
    }));
    setItems(list);
    recomputeMatch(list);
    setSavedToPantry(false);
    setAddedNames([]);
    setIsDemo(true);
    setScanFailed(null);
    setScanDetail(null);
    setPhase('result');
  };

  // ================= Штрих-код =================
  /** Прямой запрос в Open Food Facts из браузера — фолбэк, когда /api недоступен (статический хостинг) */
  const fetchOffDirect = async (code: string): Promise<BarcodeProduct | null> => {
    const fields =
      'product_name,product_name_ru,brands,image_front_small_url,image_url,' +
      'nutriments,ingredients_text,ingredients_text_ru';
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`,
    );
    const data = await r.json();
    if (data?.status !== 1) return null;
    const p = data.product;
    const name: string = (p.product_name_ru || p.product_name || '').trim();
    if (!name) return null;
    const n = p.nutriments ?? {};
    const toNum = (v: unknown): number | null => {
      const x = typeof v === 'string' ? Number.parseFloat(v) : (v as number);
      return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
    };
    let kcal = toNum(n['energy-kcal_100g']);
    if (kcal === null && n['energy_100g'] !== undefined) {
      const kj = toNum(n['energy_100g']);
      if (kj !== null) kcal = Math.round((kj / 4.184) * 10) / 10;
    }
    return {
      barcode: code,
      name,
      brands: (p.brands || '').split(',').map((s: string) => s.trim()).filter(Boolean)[0] ?? '',
      image: p.image_front_small_url || p.image_url || null,
      kcal,
      protein: toNum(n.proteins_100g),
      fat: toNum(n.fat_100g),
      carbs: toNum(n.carbohydrates_100g),
      ingredientsText: (p.ingredients_text_ru || p.ingredients_text || '').trim(),
    };
  };

  const handleBarcode = async (code: string) => {
    if (productState.kind === 'loading') return;
    zxingRef.current?.stop();
    setProductState({ kind: 'loading', code });
    setProductInList(false);
    try {
      const r = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = (await r.json()) as
        | { found: true; product: BarcodeProduct }
        | { found: false }
        | { error: string };
      if ('found' in data && data.found) {
        setProductState({ kind: 'found', code, product: data.product });
      } else if ('found' in data) {
        setProductState({ kind: 'notfound', code });
      } else {
        // сервер вернул ошибку — пробуем напрямую из браузера
        const direct = await fetchOffDirect(code).catch(() => null);
        setProductState(
          direct ? { kind: 'found', code, product: direct } : { kind: 'error', code },
        );
      }
    } catch {
      // например, статический хостинг без /api — Open Food Facts отвечает и из браузера (CORS разрешён)
      const direct = await fetchOffDirect(code).catch(() => null);
      setProductState(
        direct ? { kind: 'found', code, product: direct } : { kind: 'error', code },
      );
    }
  };

  const submitManualCode = () => {
    const code = manualCode.trim();
    if (!/^\d{8,14}$/.test(code)) return;
    void handleBarcode(code);
  };

  /** «Найти рецепты» для найденного товара */
  const findRecipesForProduct = (product: BarcodeProduct) => {
    const list: ScanItem[] = [
      { name: mapToCanonical(product.name), confidence: 'high', checked: true },
    ];
    setItems(list);
    recomputeMatch(list);
    setIsDemo(false);
    setSavedToPantry(false);
    setAddedNames([]);
    setRenaming(null);
    setPhase('result');
  };

  /** В запасы уходят только отмеченные продукты */
  const saveToPantry = () => {
    const checked = items.filter((i) => i.checked).map((i) => i.name);
    if (checked.length === 0) return;
    addToPantry(checked);
    setSavedToPantry(true);
  };

  /** Отметить/снять продукт — подборка рецептов пересчитывается сразу */
  const toggleItem = (name: string) => {
    const next = items.map((i) => (i.name === name ? { ...i, checked: !i.checked } : i));
    setItems(next);
    recomputeMatch(next);
    setSavedToPantry(false);
  };

  const renameStart = (name: string) => {
    setRenaming(name);
    setRenameDraft(name);
  };

  /** Заменить название (например, «возможно сыр» → «брынза») */
  const renameCommit = () => {
    const oldName = renaming;
    setRenaming(null);
    if (!oldName) return;
    const newName = mapToCanonical(renameDraft.trim());
    if (!newName || newName === oldName) return;
    const old = items.find((i) => i.name === oldName);
    const existing = items.find((i) => i.name === newName);
    let next: ScanItem[];
    if (old && existing) {
      // переименование в уже существующий продукт — объединяем их
      next = items
        .filter((i) => i.name !== oldName && i.name !== newName)
        .concat([
          {
            name: newName,
            confidence:
              existing.confidence === 'high' || old.confidence === 'high' ? 'high' : 'medium',
            checked: existing.checked || old.checked,
          },
        ]);
    } else {
      next = items.map((i) => (i.name === oldName ? { ...i, name: newName } : i));
    }
    setItems(next);
    recomputeMatch(next);
    setSavedToPantry(false);
  };

  const addMissing = (ingredient: string) => {
    addToShoppingList([{ name: ingredient }]);
    setAddedNames((prev) => [...prev, ingredient]);
  };

  const activateTestPro = () => {
    useAppStore.getState().togglePro();
    setPhase('idle');
  };

  const resetResult = () => {
    setPhase('idle');
    setScanFailed(null);
    setScanDetail(null);
    setRenaming(null);
  };

  const productBusy = productState.kind === 'loading';
  const product = productState.kind === 'found' ? productState.product : null;

  const headerHint = useMemo(() => {
    if (isPro) return 'PRO: безлимитные сканы';
    return `Лайт: осталось ${scansLeft} из 5 сканов`;
  }, [isPro, scansLeft]);

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Сканирование</h1>
          <p className="text-xs text-ink-2">{headerHint}</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro/10 text-pro-ink' : 'bg-soft text-ink-2',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO' : 'Лайт'}
        </span>
      </header>

      {/* ---------- Переключатель режимов ---------- */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
        <button
          type="button"
          onClick={() => {
            setMode('products');
            setPhase('idle');
          }}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors',
            mode === 'products' ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
          )}
        >
          <ScanLine size={16} />
          Продукты
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('barcode');
            setPhase('idle');
          }}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors',
            mode === 'barcode' ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
          )}
        >
          <ScanBarcode size={16} />
          Штрих-код
        </button>
      </div>

      {phase === 'paywall' ? (
        /* ---------- Paywall: сканы Лайта закончились ---------- */
        <div className="rounded-3xl border border-line bg-card p-6 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Lock size={26} />
          </span>
          <h2 className="text-lg font-bold text-ink">Сканы закончились</h2>
          <p className="mt-1 mb-4 text-sm text-ink-2">
            Ты использовал все 5 сканов Лайт-версии. Переключись на PRO, чтобы продолжить.
          </p>
          <ul className="mb-5 space-y-2 text-left">
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <InfinityIcon size={16} className="shrink-0 text-accent" />
              Безлимитные сканирования продуктов
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <Sparkles size={16} className="shrink-0 text-accent" />
              КБЖУ и порции до 12 без ограничений
            </li>
          </ul>
          <button
            type="button"
            onClick={activateTestPro}
            className="w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
          >
            Включить PRO (тестовый режим)
          </button>
          <p className="mt-2 text-[11px] text-ink-3">Или переключи тумблер «Режим PRO» в профиле</p>
        </div>
      ) : mode === 'products' ? (
        <>
          {/* ================= РЕЖИМ: ПРОДУКТЫ ================= */}
          {phase === 'result' ? (
            <ScanResult
              items={items}
              isDemo={isDemo}
              match={match}
              savedToPantry={savedToPantry}
              addedNames={addedNames}
              renaming={renaming}
              renameDraft={renameDraft}
              emojiFor={emojiFor}
              onToggle={toggleItem}
              onRenameStart={renameStart}
              onRenameDraft={setRenameDraft}
              onRenameCommit={renameCommit}
              onSavePantry={saveToPantry}
              onAddMissing={addMissing}
              onReset={resetResult}
            />
          ) : (
            <>
              <div
                className={cn(
                  'relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-3xl',
                  camState === 'on'
                    ? 'bg-stone-900'
                    : 'aspect-[3/4] border-2 border-dashed border-accent/40 bg-card',
                )}
                // Видоискатель повторяет аспект потока: виден ВЕСЬ кадр,
                // поэтому «1x» — честный угол обзора без скрытого кропа
                style={
                  camState === 'on' && streamAR
                    ? { aspectRatio: String(streamAR), maxHeight: '58vh' }
                    : undefined
                }
              >
                {/* Живое видео: contain — ничего не обрезаем (CSS-цифровой зум, если нативный недоступен) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    transform: `scale(${cssZoom})`,
                    transition: 'transform 250ms ease',
                  }}
                  className={cn(
                    'absolute inset-0 h-full w-full object-contain',
                    camState === 'on' ? 'block' : 'hidden',
                  )}
                />

                {/* Ступени зума как в системной камере */}
                {camState === 'on' && phase !== 'scanning' && (
                  <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
                    {([1, 2, 3] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => void applyZoom(level)}
                        aria-label={`Зум ${level}x`}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors',
                          zoomLevel === level
                            ? 'bg-white text-stone-900'
                            : 'text-white/85 hover:text-white',
                        )}
                      >
                        {level}×
                      </button>
                    ))}
                  </div>
                )}

                {/* Панель съёмки внутри видоискателя — затвор всегда виден */}
                {camState === 'on' && phase !== 'scanning' && (
                  <div className="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center gap-6">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Загрузить фото из галереи"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                    >
                      <ImagePlus size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={capture}
                      aria-label="Сделать снимок"
                      className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white/90 bg-white/10 transition-transform active:scale-90 disabled:opacity-60"
                    >
                      <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-black/30">
                        <Camera size={26} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={demoScan}
                      className="flex h-12 items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                    >
                      <RefreshCw size={14} />
                      Демо
                    </button>
                  </div>
                )}

                {/* Рамка видоискателя */}
                {camState === 'on' && phase !== 'scanning' && (
                  <>
                    <span className="pointer-events-none absolute top-6 left-6 h-10 w-10 rounded-tl-2xl border-t-2 border-l-2 border-white/80" />
                    <span className="pointer-events-none absolute top-6 right-6 h-10 w-10 rounded-tr-2xl border-t-2 border-r-2 border-white/80" />
                    <span className="pointer-events-none absolute bottom-6 left-6 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-white/80" />
                    <span className="pointer-events-none absolute bottom-6 right-6 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-white/80" />
                    <p className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      Наведи на продукты или холодильник
                    </p>
                  </>
                )}

                {/* Оверлей обработки */}
                {phase === 'scanning' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/70 backdrop-blur-sm">
                    <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-on-accent">
                      <ScanLine size={30} />
                    </span>
                    <p className="text-sm font-medium text-white">Распознаём продукты…</p>
                    <p className="max-w-[70%] text-center text-xs text-white/70">
                      Снимок уходит на сервер и приходит обратно списком продуктов
                    </p>
                  </div>
                )}

                {/* Нет камеры / стартуем */}
                {camState !== 'on' && phase !== 'scanning' && (
                  <div className="flex flex-col items-center gap-3 px-8 text-center">
                    <span
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full',
                        camState === 'denied' ? 'bg-soft text-ink-3' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {camState === 'denied' ? <CameraOff size={28} /> : <Camera size={28} />}
                    </span>
                    {camState === 'denied' ? (
                      <>
                        <p className="text-sm font-semibold text-ink">Нет доступа к камере</p>
                        <p className="text-xs text-ink-2">
                          Разреши доступ в настройках браузера или загрузи фото из галереи
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-ink-2">Запускаем камеру…</p>
                        <p className="text-xs text-ink-3">
                          Наведись на содержимое холодильника и делай снимок
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {camState !== 'on' && (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={phase === 'scanning'}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
                  >
                    <ImagePlus size={17} />
                    Загрузить фото из галереи
                  </button>
                  <button
                    type="button"
                    onClick={demoScan}
                    disabled={phase === 'scanning'}
                    className="w-full rounded-2xl border border-line bg-card py-3 text-sm font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
                  >
                    Демо-скан (без списания)
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onFilePicked(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {scanFailed && (
                <div className="mt-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-center">
                  <p className="text-xs font-medium text-accent-ink">
                    {scanFailed === 'noprovider'
                      ? 'Распознавание по фото на сервере не настроено. Попробуй демо-скан или штрих-код.'
                      : 'Не получилось распознать фото. Попробуй ещё раз при другом освещении.'}
                  </p>
                  {scanFailed === 'generic' && scanDetail && (
                    <p className="mt-1 text-[11px] text-accent-ink/80">Причина: {scanDetail}</p>
                  )}
                  {scanFailed === 'generic' && lastShotRef.current && (
                    <button
                      type="button"
                      onClick={() => void runRecognition(lastShotRef.current as string)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong"
                    >
                      <RefreshCw size={13} />
                      Повторить
                    </button>
                  )}
                </div>
              )}

              <p className="mt-3 text-center text-[11px] text-ink-3">
                Снимок обрабатывается на сервере и не сохраняется
              </p>
            </>
          )}
        </>
      ) : (
        <>
          {/* ================= РЕЖИМ: ШТРИХ-КОД ================= */}
          {phase === 'result' ? (
            <ScanResult
              items={items}
              isDemo={false}
              match={match}
              savedToPantry={savedToPantry}
              addedNames={addedNames}
              renaming={renaming}
              renameDraft={renameDraft}
              emojiFor={emojiFor}
              onToggle={toggleItem}
              onRenameStart={renameStart}
              onRenameDraft={setRenameDraft}
              onRenameCommit={renameCommit}
              onSavePantry={saveToPantry}
              onAddMissing={addMissing}
              onReset={resetResult}
            />
          ) : product ? (
            /* ---------- Карточка найденного товара ---------- */
            <div className="rounded-3xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-soft">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package size={34} className="text-ink-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base leading-snug font-bold text-ink">{product.name}</h2>
                  {product.brands && (
                    <p className="mt-0.5 text-xs text-ink-2">{product.brands}</p>
                  )}
                  <p className="mt-1 text-[11px] text-ink-3">Код: {product.barcode}</p>
                </div>
              </div>

              {/* КБЖУ на 100 г */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: 'ккал', value: product.kcal },
                  { label: 'белки', value: product.protein, unit: 'г' },
                  { label: 'жиры', value: product.fat, unit: 'г' },
                  { label: 'углев.', value: product.carbs, unit: 'г' },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-xl bg-soft px-2 py-2.5 text-center">
                    <p className="text-sm font-bold text-ink">
                      {tile.value === null ? '—' : tile.value}
                      {tile.value !== null && tile.unit ? (
                        <span className="ml-0.5 text-[10px] font-normal text-ink-3">{tile.unit}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-3">{tile.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-right text-[10px] text-ink-3">на 100 г продукта</p>

              {product.ingredientsText && (
                <p className="mt-3 line-clamp-3 rounded-xl bg-soft/60 px-3 py-2 text-[11px] leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink-2">Состав: </span>
                  {product.ingredientsText}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => findRecipesForProduct(product)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
                >
                  <CookingPot size={16} />
                  Найти рецепты с этим продуктом
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      addToShoppingList([{ name: product.name }]);
                      setProductInList(true);
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-colors',
                      productInList ? 'bg-good/10 text-good' : 'bg-soft text-ink-2 hover:text-ink',
                    )}
                  >
                    {productInList ? <Check size={13} strokeWidth={3} /> : <Plus size={13} />}
                    {productInList ? 'В списке покупок' : 'В список покупок'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProductState({ kind: 'idle' });
                      setManualCode('');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-soft py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
                  >
                    <RefreshCw size={13} />
                    Сканировать другой
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl',
                  camState === 'on' ? 'bg-stone-900' : 'border-2 border-dashed border-accent/40 bg-card',
                )}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover',
                    camState === 'on' ? 'block' : 'hidden',
                  )}
                />

                {/* Линия-прицел */}
                {camState === 'on' && (
                  <>
                    <div className="pointer-events-none absolute top-1/2 left-[12%] right-[12%] h-0.5 -translate-y-1/2 overflow-hidden rounded-full">
                      <div className="barcode-laser h-full w-full bg-accent" />
                    </div>
                    <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      Наведи на штрих-код упаковки
                    </p>
                  </>
                )}

                {camState !== 'on' && (
                  <div className="flex flex-col items-center gap-3 px-8 text-center">
                    <span
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full',
                        camState === 'denied' ? 'bg-soft text-ink-3' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {camState === 'denied' ? <CameraOff size={28} /> : <BarcodeIcon size={28} />}
                    </span>
                    {camState === 'denied' ? (
                      <>
                        <p className="text-sm font-semibold text-ink">Нет доступа к камере</p>
                        <p className="text-xs text-ink-2">
                          Введи цифры штрих-кода вручную ниже
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-ink-2">Запускаем сканер…</p>
                        <p className="text-xs text-ink-3">Наведись на код на упаковке товара</p>
                      </>
                    )}
                  </div>
                )}

                {productBusy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/70 backdrop-blur-sm">
                    <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-on-accent">
                      <BarcodeIcon size={30} />
                    </span>
                    <p className="text-sm font-medium text-white">Ищем товар в базе…</p>
                  </div>
                )}
              </div>

              {/* Результаты поиска по коду */}
              {productState.kind === 'notfound' && (
                <div className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-center">
                  <p className="text-xs font-semibold text-ink">Товар не найден в базе</p>
                  <p className="mt-0.5 text-[11px] text-ink-2">
                    Код {productState.code} нет в открытой базе продуктов. Попробуй другой код.
                  </p>
                </div>
              )}
              {productState.kind === 'error' && (
                <div className="mt-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-center">
                  <p className="text-xs font-medium text-accent-ink">
                    Сервис штрих-кодов недоступен. Проверь интернет и попробуй снова.
                  </p>
                </div>
              )}

              {/* Ручной ввод кода */}
              <div className="mt-4 rounded-3xl border border-line bg-card p-4 shadow-sm">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <ScanBarcode size={14} className="text-accent" />
                  Или введи код вручную
                </p>
                <div className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
                    onKeyDown={(e) => e.key === 'Enter' && submitManualCode()}
                    inputMode="numeric"
                    placeholder="Например 3017620422003"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-app px-3.5 py-2.5 text-sm tracking-wider text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitManualCode}
                    disabled={productBusy || !/^\d{8,14}$/.test(manualCode.trim())}
                    className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
                  >
                    Найти
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-ink-3">
                  Данные товаров — открытая база Open Food Facts
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Результат скана: список продуктов с индикаторами уверенности + подбор рецептов
// ============================================================================

interface ScanResultProps {
  items: ScanItem[];
  isDemo: boolean;
  match: MatchResult | null;
  savedToPantry: boolean;
  addedNames: string[];
  renaming: string | null;
  renameDraft: string;
  emojiFor: (name: string) => string;
  onToggle: (name: string) => void;
  onRenameStart: (name: string) => void;
  onRenameDraft: (value: string) => void;
  onRenameCommit: () => void;
  onSavePantry: () => void;
  onAddMissing: (ingredient: string) => void;
  onReset: () => void;
}

function ScanResult({
  items,
  isDemo,
  match,
  savedToPantry,
  addedNames,
  renaming,
  renameDraft,
  emojiFor,
  onToggle,
  onRenameStart,
  onRenameDraft,
  onRenameCommit,
  onSavePantry,
  onAddMissing,
  onReset,
}: ScanResultProps) {
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <section>
      {/* Распознанные продукты — список с индикаторами уверенности */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {isDemo && <span className="mr-1.5 text-xs font-semibold text-ink-3">ДЕМО · </span>}
          Найдено: {items.length} {pluralRu(items.length, 'продукт', 'продукта', 'продуктов')}
        </h2>
        <button
          type="button"
          onClick={onSavePantry}
          disabled={checkedCount === 0}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50',
            savedToPantry ? 'bg-good/10 text-good' : 'bg-accent text-on-accent hover:bg-accent-strong',
          )}
        >
          {savedToPantry ? <Check size={12} strokeWidth={3} /> : <Store size={12} />}
          {savedToPantry
            ? 'В запасах'
            : `В запасы (${checkedCount})`}
        </button>
      </div>
      <p className="mb-2.5 text-xs text-ink-2">
        Отметь то, что действительно есть дома — отмеченное попадёт в запасы и в подборку
      </p>
      {/* Легенда цветов */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-soft/70 px-3.5 py-2 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
          зелёный — точно определили
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          жёлтый — возможно, проверь или замени
        </span>
      </div>

      <div className="mb-5 space-y-2">
        {items.map((item) => {
          const isRenaming = renaming === item.name;
          const isHigh = item.confidence === 'high';
          return (
            <div
              key={item.name}
              className={cn(
                'rounded-2xl border bg-card p-3 transition-colors',
                item.checked ? 'border-good/35' : 'border-line',
              )}
            >
              <div className="flex items-center gap-3">
                {/* Чекбокс: отмеченный продукт уйдёт в запасы */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={`Отметить «${item.name}»`}
                  onClick={() => onToggle(item.name)}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    item.checked ? 'border-good bg-good text-white' : 'border-line bg-soft text-transparent hover:border-ink-3',
                  )}
                >
                  <Check size={13} strokeWidth={3} />
                </button>
                {/* Индикатор уверенности */}
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    isHigh ? 'bg-good' : 'bg-amber-400',
                  )}
                  aria-hidden
                />
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => onRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onRenameCommit();
                      if (e.key === 'Escape') onRenameCommit();
                    }}
                    onBlur={onRenameCommit}
                    aria-label="Новое название продукта"
                    className="min-w-0 flex-1 rounded-lg border border-accent bg-app px-2.5 py-1.5 text-sm text-ink focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onRenameStart(item.name)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Проверить или заменить «${item.name}»`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <span aria-hidden className="text-base">
                        {emojiFor(item.name)}
                      </span>
                      <span className="truncate">{item.name}</span>
                      <Pencil size={11} className="shrink-0 text-ink-3" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[11px]',
                        isHigh ? 'text-good' : 'font-medium text-amber-600',
                      )}
                    >
                      {isHigh ? 'Точно распознано' : 'Возможно — проверь или замени вручную'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Можно приготовить прямо сейчас */}
      {match && match.canCook.length > 0 && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
            <CookingPot size={18} className="text-good" />
            Можно приготовить: {match.canCook.length}
            <span className="text-xs font-normal text-ink-3">с учётом запасов</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {match.canCook.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        </>
      )}

      {/* Добавь один продукт — и приготовь */}
      {match && match.missingGroups.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-base font-bold text-ink">Добавь один продукт</h2>
          <p className="mb-3 text-xs text-ink-2">
            Не хватает чего-то одного до новых рецептов — с учётом запасов шкафчика
          </p>
          <div className="space-y-2.5">
            {match.missingGroups.map((g) => {
              const added = addedNames.includes(g.ingredient);
              return (
                <div key={g.ingredient} className="rounded-2xl border border-line bg-card p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span aria-hidden className="text-lg">
                          {g.emoji}
                        </span>
                        Добавь: {g.ingredient}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-2">
                        и приготовь {g.dishes.length}{' '}
                        {pluralRu(g.dishes.length, 'блюдо', 'блюда', 'блюд')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddMissing(g.ingredient)}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                        added
                          ? 'bg-good/10 text-good'
                          : 'bg-accent text-on-accent hover:bg-accent-strong',
                      )}
                    >
                      {added ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                      {added ? 'В списке' : 'В список'}
                    </button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {g.dishes.slice(0, 4).map((d) => (
                      <Link
                        key={d.id}
                        to={`/dish/${d.id}`}
                        className="rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:text-accent"
                      >
                        {d.nameRu}
                      </Link>
                    ))}
                    {g.dishes.length > 4 && (
                      <span className="rounded-full px-2 py-1 text-[11px] text-ink-3">
                        +{g.dishes.length - 4} ещё
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Совсем ничего */}
      {match && match.canCook.length === 0 && match.missingGroups.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">
          Из этих продуктов пока нечего приготовить.
          <br />
          Попробуй отсканировать ещё раз или пополни запасы.
        </p>
      )}

      <div className="mt-4 flex justify-center gap-4">
        <Link to="/" className="text-xs font-medium text-ink-3 hover:text-ink-2">
          Вся база рецептов →
        </Link>
        <Link to="/pantry" className="text-xs font-medium text-ink-3 hover:text-ink-2">
          Мои запасы →
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <RefreshCw size={12} />
          Сканировать снова
        </button>
      </div>
    </section>
  );
}
