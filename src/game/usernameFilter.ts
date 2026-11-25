const TURKISH_LOWER_MAP: Record<string, string> = {
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

const HOMOGLYPH_AND_LEET_MAP: Record<string, string> = {
  // Cyrillic lookalikes
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  х: 'x',
  і: 'i',
  у: 'y',
  к: 'k',
  м: 'm',
  н: 'h',
  т: 't',
  // Greek lookalikes
  α: 'a',
  ε: 'e',
  ο: 'o',
  ρ: 'p',
  ι: 'i',
  // Common leetspeak / symbol substitutions
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '2': 'z',
  '9': 'g',
};

const INVISIBLE_AND_CONTROL_RE =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD]/g;

const HTML_OR_XSS_RE =
  /[<>]|<\/|javascript:|data:text\/html|onerror\s*=|onload\s*=|onclick\s*=|<script|\beval\s*\(/i;

/**
 * Exact Turkish validation message shown across registration, profile update, and backend checks.
 */
export const USERNAME_INAPPROPRIATE_ERROR =
  'Bu kullanıcı adı uygun değil. Lütfen farklı bir isim seç.';

// Substring-safe explicit stems (verified not to clash with common Turkish/football names like Besiktas, Klasik, Ramazan, Gotze, Samet)
const COMPACT_BANNED_STEMS: readonly string[] = [
  'amcik',
  'amk',
  'amq',
  'aminakoy',
  'amini',
  'ananisik',
  'bacini',
  'orospu',
  'orosbu',
  'orospo',
  'pezevenk',
  'yarrak',
  'yarrag',
  'dalyarak',
  'dalyarrak',
  'gotveren',
  'gotlek',
  'yavsak',
  'kahpe',
  'kaltak',
  'fahise',
  'surtuk',
  'siktir',
  'sikeyim',
  'sikerim',
  'sikim',
  'sikis',
  'sikik',
  'sikism',
  'sakso',
  'dassak',
  'tasak',
  'gavat',
  'ibne',
  'ibnelik',
  'kerhane',
  'tecavuz',
  'pedofil',
  'ensest',
  'otuzbir',
  'dildo',
  'masturb',
  'vajina',
  'penis',
  'sperm',
  'porno',
  'hentai',
  'fuck',
  'fck',
  'fuk',
  'shithead',
  'bullshit',
  'dipshit',
  'bitch',
  'cunt',
  'whore',
  'slut',
  'asshole',
  'jackass',
  'dumbass',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'motherfuck',
  'cocksuck',
  'dickhead',
  'incest',
  'pedophile',
  'rape',
  'nazi',
  'hitler',
  'zoophil',
];

// Short / ambiguous tokens matched strictly as standalone words (even across separator punctuation)
const WORD_ONLY_BANNED_TOKENS: readonly string[] = [
  'am',
  'aq',
  'mk',
  'mq',
  'oc',
  'sg',
  'sk',
  'sik',
  'got',
  'pic',
  'pich',
  'yarak',
  'bok',
  'dol',
  'sex',
  'porn',
  'xxx',
  'ass',
  'dick',
  'cock',
  'pussy',
  'cum',
  'fag',
  'hoe',
  'tit',
  'tits',
  'anal',
  'sj',
];

// Inappropriate "31" slang combinations without rejecting harmless numbers/dates like "1905", "2024", "Mehmet07", "Hatay31"
const INAPPROPRIATE_31_PATTERNS: readonly RegExp[] = [
  /^31+$/,
  /\b31\s*[._-]?\s*(?:ci|cu|ce|ceken|cek|sj|mal|salak|kral|amk|aq|oc|sik|porn|porno|otuzbir)/i,
  /(?:sj|cek|ceken|otuz|porno|porn|sex|amk|aq|oc|sik)\s*[._-]?\s*31\b/i,
  /31cek|31ci|31cu|31sj|sj31|x31x/i,
];

const RESERVED_SYSTEM_USERNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'mod',
  'system',
  'sistem',
  'destek',
  'support',
  'yetkili',
  'bot',
  'oyuncu',
  'rakipoyuncu',
  'futbolgurmesi',
]);

export interface UsernameNormalization {
  cleanedRaw: string;
  hasControlOrInvisible: boolean;
  hasHtmlOrScript: boolean;
  alnumNormalized: string;
  leetWords: string[];
  leetCompact: string;
  leetDedupedCompact: string;
  rawLowerCompact: string;
}

export function normalizeForProfanityCheck(raw: string): UsernameNormalization {
  const input = String(raw || '');
  const hasControlOrInvisible = INVISIBLE_AND_CONTROL_RE.test(input);
  INVISIBLE_AND_CONTROL_RE.lastIndex = 0;

  const strippedInvisible = input.replace(INVISIBLE_AND_CONTROL_RE, ' ');
  const hasHtmlOrScript = HTML_OR_XSS_RE.test(strippedInvisible);
  HTML_OR_XSS_RE.lastIndex = 0;

  const trimmed = strippedInvisible.replace(/\s+/g, ' ').trim();

  let lowerTurkish = '';
  for (const ch of trimmed) {
    lowerTurkish += TURKISH_LOWER_MAP[ch] ?? ch.toLowerCase();
  }
  const diacriticStripped = lowerTurkish.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  let leetConverted = '';
  for (const ch of diacriticStripped) {
    leetConverted += HOMOGLYPH_AND_LEET_MAP[ch] ?? ch;
  }

  const rawLowerCompact = diacriticStripped.replace(/[^a-z0-9]/g, '');
  const leetWords = leetConverted
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter(Boolean);
  const leetCompact = leetWords.join('');
  // Collapse 2+ repeated characters into 1 and 3+ repeated into 1 so "siiikiiim" / "ooorospu" is caught
  const leetDedupedCompact = leetCompact.replace(/(.)\1+/g, '$1');

  return {
    cleanedRaw: trimmed,
    hasControlOrInvisible,
    hasHtmlOrScript,
    alnumNormalized: diacriticStripped.replace(/[^a-z0-9_ ]/g, '').trim(),
    leetWords,
    leetCompact,
    leetDedupedCompact,
    rawLowerCompact,
  };
}

export function isUsernameProfane(rawName: string): boolean {
  const norm = normalizeForProfanityCheck(rawName);
  if (!norm.cleanedRaw) return false;
  if (norm.hasHtmlOrScript) return true;

  const compactCandidates = [norm.leetCompact, norm.leetDedupedCompact];
  for (const stem of COMPACT_BANNED_STEMS) {
    if (compactCandidates.some((c) => c.includes(stem))) {
      return true;
    }
  }

  const dedupedWords = norm.leetWords.map((w) => w.replace(/(.)\1+/g, '$1'));
  for (const token of WORD_ONLY_BANNED_TOKENS) {
    if (norm.leetWords.includes(token) || dedupedWords.includes(token)) {
      return true;
    }
  }

  // Catch letter-by-letter separated obfuscation like "o r o s p u", "a.m.k", "s i k"
  if (norm.leetWords.length >= 2 && norm.leetWords.every((w) => w.length <= 2)) {
    if (WORD_ONLY_BANNED_TOKENS.includes(norm.leetCompact)) {
      return true;
    }
  }

  // Check raw alphanumeric lower (preserving digits before leet) for "31" abuse patterns
  const spacedRawLower = norm.cleanedRaw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  for (const pattern of INAPPROPRIATE_31_PATTERNS) {
    if (pattern.test(spacedRawLower) || pattern.test(norm.rawLowerCompact)) {
      return true;
    }
  }

  return false;
}

export interface UsernameValidationOutput {
  ok: boolean;
  cleanedDisplay: string;
  error?: string;
}

const ALLOWED_DISPLAY_CHAR_RE = /^[a-zA-Z0-9çÇğĞıİöÖşŞüÜ _.-]+$/;

/**
 * Central username validator used across onboarding, profile edit, and backend APIs.
 * Preserves valid Turkish characters and harmless numbers while blocking profanity, leetspeak,
 * HTML/script payloads, control characters, and inappropriate numeric combinations.
 */
export function validateUsername(rawName: string): UsernameValidationOutput {
  const norm = normalizeForProfanityCheck(rawName);
  const cleanedDisplay = norm.cleanedRaw;

  if (!cleanedDisplay) {
    return {
      ok: false,
      cleanedDisplay: '',
      error: 'Kullanıcı adı boş bırakılamaz.',
    };
  }

  if (norm.hasControlOrInvisible || norm.hasHtmlOrScript) {
    return {
      ok: false,
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  if (cleanedDisplay.length < 3 || cleanedDisplay.length > 20) {
    return {
      ok: false,
      cleanedDisplay,
      error: 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.',
    };
  }

  if (!ALLOWED_DISPLAY_CHAR_RE.test(cleanedDisplay)) {
    return {
      ok: false,
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  const letterCount = (cleanedDisplay.match(/[a-zA-ZçÇğĞıİöÖşŞüÜ]/g) || []).length;
  if (letterCount < 2) {
    return {
      ok: false,
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  if (RESERVED_SYSTEM_USERNAMES.has(norm.rawLowerCompact)) {
    return {
      ok: false,
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  if (isUsernameProfane(cleanedDisplay)) {
    return {
      ok: false,
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  return {
    ok: true,
    cleanedDisplay,
  };
}

function stableFourDigitTag(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = (Math.abs(hash) % 9000) + 1000;
  return String(num);
}

/**
 * Returns true when an existing/legacy username violates current appropriateness rules
 * and must be hidden behind a neutral placeholder + prompted for rename.
 */
export function isLegacyFlaggedUsername(rawName: string | undefined | null): boolean {
  if (!rawName || !String(rawName).trim()) return true;
  const trimmed = String(rawName).trim();
  if (isUsernameProfane(trimmed)) return true;
  const norm = normalizeForProfanityCheck(trimmed);
  if (norm.hasHtmlOrScript || norm.hasControlOrInvisible) return true;
  return false;
}

/**
 * Sanitizes any username shown on public surfaces (League, Friend Lists, Room, Scoreboard, Result, Modal).
 * Does NOT delete user account or progress; replaces inappropriate legacy names dynamically with "Oyuncu #XXXX".
 */
export function sanitizePublicDisplayName(
  rawName: string | undefined | null,
  seedId?: string
): string {
  const cleaned = String(rawName || '').replace(/\s+/g, ' ').trim();
  if (!cleaned || isLegacyFlaggedUsername(cleaned)) {
    const tag = stableFourDigitTag(String(seedId || cleaned || 'futbol321'));
    return `Oyuncu #${tag}`;
  }
  return cleaned;
}
