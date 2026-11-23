const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  I: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

export const RESERVED_PLACEHOLDER_KEYS = new Set<string>([
  'futbol_gurmesi',
  'rakip_oyuncu',
  'misafir',
  'misafir_oyuncu',
  'oyuncu',
  'bot',
  'bot_ai',
]);

export function cleanDisplayName(rawName: string): string {
  return String(rawName || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeUsernameKey(rawName: string): string {
  const mapped = cleanDisplayName(rawName)
    .split('')
    .map((ch) => TURKISH_CHAR_MAP[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return mapped
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export interface UsernameValidationResult {
  ok: boolean;
  reason?: string;
  cleanedDisplay: string;
  key: string;
}

export function validateUsernameFormat(rawName: string): UsernameValidationResult {
  const cleanedDisplay = cleanDisplayName(rawName);
  const key = normalizeUsernameKey(cleanedDisplay);

  if (cleanedDisplay.length < 3) {
    return {
      ok: false,
      reason: 'Kullanıcı adı en az 3 karakter olmalıdır.',
      cleanedDisplay,
      key,
    };
  }
  if (cleanedDisplay.length > 18) {
    return {
      ok: false,
      reason: 'Kullanıcı adı en fazla 18 karakter olabilir.',
      cleanedDisplay,
      key,
    };
  }
  const alnumOnly = key.replace(/_/g, '');
  if (alnumOnly.length < 2 || key.length < 3) {
    return {
      ok: false,
      reason: 'Kullanıcı adı en az 2 harf veya rakam içermelidir.',
      cleanedDisplay,
      key,
    };
  }
  if (RESERVED_PLACEHOLDER_KEYS.has(key)) {
    return {
      ok: false,
      reason: 'Varsayılan isimler kullanılamaz. Lütfen sana özel bir ad seç!',
      cleanedDisplay,
      key,
    };
  }

  return { ok: true, cleanedDisplay, key };
}

export function generateUniqueUsernameSuggestions(
  baseName: string,
  takenKeys: Set<string>,
  count = 3
): string[] {
  const cleaned = cleanDisplayName(baseName).replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ _-]/g, '');
  const root = cleaned.length >= 2 ? cleaned.slice(0, 12).trim() : 'Kaptan';
  const suffixes = ['10', '99', 'TR', '1905', '1907', '1903', 'GS', 'FB', 'BJK', 'PRO', '77', '23'];
  const results: string[] = [];
  const used = new Set<string>(takenKeys);

  for (const suffix of suffixes) {
    if (results.length >= count) break;
    const candidate = `${root}_${suffix}`.slice(0, 18);
    const k = normalizeUsernameKey(candidate);
    if (k.length >= 3 && !used.has(k) && !RESERVED_PLACEHOLDER_KEYS.has(k)) {
      used.add(k);
      results.push(candidate);
    }
  }

  let guard = 0;
  while (results.length < count && guard < 40) {
    guard++;
    const num = Math.floor(100 + Math.random() * 899);
    const candidate = `${root.slice(0, 13)}_${num}`;
    const k = normalizeUsernameKey(candidate);
    if (k.length >= 3 && !used.has(k) && !RESERVED_PLACEHOLDER_KEYS.has(k)) {
      used.add(k);
      results.push(candidate);
    }
  }

  return results;
}

const STARTER_PREFIXES = [
  'Maestro',
  'KralForvet',
  'SahaHakimi',
  'GolMakinesi',
  'OrtaSaha',
  'KartalPençe',
  'AslanYürek',
  'FırtınaKanat',
  'AltınAyak',
  'DerbiKralı',
];

export function generateRandomUniqueStarterName(takenKeys: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const prefix = STARTER_PREFIXES[i % STARTER_PREFIXES.length];
    const num = Math.floor(100 + Math.random() * 899);
    const candidate = `${prefix}_${num}`.slice(0, 18);
    const key = normalizeUsernameKey(candidate);
    if (!takenKeys.has(key) && !RESERVED_PLACEHOLDER_KEYS.has(key)) {
      return candidate;
    }
  }
  return `Yıldız_${Date.now().toString().slice(-5)}`;
}

const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  const part = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += RECOVERY_CHARS.charAt(Math.floor(Math.random() * RECOVERY_CHARS.length));
    }
    return s;
  };
  return `321-${part()}-${part()}`;
}

export function normalizeRecoveryCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}
