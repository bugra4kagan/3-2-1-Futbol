export const ROSTER_DATA_VERSION = '2026.11.26-v25k';

export const ROSTER_VERSION_MISMATCH_ERROR =
  'Rakibinle farklı oyun sürümleri kullanıyorsunuz. Çevrimiçi oynamak için oyunu güncelle.';

/**
 * Zorunlu güncelleme / Google Play yönlendirmesi, yeni sürüm mağazada
 * erişilebilir olana kadar kapalı kalır.
 */
export const AUTO_FORCE_UPDATE_ENABLED = false;

const ROSTER_VERSION_RE = /^[a-zA-Z0-9._-]{3,40}$/;

export function isValidRosterVersion(raw: unknown): raw is string {
  return typeof raw === 'string' && ROSTER_VERSION_RE.test(raw.trim());
}

export function normalizeRosterVersion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim();
  return ROSTER_VERSION_RE.test(clean) ? clean : null;
}

export function areRosterVersionsCompatible(a: unknown, b: unknown): boolean {
  const va = normalizeRosterVersion(a);
  const vb = normalizeRosterVersion(b);
  return va !== null && vb !== null && va === vb;
}
