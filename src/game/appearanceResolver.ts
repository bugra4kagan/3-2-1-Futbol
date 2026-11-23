import { CLUBS } from './database';
import { resolveClubBadgeMeta } from './clubBadgeCatalog';
import {
  FacialHair,
  HairStyle,
  Player,
  PlayerAppearance,
  PlayerSignatureTrait,
} from './types';

const HAIR_STYLES: HairStyle[] = [
  'braided-bun',
  'long-blonde',
  'curly-afro',
  'short-fade',
  'buzzcut',
  'messy-medium',
  'bald',
];

const FACIAL_HAIRS: FacialHair[] = ['none', 'stubble', 'beard', 'mustache'];

const NATURAL_DARK_HAIR = ['#0f172a', '#18181b', '#2b1d14', '#3f2818', '#5c3c24', '#714b2d'];
const BLONDE_HAIR = ['#e5b94c', '#d4a64a', '#f2cf75', '#c89b3c'];

// Uyruk / bölge bazlı gerçekçi ve çeşitlendirilmiş ten rengi paletleri
const SKIN_PALETTES = {
  nordicFair: ['#fce1cf', '#f7d3ba', '#f3c6a5', '#ecc09f'],
  europeanLight: ['#f5d0b5', '#efc1a0', '#e8b490', '#ddb08b'],
  mediterraneanOlive: ['#eac09b', '#dfb086', '#d49d72', '#c88c61'],
  latinMix: ['#d9a074', '#ca8d61', '#b6784e', '#a3653e'],
  northAfricanArab: ['#d69c70', '#c6885b', '#b3744a', '#9c6039'],
  westAfricanDeep: ['#8f5434', '#7b4528', '#68381f', '#572c18'],
  eastAsian: ['#f4d1b6', '#ecc19f', '#e2b28b', '#d9a47c'],
};

const NATIONALITY_REGION: Record<string, keyof typeof SKIN_PALETTES> = {
  Norveç: 'nordicFair',
  İsveç: 'nordicFair',
  Danimarka: 'nordicFair',
  Finlandiya: 'nordicFair',
  İzlanda: 'nordicFair',
  İngiltere: 'europeanLight',
  İskoçya: 'europeanLight',
  Galler: 'europeanLight',
  İrlanda: 'europeanLight',
  'Kuzey İrlanda': 'europeanLight',
  Almanya: 'europeanLight',
  Hollanda: 'europeanLight',
  Belçika: 'europeanLight',
  Avusturya: 'europeanLight',
  İsviçre: 'europeanLight',
  Polonya: 'europeanLight',
  Çekya: 'europeanLight',
  Macaristan: 'europeanLight',
  Slovakya: 'europeanLight',
  Slovenya: 'europeanLight',
  Hırvatistan: 'europeanLight',
  Sırbistan: 'europeanLight',
  'Bosna-Hersek': 'europeanLight',
  Karadağ: 'europeanLight',
  Romanya: 'europeanLight',
  Bulgaristan: 'europeanLight',
  Rusya: 'europeanLight',
  Ukrayna: 'europeanLight',
  Türkiye: 'mediterraneanOlive',
  İspanya: 'mediterraneanOlive',
  İtalya: 'mediterraneanOlive',
  Portekiz: 'mediterraneanOlive',
  Yunanistan: 'mediterraneanOlive',
  İsrail: 'mediterraneanOlive',
  Gürcistan: 'mediterraneanOlive',
  Ermenistan: 'mediterraneanOlive',
  Kosova: 'mediterraneanOlive',
  Arnavutluk: 'mediterraneanOlive',
  Fransa: 'mediterraneanOlive',
  Arjantin: 'mediterraneanOlive',
  Uruguay: 'mediterraneanOlive',
  Brezilya: 'latinMix',
  Kolombiya: 'latinMix',
  Şili: 'latinMix',
  Meksika: 'latinMix',
  Ekvador: 'latinMix',
  ABD: 'europeanLight',
  Avustralya: 'europeanLight',
  Kanada: 'westAfricanDeep',
  Mısır: 'northAfricanArab',
  Tunus: 'northAfricanArab',
  Fas: 'northAfricanArab',
  Cezayir: 'northAfricanArab',
  Libya: 'northAfricanArab',
  'Suudi Arabistan': 'northAfricanArab',
  Katar: 'northAfricanArab',
  BAE: 'northAfricanArab',
  Nijerya: 'westAfricanDeep',
  Senegal: 'westAfricanDeep',
  Kamerun: 'westAfricanDeep',
  Gana: 'westAfricanDeep',
  Gabon: 'westAfricanDeep',
  'Fildişi Sahili': 'westAfricanDeep',
  Gine: 'westAfricanDeep',
  Togo: 'westAfricanDeep',
  Benin: 'westAfricanDeep',
  Surinam: 'westAfricanDeep',
  Liberya: 'westAfricanDeep',
  'Kongo DC': 'westAfricanDeep',
  'Burkina Faso': 'westAfricanDeep',
  Mali: 'westAfricanDeep',
  Gambiya: 'westAfricanDeep',
  Mozambik: 'westAfricanDeep',
  Jamaika: 'westAfricanDeep',
  'Yeşil Burun Adaları': 'westAfricanDeep',
  'Güney Kore': 'eastAsian',
  Japonya: 'eastAsian',
};

// İkonik futbolculara özgü karakteristik anime imzaları
const PLAYER_SIGNATURE_OVERRIDES: Record<string, PlayerSignatureTrait> = {
  // Maskeli golcü / savunmacılar
  victor_osimhen: 'mask',
  antonio_rudiger: 'mask',
  josko_gvardiol: 'mask',

  // Viking / Kuzey fırtınası
  erling_haaland: 'viking',
  zlatan_ibrahimovic: 'viking',
  viktor_gyokeres: 'viking',
  alexander_isak: 'viking',
  peter_schmeichel: 'viking',

  // Komutan / İmparator aurası (Dictator / Commander)
  kylian_mbappe: 'commander',
  jude_bellingham: 'commander',
  mohamed_salah: 'commander',
  mauro_icardi: 'commander',
  vinicius_junior: 'commander',
  lamine_yamal: 'commander',
  phil_foden: 'commander',
  arda_guler: 'commander',
  kenan_yildiz: 'commander',
  robert_lewandowski: 'commander',

  // Saç bandı ikonu
  ronaldinho: 'headband',
  neymar: 'headband',
  david_beckham: 'headband',
  gavi: 'headband',
  jack_grealish: 'headband',
  rafael_leao: 'headband',
  socrates: 'headband',
  sergio_ramos: 'headband',

  // Futbol Efsanesi altın tacı / aurası
  lionel_messi: 'legend_crown',
  cristiano_ronaldo: 'legend_crown',
  pele: 'legend_crown',
  diego_maradona: 'legend_crown',
  johan_cruyff: 'legend_crown',
  zinedine_zidane: 'legend_crown',
  ronaldo_nazario: 'legend_crown',
  alex_de_souza: 'legend_crown',
  gheorghe_hagi: 'legend_crown',
  franz_beckenbauer: 'legend_crown',
  eusebio: 'legend_crown',
  zico: 'legend_crown',
  garrincha: 'legend_crown',
  bobby_charlton: 'legend_crown',
  george_best: 'legend_crown',
};

const NORDIC_EYE_COLORS = ['#38bdf8', '#0ea5e9', '#60a5fa'];
const EUROPEAN_EYE_COLORS = ['#0284c7', '#10b981', '#64748b', '#78350f', '#0d9488'];
const WARM_EYE_COLORS = ['#78350f', '#451a03', '#b45309', '#57534e', '#1e293b'];

export function hashPlayerSeed(input: string): number {
  let h = 2166136261;
  const clean = (input || '321football').trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getLastClubColors(player?: Partial<Player> | null, seedHash = 0): [string, string] {
  if (player) {
    // 1. Öncelik: kariyer dizisindeki son kulüp
    const career = player.careerHistory;
    if (Array.isArray(career) && career.length > 0) {
      const lastStep = career[career.length - 1];
      const clubObj = lastStep.clubId ? CLUBS[lastStep.clubId] || null : null;
      const meta = resolveClubBadgeMeta(lastStep.clubId, lastStep.club, clubObj);
      if (meta.primaryColor !== meta.secondaryColor) {
        return [meta.primaryColor, meta.secondaryColor];
      }
      return [meta.primaryColor, meta.accentColor || '#06b6d4'];
    }

    // 2. Öncelik: aktif clubId / clubName (veya varsa harici clubs dizisinin son elemanı)
    const extraClubs = (player as Partial<Player> & { clubs?: string[] }).clubs;
    const fallbackClubId =
      player.clubId ||
      (Array.isArray(extraClubs) && extraClubs.length > 0
        ? extraClubs[extraClubs.length - 1]
        : undefined);
    const clubObj = fallbackClubId ? CLUBS[fallbackClubId] || null : null;
    if (clubObj || player.clubName || fallbackClubId) {
      const meta = resolveClubBadgeMeta(fallbackClubId, player.clubName || clubObj?.name, clubObj);
      if (meta.primaryColor !== meta.secondaryColor) {
        return [meta.primaryColor, meta.secondaryColor];
      }
      return [meta.primaryColor, meta.accentColor || '#06b6d4'];
    }
  }

  const fallbackPalettes: [string, string][] = [
    ['#0f172a', '#06b6d4'],
    ['#1d4ed8', '#facc15'],
    ['#dc2626', '#f8fafc'],
    ['#047857', '#a7f3d0'],
    ['#6d28d9', '#ec4899'],
    ['#ea580c', '#0f172a'],
  ];
  return fallbackPalettes[seedHash % fallbackPalettes.length];
}

export function resolveSignatureTrait(player?: Partial<Player> | null): PlayerSignatureTrait {
  if (player?.appearance?.signature) {
    return player.appearance.signature;
  }
  if (player?.id && PLAYER_SIGNATURE_OVERRIDES[player.id]) {
    return PLAYER_SIGNATURE_OVERRIDES[player.id];
  }
  if (player?.position === 'GK') {
    return 'keeper_aura';
  }
  return 'none';
}

function resolveEyeColor(
  player: Partial<Player> | null | undefined,
  seedHash: number,
  signature: PlayerSignatureTrait
): string {
  if (player?.appearance?.eyeColor) {
    return player.appearance.eyeColor;
  }
  if (signature === 'viking') {
    return NORDIC_EYE_COLORS[seedHash % NORDIC_EYE_COLORS.length];
  }
  if (signature === 'commander') {
    return '#d97706';
  }
  if (signature === 'mask') {
    return '#f59e0b';
  }
  const regionKey =
    (player?.nationality && NATIONALITY_REGION[player.nationality]) || 'mediterraneanOlive';
  if (regionKey === 'nordicFair') {
    return NORDIC_EYE_COLORS[seedHash % NORDIC_EYE_COLORS.length];
  }
  if (regionKey === 'europeanLight') {
    return EUROPEAN_EYE_COLORS[seedHash % EUROPEAN_EYE_COLORS.length];
  }
  return WARM_EYE_COLORS[seedHash % WARM_EYE_COLORS.length];
}

export function computeAutoAppearance(
  player?: Partial<Player> | null,
  fallbackName = 'Oyuncu'
): PlayerAppearance {
  const seedText = (player?.name || fallbackName || 'Oyuncu').trim();
  const h = hashPlayerSeed(seedText);

  const hairStyle = HAIR_STYLES[h % HAIR_STYLES.length];
  const hairColor =
    hairStyle === 'long-blonde'
      ? BLONDE_HAIR[(h >> 3) % BLONDE_HAIR.length]
      : NATURAL_DARK_HAIR[(h >> 3) % NATURAL_DARK_HAIR.length];

  const regionKey =
    (player?.nationality && NATIONALITY_REGION[player.nationality]) || 'mediterraneanOlive';
  const skinPalette = SKIN_PALETTES[regionKey];
  const skinTone = skinPalette[(h >> 6) % skinPalette.length];

  const facialHair = FACIAL_HAIRS[(h >> 9) % FACIAL_HAIRS.length];
  const jerseyColors = getLastClubColors(player, h >> 12);
  const signature = resolveSignatureTrait(player);
  const eyeColor = resolveEyeColor(player, h >> 15, signature);

  return {
    hairStyle,
    hairColor,
    skinTone,
    facialHair,
    jerseyColors,
    eyeColor,
    signature,
  };
}

export function resolvePlayerAppearance(
  player?: Partial<Player> | null,
  fallbackName = 'Oyuncu'
): PlayerAppearance {
  const seedHash = hashPlayerSeed((player?.name || fallbackName || 'Oyuncu').trim());
  const signature = resolveSignatureTrait(player);
  const eyeColor = resolveEyeColor(player, seedHash >> 15, signature);

  if (player?.appearance) {
    return {
      ...player.appearance,
      signature: player.appearance.signature ?? signature,
      eyeColor: player.appearance.eyeColor ?? eyeColor,
    };
  }
  return computeAutoAppearance(player, fallbackName);
}
