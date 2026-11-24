import { ShopGiftItem } from './types';

export interface AnimeAvatarConfig {
  skinToneId: string;
  hairStyleId: string;
  hairColorId: string;
  eyeStyleId: string;
  eyeColorId: string;
  expressionId: string;
  jerseyId: string;
  eyewearId: string;
  headwearId: string;
  armbandId: string;
  auraId: string;
}

export interface AnimeOptionDef {
  id: string;
  label: string;
  costCoins: number;
  giftId?: string;
  priceTry?: number;
  swatch?: string;
  secondarySwatch?: string;
  badgeText?: string;
}

export const ANIME_SKIN_TONES: AnimeOptionDef[] = [
  { id: 'sk1', label: 'Açık Porselen', costCoins: 0, swatch: '#FDE2D2', secondarySwatch: '#E8B8A0' },
  { id: 'sk2', label: 'Sıcak Buğday', costCoins: 0, swatch: '#F3C5A2', secondarySwatch: '#D49A73' },
  { id: 'sk3', label: 'Akdeniz Bronz', costCoins: 0, swatch: '#DFA275', secondarySwatch: '#BA794B' },
  { id: 'sk4', label: 'Altın Esmer', costCoins: 0, swatch: '#B9784E', secondarySwatch: '#8F5632' },
  { id: 'sk5', label: 'Koyu Karamel', costCoins: 0, swatch: '#8D5534', secondarySwatch: '#683B20' },
  { id: 'sk6', label: 'Derin Abanoz', costCoins: 0, swatch: '#5E3622', secondarySwatch: '#3F2214' },
];

export const ANIME_HAIR_STYLES: AnimeOptionDef[] = [
  { id: 'spiky_striker', label: 'Forvet Dikeni', costCoins: 0 },
  { id: 'tsubasa_sweep', label: 'Kaptan Dalga', costCoins: 0 },
  { id: 'side_part_ace', label: 'As Yandan', costCoins: 0 },
  { id: 'curtain_playmaker', label: 'Oyun Kurucu', costCoins: 0 },
  { id: 'afro_power', label: 'Güçlü Kıvırcık', costCoins: 0 },
  { id: 'braid_dreads', label: 'Rasta Örgü', costCoins: 0 },
  { id: 'buzz_captain', label: 'Kısa Kesim', costCoins: 0 },
  { id: 'long_samurai', label: 'Samuray Topuz', costCoins: 0 },
];

export const ANIME_HAIR_COLORS: AnimeOptionDef[] = [
  { id: 'midnight', label: 'Gece Siyahı', costCoins: 0, swatch: '#1E293B', secondarySwatch: '#475569' },
  { id: 'espresso', label: 'Koyu Kahve', costCoins: 0, swatch: '#4A2C1D', secondarySwatch: '#7C4D35' },
  { id: 'gold_blonde', label: 'Altın Sarı', costCoins: 0, swatch: '#FBBF24', secondarySwatch: '#FEF08A' },
  { id: 'platinum', label: 'Platin Gümüş', costCoins: 0, swatch: '#E2E8F0', secondarySwatch: '#FFFFFF' },
  { id: 'crimson', label: 'Kızıl Alev', costCoins: 0, swatch: '#DC2626', secondarySwatch: '#F87171' },
  { id: 'electric_blue', label: 'Mavi Şimşek', costCoins: 0, swatch: '#2563EB', secondarySwatch: '#60A5FA' },
  { id: 'emerald_neo', label: 'Zümrüt Neon', costCoins: 0, swatch: '#10B981', secondarySwatch: '#6EE7B7' },
  { id: 'violet_ace', label: 'Mor Yıldız', costCoins: 0, swatch: '#7C3AED', secondarySwatch: '#C4B5FD' },
];

export const ANIME_EYE_STYLES: AnimeOptionDef[] = [
  { id: 'sharp', label: 'Keskin Golcü', costCoins: 0 },
  { id: 'determined', label: 'Kararlı Bakış', costCoins: 0 },
  { id: 'calm', label: 'Soğukkanlı As', costCoins: 0 },
  { id: 'fierce', label: 'Egoist Parıltı', costCoins: 0 },
];

export const ANIME_EYE_COLORS: AnimeOptionDef[] = [
  { id: 'obsidian', label: 'Koyu', costCoins: 0, swatch: '#1E293B' },
  { id: 'cyan', label: 'Buz Mavisi', costCoins: 0, swatch: '#06B6D4' },
  { id: 'emerald', label: 'Yeşil', costCoins: 0, swatch: '#10B981' },
  { id: 'amber', label: 'Kehribar', costCoins: 0, swatch: '#F59E0B' },
  { id: 'crimson', label: 'Kızıl', costCoins: 0, swatch: '#EF4444' },
  { id: 'violet', label: 'Mor', costCoins: 0, swatch: '#8B5CF6' },
];

export const ANIME_EXPRESSIONS: AnimeOptionDef[] = [
  { id: 'smirk', label: 'Özgüvenli', costCoins: 0 },
  { id: 'grin', label: 'Gol Sevinci', costCoins: 0 },
  { id: 'focused', label: 'Odaklı', costCoins: 0 },
  { id: 'wink', label: 'Göz Kırpma', costCoins: 0 },
];

// ── Unlockable Coin Gear (1,500 – 6,000 Coins) ──

export const ANIME_JERSEYS: AnimeOptionDef[] = [
  {
    id: 'jersey_starter',
    label: 'Klasik Mavi Forma',
    costCoins: 0,
    swatch: '#1D4ED8',
    secondarySwatch: '#FFFFFF',
  },
  {
    id: 'jersey_crimson_striker',
    label: 'Kızıl Forvet Forması',
    costCoins: 1500,
    giftId: 'gift_anime_jersey_crimson_striker',
    priceTry: 24.99,
    swatch: '#DC2626',
    secondarySwatch: '#111827',
  },
  {
    id: 'jersey_royal_galaxy',
    label: 'Galaktik Beyaz Forma',
    costCoins: 2000,
    giftId: 'gift_anime_jersey_royal_galaxy',
    priceTry: 29.99,
    swatch: '#F8FAFC',
    secondarySwatch: '#F59E0B',
  },
  {
    id: 'jersey_emerald_ace',
    label: 'Zümrüt As Forması',
    costCoins: 2500,
    giftId: 'gift_anime_jersey_emerald_ace',
    priceTry: 34.99,
    swatch: '#16A34A',
    secondarySwatch: '#064E3B',
  },
  {
    id: 'jersey_golden_champ',
    label: 'Altın Şampiyon Forması',
    costCoins: 4000,
    giftId: 'gift_anime_jersey_golden_champ',
    priceTry: 44.99,
    swatch: '#F59E0B',
    secondarySwatch: '#1E1B4B',
  },
];

export const ANIME_EYEWEAR: AnimeOptionDef[] = [
  { id: 'eyewear_none', label: 'Yok', costCoins: 0 },
  {
    id: 'eyewear_cyber_visor',
    label: 'Siber Vizör',
    costCoins: 1800,
    giftId: 'gift_anime_eyewear_cyber_visor',
    priceTry: 24.99,
    swatch: '#22D3EE',
  },
  {
    id: 'eyewear_gold_shades',
    label: 'Altın Spor Gözlük',
    costCoins: 2800,
    giftId: 'gift_anime_eyewear_gold_shades',
    priceTry: 34.99,
    swatch: '#FBBF24',
  },
  {
    id: 'eyewear_neon_goggles',
    label: 'Efsane Hız Gözlüğü',
    costCoins: 3500,
    giftId: 'gift_anime_eyewear_neon_goggles',
    priceTry: 39.99,
    swatch: '#F97316',
  },
];

export const ANIME_HEADWEAR: AnimeOptionDef[] = [
  { id: 'headwear_none', label: 'Yok', costCoins: 0 },
  {
    id: 'headwear_striker_band',
    label: 'Forvet Saç Bandı',
    costCoins: 1500,
    giftId: 'gift_anime_headwear_striker_band',
    priceTry: 19.99,
    swatch: '#EF4444',
  },
  {
    id: 'headwear_aero_cap',
    label: 'Ters Şapka',
    costCoins: 2500,
    giftId: 'gift_anime_headwear_aero_cap',
    priceTry: 29.99,
    swatch: '#0F172A',
  },
  {
    id: 'headwear_blue_flame',
    label: 'Mavi Alev Bandana',
    costCoins: 3500,
    giftId: 'gift_anime_headwear_blue_flame',
    priceTry: 39.99,
    swatch: '#38BDF8',
  },
];

export const ANIME_ARMBANDS: AnimeOptionDef[] = [
  { id: 'armband_none', label: 'Yok', costCoins: 0 },
  {
    id: 'armband_classic_red',
    label: 'Klasik Kaptan Bandı',
    costCoins: 1500,
    giftId: 'gift_anime_armband_classic_red',
    priceTry: 19.99,
    swatch: '#DC2626',
  },
  {
    id: 'armband_neon_cap',
    label: 'Şampiyonlar Bandı',
    costCoins: 2500,
    giftId: 'gift_anime_armband_neon_cap',
    priceTry: 29.99,
    swatch: '#22D3EE',
  },
  {
    id: 'armband_legend_crown',
    label: 'Efsane Taçlı Bant',
    costCoins: 4500,
    giftId: 'gift_anime_armband_legend_crown',
    priceTry: 44.99,
    swatch: '#FBBF24',
  },
];

export const ANIME_AURAS: AnimeOptionDef[] = [
  { id: 'aura_none', label: 'Klasik Stadyum', costCoins: 0, swatch: '#1E293B' },
  {
    id: 'aura_blue_lightning',
    label: 'Mavi Şimşek Aurası',
    costCoins: 3000,
    giftId: 'gift_anime_aura_blue_lightning',
    priceTry: 34.99,
    swatch: '#06B6D4',
  },
  {
    id: 'aura_emerald_surge',
    label: 'Zümrüt Saha Dalgası',
    costCoins: 4000,
    giftId: 'gift_anime_aura_emerald_surge',
    priceTry: 44.99,
    swatch: '#10B981',
  },
  {
    id: 'aura_golden_saiyan',
    label: 'Altın Süper Aura',
    costCoins: 6000,
    giftId: 'gift_anime_aura_golden_saiyan',
    priceTry: 54.99,
    swatch: '#F59E0B',
  },
];

export const DEFAULT_ANIME_AVATAR_CONFIG: AnimeAvatarConfig = {
  skinToneId: 'sk2',
  hairStyleId: 'spiky_striker',
  hairColorId: 'midnight',
  eyeStyleId: 'sharp',
  eyeColorId: 'cyan',
  expressionId: 'smirk',
  jerseyId: 'jersey_starter',
  eyewearId: 'eyewear_none',
  headwearId: 'headwear_none',
  armbandId: 'armband_none',
  auraId: 'aura_none',
};

export const ALL_ANIME_UNLOCKABLE_ITEMS: AnimeOptionDef[] = [
  ...ANIME_JERSEYS,
  ...ANIME_EYEWEAR,
  ...ANIME_HEADWEAR,
  ...ANIME_ARMBANDS,
  ...ANIME_AURAS,
].filter((item) => item.costCoins > 0 && Boolean(item.giftId));

export const ANIME_UNLOCKABLE_GIFTS: ShopGiftItem[] = ALL_ANIME_UNLOCKABLE_ITEMS.map((item) => ({
  id: item.giftId!,
  title: item.label,
  description: `Anime Futbolcu Avatar aksesuarı (${item.costCoins.toLocaleString('tr-TR')} Coin)`,
  costCoins: item.costCoins,
  priceTry: item.priceTry,
  icon: '⚡',
  category: 'pp_badges',
  type: 'avatar_gear',
  value: item.id,
}));

export function isAnimeAvatar(avatar?: string): boolean {
  return Boolean(avatar && avatar.startsWith('anime:'));
}

export function serializeAnimeAvatar(cfg: AnimeAvatarConfig): string {
  const parts = [
    `sk=${cfg.skinToneId}`,
    `hs=${cfg.hairStyleId}`,
    `hc=${cfg.hairColorId}`,
    `es=${cfg.eyeStyleId}`,
    `ec=${cfg.eyeColorId}`,
    `ex=${cfg.expressionId}`,
    `jr=${cfg.jerseyId}`,
    `ew=${cfg.eyewearId}`,
    `hw=${cfg.headwearId}`,
    `ab=${cfg.armbandId}`,
    `au=${cfg.auraId}`,
  ];
  return `anime:${parts.join('&')}`;
}

function validId(list: AnimeOptionDef[], candidate: string | undefined, fallback: string): string {
  if (!candidate) return fallback;
  return list.some((i) => i.id === candidate) ? candidate : fallback;
}

export function parseAnimeAvatar(avatar?: string): AnimeAvatarConfig | null {
  if (!avatar || !avatar.startsWith('anime:')) return null;
  const body = avatar.slice(6);
  const map = new Map<string, string>();
  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      map.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  return {
    skinToneId: validId(ANIME_SKIN_TONES, map.get('sk'), DEFAULT_ANIME_AVATAR_CONFIG.skinToneId),
    hairStyleId: validId(ANIME_HAIR_STYLES, map.get('hs'), DEFAULT_ANIME_AVATAR_CONFIG.hairStyleId),
    hairColorId: validId(ANIME_HAIR_COLORS, map.get('hc'), DEFAULT_ANIME_AVATAR_CONFIG.hairColorId),
    eyeStyleId: validId(ANIME_EYE_STYLES, map.get('es'), DEFAULT_ANIME_AVATAR_CONFIG.eyeStyleId),
    eyeColorId: validId(ANIME_EYE_COLORS, map.get('ec'), DEFAULT_ANIME_AVATAR_CONFIG.eyeColorId),
    expressionId: validId(ANIME_EXPRESSIONS, map.get('ex'), DEFAULT_ANIME_AVATAR_CONFIG.expressionId),
    jerseyId: validId(ANIME_JERSEYS, map.get('jr'), DEFAULT_ANIME_AVATAR_CONFIG.jerseyId),
    eyewearId: validId(ANIME_EYEWEAR, map.get('ew'), DEFAULT_ANIME_AVATAR_CONFIG.eyewearId),
    headwearId: validId(ANIME_HEADWEAR, map.get('hw'), DEFAULT_ANIME_AVATAR_CONFIG.headwearId),
    armbandId: validId(ANIME_ARMBANDS, map.get('ab'), DEFAULT_ANIME_AVATAR_CONFIG.armbandId),
    auraId: validId(ANIME_AURAS, map.get('au'), DEFAULT_ANIME_AVATAR_CONFIG.auraId),
  };
}

const ANIME_DRAFT_STORAGE_KEY = '321_anime_avatar_draft_v1';

export function loadSavedAnimeAvatarConfig(currentAvatar?: string): AnimeAvatarConfig {
  const parsed = parseAnimeAvatar(currentAvatar);
  if (parsed) return parsed;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ANIME_DRAFT_STORAGE_KEY);
      if (raw) {
        const fromStorage = parseAnimeAvatar(raw);
        if (fromStorage) return fromStorage;
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_ANIME_AVATAR_CONFIG;
}

export function saveAnimeAvatarConfigDraft(cfg: AnimeAvatarConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANIME_DRAFT_STORAGE_KEY, serializeAnimeAvatar(cfg));
  } catch {
    // ignore
  }
}
