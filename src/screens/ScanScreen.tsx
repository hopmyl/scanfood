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
/** Прочитать диапазон нативного зума трека (если камера его поддерживает) */
function zoomCapsOf(
  track: MediaStreamTrack | null | undefined,
): { min: number; max: number } | null {
  if (!track || typeof track.getCapabilities !== 'function') return null;
  const caps = track.getCapabilities() as unknown as {
    zoom?: { min?: number; max?: number };
  };
  if (
    caps.zoom &&
    typeof caps.zoom.min === 'number' &&
    typeof caps.zoom.max === 'number' &&
    caps.zoom.max > caps.zoom.min
  ) {
    return { min: caps.zoom.min, max: caps.zoom.max };
  }
  return null;
}

/**
 * Честные ступени зума: минимум объектива (у ультраширика это 0,6×!),
 * затем 2× и 3× — без дублей и ступеней выше максимума камеры.
 * Чип всегда показывает РЕАЛЬНЫЙ множитель, а не «1×» при фактических 2×.
 */
function zoomChipFactors(caps: { min: number; max: number } | null): number[] {
  if (!caps) return [1, 2, 3]; // нативный зум недоступен — цифровой CSS-зум
  const min = caps.min;
  // Часть Android-камер отдаёт зум в абсолютных единицах (100 = 1×):
  // min=100, max=400 — множители считаем делением на минимум.
  const steps = min >= 10 ? [1, 2, 3] : min < 1 ? [min, 1, 2, 3] : [min, 2, 3];
  const maxFactor = caps.max / (min >= 10 ? min : 1);
  const factors = steps.filter((f) => f <= maxFactor + 0.001);
  return [...new Set(factors.map((f) => Math.round(f * 10) / 10))].sort((a, b) => a - b);
}

/** Множитель «1×»/«2×» → значение зума в единицах конкретной камеры */
function zoomTarget(factor: number, caps: { min: number; max: number } | null): number | null {
  if (!caps) return null;
  const target = caps.min >= 10 ? caps.min * factor : factor;
  return Math.min(Math.max(target, caps.min), caps.max);
}

/** «0,6×» / «2×» — по-русски, с запятой */
function fmtZoom(f: number): string {
  return `${String(Math.round(f * 10) / 10).replace('.', ',')}×`;
}

/** Кеш самой широкой задней камеры — зондирование один раз за сессию */
const WIDE_CAM_KEY = 'skanrecept-wide-cam';

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
    const min = zoomCapsOf(track)?.min ?? null;
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
 * Часть телефонов отдаёт по умолчанию телеобъектив или склеенный блок,
 * у которого минимальный зум 2× — холодильник вблизи не снять.
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

/** Приводим распознанную строку к каноническому продукту справочника */
function mapToCanonical(raw: string): string {
  const n = raw.toLowerCase();
  for (const p of FRIDGE_PRODUCTS) {
    if (p.keys.some((k) => n.includes(k))) return p.name;
  }
  return raw;
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

/** Аспект видоискателя (портрет 3:4) — снимок вырезает ровно видимую область */
const VIEWFINDER_AR = 3 / 4;

/**
 * Снимок кадра видео в JPEG-датаURL — СТРОГО то, что видит пользователь:
 * сначала кроп под видоискатель 3:4 (object-cover), затем цифровой зум
 * (центральный кроп), затем уменьшение до 1024px. Без этого превью и
 * снимок расходились: пользователь наводил на продукты, а на сервер
 * уходил весь широкий кадр — продукты становились мелкими.
 */
function frameToDataUrl(video: HTMLVideoElement, digitalZoom: number): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const zoom = Math.max(1, digitalZoom);
  // 1) Кроп под видоискатель
  let sw = video.videoWidth;
  let sh = video.videoHeight;
  const streamAR = sw / sh;
  if (streamAR > VIEWFINDER_AR) {
    sw = sh * VIEWFINDER_AR; // альбомный поток — режем бока
  } else if (streamAR < VIEWFINDER_AR) {
    sh = sw / VIEWFINDER_AR; // более вертикальный поток — режем верх/низ
  }
  // 2) Цифровой зум — центральный кроп поверх видоискателя
  sw /= zoom;
  sh /= zoom;
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
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const drawAndResolve = (
      source: ImageBitmap | HTMLImageElement,
      w: number,
      h: number,
      cleanup: () => void,
    ) => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1024 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      cleanup();
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };

    // createImageBitmap({ imageOrientation: 'from-image' }) уважает EXIF —
    // фото с телефона не окажется вверх ногами на сервере
    const modern = () =>
      createImageBitmap(file, { imageOrientation: 'from-image' })
        .then((bmp) =>
          drawAndResolve(bmp, bmp.width, bmp.height, () => {
            bmp.close();
          }),
        )
        .catch(() => legacy());

    const legacy = () => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () =>
        drawAndResolve(img, img.width, img.height, () => URL.revokeObjectURL(url));
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image decode'));
      };
      img.src = url;
    };

    if (typeof createImageBitmap === 'function') modern();
    else legacy();
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
  const [products, setProducts] = useState<string[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [scanFailed, setScanFailed] = useState<ScanFail>(null);
  /** Техническая причина неудачи с сервера (видна мелким текстом под баннером) */
  const [scanDetail, setScanDetail] = useState('');
  /** Последний снимок — для кнопки «Повторить» */
  const lastShotRef = useRef<string | null>(null);

  // --- штрих-код ---
  const [productState, setProductState] = useState<ProductState>({ kind: 'idle' });
  const [manualCode, setManualCode] = useState('');
  const [productInList, setProductInList] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zxingRef = useRef<IScannerControls | null>(null);

  // --- зум камеры ---
  /** Активная ступень зума — реальный множитель (может быть 0,6 у ультраширика) */
  const [zoomFactor, setZoomFactor] = useState(1);
  /** Честные ступени: вычисляются из возможностей камеры после старта */
  const [zoomChips, setZoomChips] = useState<number[]>([1, 2, 3]);
  /** Цифровой зум (CSS scale) — только когда нативный track.zoom недоступен */
  const [cssZoom, setCssZoom] = useState(1);
  const cssZoomRef = useRef(1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nativeZoomRef = useRef<{ min: number; max: number } | null>(null);

  /** Переключение зума: нативный зум объектива по множителю, иначе CSS-кроп */
  const applyZoom = async (factor: number) => {
    setZoomFactor(factor);
    const caps = nativeZoomRef.current;
    const track = trackRef.current;
    if (caps && track) {
      const target = zoomTarget(factor, caps);
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
    cssZoomRef.current = factor;
    setCssZoom(factor);
  };

  // ================= Камера (продукты) =================
  useEffect(() => {
    if (mode !== 'products') return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    setCamState('starting');
    (async () => {
      const baseVideo: MediaTrackConstraints = {
        facingMode: 'environment',
        // Видоискатель портретный 3:4 — просим портретный поток. Раньше был
        // жёсткий 1280×720: object-cover срезал до ~40% ширины кадра, из-за
        // чего честная «1×» выглядела как 2×+ и холодильник не влезал в кадр.
        aspectRatio: { ideal: 0.75 },
        width: { ideal: 1080 },
        height: { ideal: 1440 },
      };

      // Камера вернула альбомный кадр — переспрашиваем явно портретными
      // размерами (часть браузеров не знает аспект, но умеет размеры)
      const cameLandscape = async (): Promise<boolean> => {
        const v = videoRef.current;
        if (!v || !v.videoWidth || !v.videoHeight) return false;
        return v.videoWidth / v.videoHeight > 1.05;
      };
      const restartPortrait = async () => {
        stream?.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      };

      // Быстрый путь: в прошлый раз уже нашли самую широкую заднюю камеру
      // (sessionStorage может кидать в приватном режиме — оборачиваем)
      let cachedWide: string | null = null;
      try {
        cachedWide = sessionStorage.getItem(WIDE_CAM_KEY);
      } catch {
        /* нет доступа к хранилищу */
      }
      if (cachedWide) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...baseVideo, deviceId: { exact: cachedWide } },
            audio: false,
          });
        } catch {
          sessionStorage.removeItem(WIDE_CAM_KEY);
          stream = null;
        }
      }

      try {
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: baseVideo,
            audio: false,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        // Альбомный кадр в портретном видоискателе = скрытый кроп-зум —
        // перезапускаем поток явно портретными размерами
        if (!cancelled && (await cameLandscape())) {
          try {
            await restartPortrait();
          } catch {
            /* не вышло — оставляем как есть, снимок всё равно кропается под превью */
          }
        }

        // Сброс дефолтного зума (часть телефонов стартует на телеобъективе)
        let track = stream.getVideoTracks()[0] ?? null;
        let caps = zoomCapsOf(track);

        // Камера по умолчанию умеет минимум 2× — ищем среди «задних» самую
        // широкую. Без этого «1×» на чипе врёт, и холодильник вблизи не снять.
        if (caps && caps.min > 1.05) {
          const currentId = track?.getSettings?.().deviceId ?? null;
          const wider = await findWidestBackCamera(currentId);
          if (wider && wider.min < caps.min) {
            try {
              sessionStorage.setItem(WIDE_CAM_KEY, wider.deviceId);
            } catch {
              /* нет доступа к хранилищу — просто будем искать каждый раз */
            }
            stream.getTracks().forEach((t) => t.stop());
            if (cancelled) return;
            stream = await navigator.mediaDevices.getUserMedia({
              video: { ...baseVideo, deviceId: { exact: wider.deviceId } },
              audio: false,
            });
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play().catch(() => undefined);
            }
            track = stream.getVideoTracks()[0] ?? null;
            caps = zoomCapsOf(track);
          }
        }

        trackRef.current = track;
        nativeZoomRef.current = caps;
        setZoomChips(zoomChipFactors(caps));

        // Стартуем с минимума объектива — это и есть настоящая «1×»
        if (caps && track) {
          try {
            await track.applyConstraints(
              { advanced: [{ zoom: caps.min }] } as unknown as MediaTrackConstraints,
            );
          } catch {
            /* игнорируем — остаётся цифровой зум */
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
      cssZoomRef.current = 1;
      setZoomFactor(1);
      setZoomChips([1, 2, 3]);
      setCssZoom(1);
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

  // ================= Распознавание фото =================
  const runRecognition = async (dataUrl: string) => {
    const result = performScan();
    if (result === 'limit') {
      setPhase('paywall');
      return;
    }

    setPhase('scanning');
    setScanFailed(null);
    setScanDetail('');
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
        // Достаём причину с сервера — без неё «не распозналось» не отладить
        let detail = '';
        try {
          const j = (await r.json()) as { detail?: string; error?: string };
          detail = (j.detail || j.error || '').slice(0, 160);
        } catch {
          /* тело не JSON */
        }
        throw new Error(detail || `scan api ${r.status}`);
      }
      const data = (await r.json()) as { ingredients: string[] };
      const canonical = dedupe(data.ingredients.map(mapToCanonical));
      if (canonical.length === 0) throw new Error('empty result');

      setProducts(canonical);
      setMatch(matchDishes([...canonical, ...pantry]));
      setSavedToPantry(false);
      setAddedNames([]);
      setPhase('result');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setScanDetail(msg.startsWith('scan api') ? '' : msg);
      setPhase('idle');
      setScanFailed('generic');
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
      .catch(() => setScanFailed('generic'));
  };

  /** Демо-скан: фолбэк без списания скана */
  const demoScan = () => {
    const detected = pickRandom(SCAN_POOL, 5 + Math.floor(Math.random() * 3));
    setProducts(detected);
    setMatch(matchDishes([...detected, ...pantry]));
    setSavedToPantry(false);
    setAddedNames([]);
    setIsDemo(true);
    setScanFailed(null);
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
    const canonical = dedupe([mapToCanonical(product.name)]);
    setProducts(canonical);
    setMatch(matchDishes([...canonical, ...pantry]));
    setIsDemo(false);
    setSavedToPantry(false);
    setAddedNames([]);
    setPhase('result');
  };

  const saveToPantry = () => {
    addToPantry(products);
    setSavedToPantry(true);
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
              products={products}
              isDemo={isDemo}
              match={match}
              savedToPantry={savedToPantry}
              addedNames={addedNames}
              emojiFor={emojiFor}
              onSavePantry={saveToPantry}
              onAddMissing={addMissing}
              onReset={resetResult}
            />
          ) : (
            <>
              <div
                className={cn(
                  'relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl',
                  camState === 'on' ? 'bg-stone-900' : 'border-2 border-dashed border-accent/40 bg-card',
                )}
              >
                {/* Живое видео (CSS-цифровой зум, если нативный недоступен) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    transform: `scale(${cssZoom})`,
                    transition: 'transform 250ms ease',
                  }}
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover',
                    camState === 'on' ? 'block' : 'hidden',
                  )}
                />

                {/* Ступени зума как в системной камере — честные множители,
                    минимальный = настоящий минимум объектива (может быть 0,6×) */}
                {camState === 'on' && phase !== 'scanning' && (
                  <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
                    {zoomChips.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => void applyZoom(f)}
                        aria-label={`Зум ${fmtZoom(f)}`}
                        className={cn(
                          'flex h-9 min-w-9 items-center justify-center rounded-full px-1.5 text-xs font-bold transition-colors',
                          zoomFactor === f
                            ? 'bg-white text-stone-900'
                            : 'text-white/85 hover:text-white',
                        )}
                      >
                        {fmtZoom(f)}
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
                  {scanDetail && (
                    <p className="mt-1 break-words text-[10px] leading-snug text-accent-ink/70">
                      Причина: {scanDetail}
                    </p>
                  )}
                  {scanFailed === 'generic' && lastShotRef.current && (
                    <button
                      type="button"
                      onClick={() => void runRecognition(lastShotRef.current as string)}
                      className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[11px] font-semibold text-on-accent transition-colors hover:bg-accent-strong"
                    >
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
              products={products}
              isDemo={false}
              match={match}
              savedToPantry={savedToPantry}
              addedNames={addedNames}
              emojiFor={emojiFor}
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
// Результат скана: чипсы продуктов + подбор рецептов
// ============================================================================

interface ScanResultProps {
  products: string[];
  isDemo: boolean;
  match: MatchResult | null;
  savedToPantry: boolean;
  addedNames: string[];
  emojiFor: (name: string) => string;
  onSavePantry: () => void;
  onAddMissing: (ingredient: string) => void;
  onReset: () => void;
}

function ScanResult({
  products,
  isDemo,
  match,
  savedToPantry,
  addedNames,
  emojiFor,
  onSavePantry,
  onAddMissing,
  onReset,
}: ScanResultProps) {
  return (
    <section>
      {/* Распознанные продукты */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">
          {isDemo && <span className="mr-1.5 text-xs font-semibold text-ink-3">ДЕМО · </span>}
          Распознано: {products.length} {pluralRu(products.length, 'продукт', 'продукта', 'продуктов')}
        </h2>
        <button
          type="button"
          onClick={onSavePantry}
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
            savedToPantry ? 'bg-good/10 text-good' : 'bg-soft text-ink-2 hover:text-ink',
          )}
        >
          {savedToPantry ? <Check size={12} strokeWidth={3} /> : <Store size={12} />}
          {savedToPantry ? 'В запасах' : 'В запасы'}
        </button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {products.map((p) => (
          <span
            key={p}
            className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink"
          >
            <span aria-hidden className="mr-1">
              {emojiFor(p)}
            </span>
            {p}
          </span>
        ))}
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
