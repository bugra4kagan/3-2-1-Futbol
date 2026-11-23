/**
 * Authoritative Server Time Anchor & Local Integrity Helpers.
 *
 * Uses Firebase Firestore `serverTimestamp()` offset calibration so device clock
 * tampering (changing phone date/time) cannot bypass 24h cooldowns.
 */

let serverOffsetMs = 0;
let hasServerCalibration = false;
let lastServerCalibrationAtLocalMs = 0;

export function calibrateServerTimeOffset(serverNowMs: number, localNowMs: number = Date.now()): void {
  if (!Number.isFinite(serverNowMs) || serverNowMs <= 0) return;
  serverOffsetMs = Math.round(serverNowMs - localNowMs);
  hasServerCalibration = true;
  lastServerCalibrationAtLocalMs = localNowMs;
}

export function getAuthoritativeServerNowMs(): number {
  return Date.now() + serverOffsetMs;
}

export function getAuthoritativeServerDate(): Date {
  return new Date(getAuthoritativeServerNowMs());
}

export function hasAuthoritativeServerClock(): boolean {
  return hasServerCalibration;
}

export function getServerClockStatus(): {
  calibrated: boolean;
  offsetMs: number;
  lastCalibratedAtLocalMs: number;
} {
  return {
    calibrated: hasServerCalibration,
    offsetMs: serverOffsetMs,
    lastCalibratedAtLocalMs: lastServerCalibrationAtLocalMs,
  };
}

/**
 * Deterministic lightweight integrity digest for detecting manual localStorage edits.
 */
export function computeProgressionDigest(payload: {
  userId: string;
  coins: number;
  weeklyPoints: number;
  totalPoints: number;
  unlockedGiftIds: string[];
  adFree?: boolean;
  permanentMultiplier2x?: boolean;
}): string {
  const canonical = [
    payload.userId || '',
    Math.max(0, Math.round(payload.coins || 0)),
    Math.max(0, Math.round(payload.weeklyPoints || 0)),
    Math.max(0, Math.round(payload.totalPoints || 0)),
    [...(payload.unlockedGiftIds || [])].sort().join(','),
    payload.adFree ? '1' : '0',
    payload.permanentMultiplier2x ? '1' : '0',
    '321_futbol_sec_v1',
  ].join('|');

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (code << 3) ^ i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}`;
}
