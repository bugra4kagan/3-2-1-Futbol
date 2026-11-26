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
  в: 'b',
  // Greek lookalikes
  α: 'a',
  β: 'b',
  ε: 'e',
  ο: 'o',
  ρ: 'p',
  ι: 'i',
  κ: 'k',
  τ: 't',
  ν: 'n',
  υ: 'u',
  χ: 'x',
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
  '6': 'g',
};

const INVISIBLE_AND_CONTROL_RE =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u034F\u115F\u1160\u17B4\u17B5\u3164\uFFA0]/g;

const HTML_OR_XSS_RE =
  /[<>]|<\/|javascript:|data:text\/html|onerror\s*=|onload\s*=|onclick\s*=|<script|\beval\s*\(/i;

/**
 * Exact standardized Turkish messages shown across profile creation, editing, and backend verification.
 * Never reveals which rule, word, or token triggered moderation.
 */
export const USERNAME_INAPPROPRIATE_ERROR =
  'Bu kullanıcı adı uygunsuz ifadeler içeriyor. Lütfen farklı bir isim seç.';
export const USERNAME_TAKEN_ERROR =
  'Bu kullanıcı adı başka bir oyuncu tarafından kullanılıyor.';
export const USERNAME_SYSTEM_RESERVED_ERROR =
  'Bu kullanıcı adı oyun yönetimine ayrılmıştır.';
export const USERNAME_UNSUPPORTED_CHAR_ERROR =
  'Kullanıcı adında desteklenmeyen karakterler bulunuyor.';
export const USERNAME_UNVERIFIED_ERROR =
  'Kullanıcı adı şu anda doğrulanamadı. Lütfen tekrar dene.';
export const USERNAME_AVAILABLE_MESSAGE = 'Bu kullanıcı adı kullanılabilir.';

export type UsernameValidationErrorCode =
  | 'empty'
  | 'inappropriate'
  | 'reserved_system'
  | 'reserved_placeholder'
  | 'unsupported_chars'
  | 'length'
  | 'too_few_letters'
  | 'taken'
  | 'unverified';

// Substring-safe explicit stems (verified not to clash with benign names such as
// Besiktasli, Galatasarayli, Fenerbahceli, Trabzonsporlu, Kasimpasali, Ramazan, Gotze, Samet, ModricFan)
const COMPACT_BANNED_STEMS: readonly string[] = [
  'amcik',
  'amk',
  'amq',
  'aminakoy',
  'aminasik',
  'aminasok',
  'ananisik',
  'ananisk',
  'bacini',
  'sulaleni',
  'avradini',
  'ecdadini',
  'ebeni',
  'orospu',
  'orosbu',
  'orospo',
  'pezevenk',
  'pzvnk',
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
  'sktir',
  'sktr',
  'sikeyim',
  'sikerim',
  'skrm',
  'skyim',
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
  'serefsiz',
  'haysiyetsiz',
  'namussuz',
  'gerizekal',
  'sapik',
  'itoglu',
  'kopekoglu',
  'gebert',
  'geberir',
  'oldurecem',
  'oldureyim',
  'oldururum',
  'katliam',
  'katled',
  'terorist',
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
  'tranny',
  'chink',
  'kike',
  'spic',
  'wetback',
  'motherfuck',
  'cocksuck',
  'dickhead',
  'incest',
  'pedophile',
  'rape',
  'rapist',
  'nazi',
  'hitler',
  'zoophil',
  'killself',
  'killyourself',
];

// Short / ambiguous tokens matched strictly as standalone words (including digit-stripped chunks like pic99)
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
  'gotu',
  'gotun',
  'gotunu',
  'pic',
  'pich',
  'yarak',
  'bok',
  'dol',
  'mal',
  'salak',
  'aptal',
  'ahmak',
  'alcak',
  'ezik',
  'geber',
  'oldur',
  'pkk',
  'isid',
  'daes',
  'feto',
  'zenci',
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
  'shit',
  'slut',
  'sj',
  'kys',
  'kkk',
  'paki',
];

// Inappropriate "31" slang combinations without rejecting harmless numbers/dates like "1905", "2024", "Mehmet07", "Hatay31"
const INAPPROPRIATE_31_PATTERNS: readonly RegExp[] = [
  /^31+$/,
  /\b31\s*[._-]?\s*(?:ci|cu|ce|ceken|cek|sj|mal|salak|kral|amk|aq|oc|sik|porn|porno|otuzbir)/i,
  /(?:sj|cek|ceken|otuz|porno|porn|sex|amk|aq|oc|sik)\s*[._-]?\s*31\b/i,
  /31cek|31ci|31cu|31sj|sj31|x31x/i,
];

// Exact normalized keys reserved for official staff, roles, or system entities
const RESERVED_SYSTEM_EXACT_KEYS = new Set([
  'admin',
  'administrator',
  'superadmin',
  'sysadmin',
  'yonetici',
  'moderator',
  'mod',
  'system',
  'sistem',
  'destek',
  'support',
  'yetkili',
  'official',
  'resmi',
  'developer',
  'gelistirici',
  'owner',
  'kurucu',
  'gamemaster',
  'gm',
  'staff',
  'ekip',
  'bot',
  'futbol321',
  '321futbol',
]);

// Standalone role words (so "Mod_Ali" or "Bot_TR" are blocked while "ModricFan" stays allowed)
const RESERVED_SYSTEM_WORD_TOKENS = new Set([
  'admin',
  'administrator',
  'superadmin',
  'sysadmin',
  'yonetici',
  'moderator',
  'mod',
  'system',
  'sistem',
  'destek',
  'support',
  'yetkili',
  'official',
  'resmi',
  'developer',
  'gelistirici',
  'owner',
  'kurucu',
  'gamemaster',
  'gm',
  'staff',
  'bot',
]);

// Compound impersonation stems safe against normal football names (never substring-matching "mod"!)
const RESERVED_SYSTEM_COMPOUND_STEMS: readonly string[] = [
  'admin',
  'administrator',
  'superadmin',
  'sysadmin',
  'yonetici',
  'moderator',
  'gamemaster',
  'gelistirici',
  'developer',
  'official',
  'yetkili',
  'kurucu',
  'resmihesap',
  'resmidestek',
  'oyundestek',
  'canlidestek',
  'destekekip',
  'destekekibi',
  'futbol321',
  '321futbol',
];

export interface UsernameNormalization {
  cleanedRaw: string;
  hasControlOrInvisible: boolean;
  hasHtmlOrScript: boolean;
  alnumNormalized: string;
  alphaWords: string[];
  leetWords: string[];
  leetCompact: string;
  leetDedupedCompact: string;
  rawLowerCompact: string;
}

function mapTurkishLower(input: string): string {
  let lowerTurkish = '';
  for (const ch of input) {
    lowerTurkish += TURKISH_LOWER_MAP[ch] ?? ch.toLowerCase();
  }
  return lowerTurkish.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function mapLeet(input: string): string {
  let out = '';
  for (const ch of input) {
    out += HOMOGLYPH_AND_LEET_MAP[ch] ?? ch;
  }
  return out;
}

export function normalizeForProfanityCheck(raw: string): UsernameNormalization {
  const input = String(raw || '');
  const hasControlOrInvisible = INVISIBLE_AND_CONTROL_RE.test(input);
  INVISIBLE_AND_CONTROL_RE.lastIndex = 0;

  const strippedInvisible = input.replace(INVISIBLE_AND_CONTROL_RE, ' ');
  const hasHtmlOrScript = HTML_OR_XSS_RE.test(strippedInvisible);
  HTML_OR_XSS_RE.lastIndex = 0;

  const trimmed = strippedInvisible.replace(/\s+/g, ' ').trim();
  const diacriticStripped = mapTurkishLower(trimmed);
  const leetConverted = mapLeet(diacriticStripped);

  const rawLowerCompact = diacriticStripped.replace(/[^a-z0-9]/g, '');
  const leetWords = leetConverted
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter(Boolean);

  // Extract word-like alpha chunks by stripping leading/trailing digits from segments before leet,
  // e.g. "pic99" -> "pic", "99oc" -> "oc", "y0net1c1_99" -> "yonetici", while keeping "Modric7" -> "modric".
  const alphaWords: string[] = [];
  for (const seg of diacriticStripped.split(/[^a-z0-9@$|!+]+/g)) {
    const trimmedDigits = seg.replace(/^[0-9]+|[0-9]+$/g, '');
    if (!trimmedDigits) continue;
    const mappedSeg = mapLeet(trimmedDigits).replace(/[^a-z]/g, '');
    if (mappedSeg) {
      alphaWords.push(mappedSeg);
    }
  }

  const leetCompact = leetWords.join('');
  // Collapse 2+ repeated characters so obfuscations like "ooorooospu" or "siikiiim" normalize cleanly
  const leetDedupedCompact = leetCompact.replace(/(.)\1+/g, '$1');

  return {
    cleanedRaw: trimmed,
    hasControlOrInvisible,
    hasHtmlOrScript,
    alnumNormalized: diacriticStripped.replace(/[^a-z0-9_ ]/g, '').trim(),
    alphaWords,
    leetWords,
    leetCompact,
    leetDedupedCompact,
    rawLowerCompact,
  };
}

export function isReservedSystemUsername(rawName: string): boolean {
  const norm = normalizeForProfanityCheck(rawName);
  if (!norm.cleanedRaw) return false;

  const rawCompactAlpha = norm.alphaWords.join('');
  if (
    RESERVED_SYSTEM_EXACT_KEYS.has(norm.rawLowerCompact) ||
    RESERVED_SYSTEM_EXACT_KEYS.has(norm.leetCompact) ||
    RESERVED_SYSTEM_EXACT_KEYS.has(rawCompactAlpha)
  ) {
    return true;
  }

  // Raw delimiter words preserving natural letters (prevents "1" -> "i" weirdness where unwanted,
  // while alphaWords also catches "y0net1c1_1" and "mod_1")
  const rawDelimiterWords = mapTurkishLower(norm.cleanedRaw)
    .split(/[^a-z0-9]+/g)
    .map((w) => w.replace(/^[0-9]+|[0-9]+$/g, ''))
    .filter(Boolean);

  for (const token of rawDelimiterWords) {
    if (RESERVED_SYSTEM_WORD_TOKENS.has(token)) return true;
  }
  for (const token of norm.alphaWords) {
    if (RESERVED_SYSTEM_WORD_TOKENS.has(token)) return true;
  }

  // Compound stems like "Admin123", "ResmiHesap", "YoneticiTR", "OyuncuBot"
  if (
    /(?:^|[^a-z])(?:bot|destek|support|resmi|owner|staff)(?:$|[^a-z])/i.test(rawDelimiterWords.join(' ')) ||
    /(?:bot|destek|support)$/i.test(rawCompactAlpha) ||
    /^(?:destek|support|resmi)/.test(rawCompactAlpha)
  ) {
    return true;
  }

  const candidates = [norm.leetCompact, rawCompactAlpha];
  for (const stem of RESERVED_SYSTEM_COMPOUND_STEMS) {
    if (candidates.some((c) => c.includes(stem))) {
      return true;
    }
  }

  return false;
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

  const dedupedLeetWords = norm.leetWords.map((w) => w.replace(/(.)\1+/g, '$1'));
  const dedupedAlphaWords = norm.alphaWords.map((w) => w.replace(/(.)\1+/g, '$1'));
  for (const token of WORD_ONLY_BANNED_TOKENS) {
    if (
      norm.leetWords.includes(token) ||
      dedupedLeetWords.includes(token) ||
      norm.alphaWords.includes(token) ||
      dedupedAlphaWords.includes(token)
    ) {
      return true;
    }
  }

  // Catch separated 1-2 char obfuscation like "o r o s p u", "a.m.k", "s i k", "o.c"
  const smallWordRuns: string[] = [];
  let currentRun = '';
  for (const w of norm.alphaWords) {
    if (w.length <= 2) {
      currentRun += w;
    } else {
      if (currentRun.length >= 2) smallWordRuns.push(currentRun);
      currentRun = '';
    }
  }
  if (currentRun.length >= 2) smallWordRuns.push(currentRun);

  if (norm.leetWords.length >= 2 && norm.leetWords.every((w) => w.length <= 2)) {
    smallWordRuns.push(norm.leetCompact);
  }
  for (const run of smallWordRuns) {
    const dedupRun = run.replace(/(.)\1+/g, '$1');
    if (
      WORD_ONLY_BANNED_TOKENS.includes(run) ||
      WORD_ONLY_BANNED_TOKENS.includes(dedupRun) ||
      COMPACT_BANNED_STEMS.some((stem) => run.includes(stem) || dedupRun.includes(stem))
    ) {
      return true;
    }
  }

  // Check raw alphanumeric lower (preserving digits before leet) for "31" abuse patterns
  const spacedRawLower = mapTurkishLower(norm.cleanedRaw);
  for (const pattern of INAPPROPRIATE_31_PATTERNS) {
    if (pattern.test(spacedRawLower) || pattern.test(norm.rawLowerCompact)) {
      return true;
    }
  }

  return false;
}

export interface UsernameValidationOutput {
  ok: boolean;
  code?: UsernameValidationErrorCode;
  cleanedDisplay: string;
  error?: string;
}

const ALLOWED_DISPLAY_CHAR_RE = /^[a-zA-Z0-9çÇğĞıİöÖşŞüÜ _.-]+$/;

/**
 * Central username validator used across onboarding, profile edit, and backend APIs.
 * Preserves valid Turkish characters and harmless numbers while blocking profanity, leetspeak,
 * HTML/script payloads, control characters, unsupported symbols, and system/admin impersonation.
 */
export function validateUsername(rawName: string): UsernameValidationOutput {
  const norm = normalizeForProfanityCheck(rawName);
  const cleanedDisplay = norm.cleanedRaw;

  if (!cleanedDisplay) {
    return {
      ok: false,
      code: 'empty',
      cleanedDisplay: '',
      error: 'Kullanıcı adı boş bırakılamaz.',
    };
  }

  if (norm.hasHtmlOrScript || isUsernameProfane(cleanedDisplay)) {
    return {
      ok: false,
      code: 'inappropriate',
      cleanedDisplay,
      error: USERNAME_INAPPROPRIATE_ERROR,
    };
  }

  if (isReservedSystemUsername(cleanedDisplay)) {
    return {
      ok: false,
      code: 'reserved_system',
      cleanedDisplay,
      error: USERNAME_SYSTEM_RESERVED_ERROR,
    };
  }

  if (norm.hasControlOrInvisible || !ALLOWED_DISPLAY_CHAR_RE.test(cleanedDisplay)) {
    return {
      ok: false,
      code: 'unsupported_chars',
      cleanedDisplay,
      error: USERNAME_UNSUPPORTED_CHAR_ERROR,
    };
  }

  if (cleanedDisplay.length < 3 || cleanedDisplay.length > 20) {
    return {
      ok: false,
      code: 'length',
      cleanedDisplay,
      error: 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.',
    };
  }

  const letterCount = (cleanedDisplay.match(/[a-zA-ZçÇğĞıİöÖşŞüÜ]/g) || []).length;
  if (letterCount < 2) {
    return {
      ok: false,
      code: 'too_few_letters',
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
 * Returns true when an existing/legacy username violates current appropriateness,
 * security, or official/system impersonation rules and must be hidden + prompted for rename.
 */
export function isLegacyFlaggedUsername(rawName: string | undefined | null): boolean {
  if (!rawName || !String(rawName).trim()) return true;
  const trimmed = String(rawName).trim();
  if (isUsernameProfane(trimmed)) return true;
  if (isReservedSystemUsername(trimmed)) return true;
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
