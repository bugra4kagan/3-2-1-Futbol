export type TelemetrySeverity = 'info' | 'warning' | 'error';

export interface TelemetryEntry {
  id: string;
  ts: number;
  type: 'event' | 'crash';
  name: string;
  severity: TelemetrySeverity;
  message?: string;
  context?: Record<string, string | number | boolean>;
}

const TELEMETRY_STORAGE_KEY = '321_telemetry_log';
const MAX_TELEMETRY_ENTRIES = 50;

let telemetryInitialized = false;

export function getTelemetryLog(): TelemetryEntry[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendTelemetryEntry(entry: TelemetryEntry): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    const prev = getTelemetryLog();
    const next = [entry, ...prev].slice(0, MAX_TELEMETRY_ENTRIES);
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or private mode issues
  }
}

export function clearTelemetryLog(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(TELEMETRY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function logTelemetryEvent(
  name: string,
  context?: Record<string, string | number | boolean>,
  severity: TelemetrySeverity = 'info'
): void {
  const entry: TelemetryEntry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    type: 'event',
    name: name.slice(0, 80),
    severity,
    context,
  };
  appendTelemetryEntry(entry);
}

export function captureError(
  error: unknown,
  context?: Record<string, string | number | boolean>
): void {
  const msg =
    error instanceof Error
      ? `${error.name}: ${error.message}`.slice(0, 320)
      : String(error).slice(0, 320);

  const entry: TelemetryEntry = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    type: 'crash',
    name: 'unhandled_error',
    severity: 'error',
    message: msg,
    context,
  };
  appendTelemetryEntry(entry);
  if (typeof console !== 'undefined') {
    console.error('[3-2-1 Futbol Telemetry]', msg, context || '');
  }
}

export function initTelemetry(): void {
  if (telemetryInitialized || typeof window === 'undefined') return;
  telemetryInitialized = true;

  window.addEventListener('error', (event) => {
    captureError(event.error || event.message || 'Window error', {
      source: String(event.filename || '').slice(-80),
      line: Number(event.lineno || 0),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason || 'Unhandled Promise Rejection', {
      kind: 'unhandledrejection',
    });
  });
}
