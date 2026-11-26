/**
 * Backend HTTP/WebSocket URL resolver ve Render Free cold-start (uyku modundan uyanma)
 * dayanıklılık katmanı. Sunucu uyku modundayken ilk isteklerde 15-45 sn gecikme veya
 * geçici 502/503 yanıtları gelebilir; bu yardımcı otomatik zaman aşımı + yeniden deneme sağlar.
 */

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

let lastPrewarmAt = 0;

export function getBackendBaseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const raw = env?.VITE_API_BASE_URL?.trim();
    if (raw) {
      return raw.replace(/\/+$/, '');
    }
  } catch {
    // Node/test ortamında import.meta.env bulunmayabilir
  }
  return '';
}

export function resolveBackendApiUrl(path: string, overrideBaseUrl?: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = (overrideBaseUrl ?? getBackendBaseUrl()).trim().replace(/\/+$/, '');
  return base ? `${base}${cleanPath}` : cleanPath;
}

export function resolveBackendWsUrl(path: string = '/ws', overrideBaseUrl?: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = (overrideBaseUrl ?? getBackendBaseUrl()).trim().replace(/\/+$/, '');
  if (base) {
    if (base.startsWith('https://')) {
      return `wss://${base.slice('https://'.length)}${cleanPath}`;
    }
    if (base.startsWith('http://')) {
      return `ws://${base.slice('http://'.length)}${cleanPath}`;
    }
    return `wss://${base}${cleanPath}`;
  }
  if (typeof window !== 'undefined' && window.location?.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${cleanPath}`;
  }
  return `ws://localhost:3000${cleanPath}`;
}

export interface BackendRetryOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  onWakeup?: (attempt: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBackendWithWakeupRetry(
  path: string,
  init: RequestInit = {},
  options: BackendRetryOptions = {}
): Promise<Response> {
  const fetcher = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) {
    throw new Error('Ağ bağlantısı kullanılamıyor.');
  }

  const url = /^https?:\/\//i.test(path) ? path : resolveBackendApiUrl(path, options.baseUrl);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 25000);
  const retries = Math.max(0, Math.min(4, options.retries ?? 2));
  const retryDelayMs = Math.max(50, options.retryDelayMs ?? 2000);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (init.signal?.aborted) {
      throw new Error('İstek iptal edildi.');
    }

    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    init.signal?.addEventListener('abort', onParentAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetcher(url, {
        ...init,
        signal: controller.signal,
      });

      if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt >= retries) {
        return response;
      }

      lastError = new Error(`Sunucu uyanıyor (HTTP ${response.status}).`);
    } catch (err) {
      if (init.signal?.aborted) {
        throw err;
      }
      lastError = err;
      if (attempt >= retries) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', onParentAbort);
    }

    options.onWakeup?.(attempt + 1);
    const delay = retryDelayMs * (attempt + 1);
    await sleep(delay);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Sunucuya bağlanılamadı. Lütfen tekrar dene.');
}

export function prewarmBackendHealthz(options: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  force?: boolean;
} = {}): void {
  const base = (options.baseUrl ?? getBackendBaseUrl()).trim();
  const isRemoteHost =
    typeof window !== 'undefined' &&
    Boolean(window.location?.origin) &&
    (window.location.origin.startsWith('capacitor://') ||
      window.location.host === 'localhost' ||
      window.location.host.endsWith('github.io'));

  if (!base && !isRemoteHost) {
    return;
  }
  const now = Date.now();
  if (!options.force && now - lastPrewarmAt < 120_000) {
    return;
  }
  lastPrewarmAt = now;

  void fetchBackendWithWakeupRetry(
    '/healthz',
    { method: 'GET' },
    {
      timeoutMs: 25000,
      retries: 1,
      retryDelayMs: 2000,
      fetchImpl: options.fetchImpl,
      baseUrl: options.baseUrl,
    }
  ).catch(() => {
    // Sessiz arka plan uyandırma; hata durumunda offline/Firestore akışı korunur
  });
}
