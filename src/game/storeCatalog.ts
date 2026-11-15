import { ShopGiftItem } from './types';
import { STAR_PP_AVATARS } from './avatarCatalog';

export const STORE_ITEMS: ShopGiftItem[] = [
  // ── 1. Reklam Engelleme & Güçlendiriciler (Enerji İçeceği + 2x Katlayıcı) ──
  {
    id: 'store_ad_free',
    title: 'Reklam Engelleme (VIP)',
    description: 'Sadece gerçek para (₺) ile alınır: Tüm reklam bantlarını kalıcı olarak kaldırır & 2x ödülleri beklemeden anında verir!',
    costCoins: 0,
    priceTry: 149.99,
    icon: '🛡️',
    category: 'ads_coins',
    type: 'ad_free',
    value: 'ad_free',
  },
  {
    id: 'store_mult_2x_5',
    title: 'Ödül Katlayıcı 2x (5 Maç)',
    description: 'Sonraki 5 maçta kazandığın tüm Coin ve Lig Puanlarını otomatik 2x katlar!',
    costCoins: 2000,
    priceTry: 39.99,
    icon: '⚡',
    category: 'featured',
    type: 'multiplier_2x',
    value: '5_matches',
    quantity: 5,
  },
  {
    id: 'store_mult_2x_forever',
    title: 'Kalıcı 2x Ödül Katlayıcı',
    description: 'Süresiz olarak tüm maçlarda 2x Coin ve Lig Puanı kazancı sağlar!',
    costCoins: 12000,
    priceTry: 129.99,
    icon: '👑',
    category: 'ads_coins',
    type: 'multiplier_2x',
    value: 'forever',
  },
  {
    id: 'store_energy_1',
    title: 'Enerji İçeceği (1 Adet)',
    description: 'Zorlandığın turda 💡 İpucu aç veya ⏭️ Pas Geç hakkı kullan!',
    costCoins: 250,
    priceTry: 14.99,
    icon: '🥤',
    category: 'featured',
    type: 'energy_pack',
    value: 'energy_1',
    quantity: 1,
  },
  {
    id: 'store_energy_3',
    title: 'Enerji İçeceği 3’lü Paket',
    description: '3 adet maç içi İpucu / Pas hakkı — avantajlı fiyat!',
    costCoins: 650,
    priceTry: 29.99,
    icon: '🔋',
    category: 'featured',
    type: 'energy_pack',
    value: 'energy_3',
    quantity: 3,
  },
  {
    id: 'store_energy_10',
    title: 'Enerji İçeceği 10’lu Kasa',
    description: 'Tam 10 adet maç içi İpucu / Pas hakkı ile durdurulamaz ol!',
    costCoins: 1800,
    priceTry: 69.99,
    icon: '⚡',
    category: 'ads_coins',
    type: 'energy_pack',
    value: 'energy_10',
    quantity: 10,
  },

  // ── 2. Coin Paketleri (Gerçek Para / Mağaza Ödemesi) ──
  {
    id: 'pack_coin_1500',
    title: '1.500 Coin Paketi',
    description: 'Hızlı başlangıç için anında 1.500 Coin hesabına yüklenir.',
    costCoins: 0,
    priceTry: 39.99,
    icon: '🪙',
    category: 'ads_coins',
    type: 'coin_pack',
    value: '1500',
    quantity: 1500,
  },
  {
    id: 'pack_coin_6000',
    title: '6.000 Coin Paketi',
    description: 'Yıldız PP ve özel çerçeveler için popüler Coin paketi!',
    costCoins: 0,
    priceTry: 99.99,
    icon: '💰',
    category: 'ads_coins',
    type: 'coin_pack',
    value: '6000',
    quantity: 6000,
  },
  {
    id: 'pack_coin_15000',
    title: '15.000 Coin Kasası',
    description: 'Efsanevi koleksiyoncular için dev Coin paketi!',
    costCoins: 0,
    priceTry: 199.99,
    icon: '🏦',
    category: 'ads_coins',
    type: 'coin_pack',
    value: '15000',
    quantity: 15000,
  },
  {
    id: 'pack_coin_35000',
    title: '35.000 Şampiyon Hazinesi',
    description: 'Mağazadaki her şeyi açmaya yetecek mega Coin hazinesi!',
    costCoins: 0,
    priceTry: 379.99,
    icon: '💎',
    category: 'ads_coins',
    type: 'coin_pack',
    value: '35000',
    quantity: 35000,
  },

  // ── 3. Özel Takım Armaları ──
  {
    id: 'crest_gold_crown',
    title: 'Altın Kraliyet Arması',
    description: 'Profilinde ve maç skor tabelasında parlayan altın kalkan arması',
    costCoins: 4500,
    priceTry: 49.99,
    icon: '🛡️',
    category: 'crests_frames',
    type: 'crest',
    value: 'crest_gold_crown',
  },
  {
    id: 'crest_superlig_star',
    title: 'Süper Lig Yıldız Arması',
    description: '5 yıldızlı özel kırmızı-altın şampiyonluk arması',
    costCoins: 5500,
    priceTry: 59.99,
    icon: '🌟',
    category: 'crests_frames',
    type: 'crest',
    value: 'crest_superlig_star',
  },
  {
    id: 'crest_euro_conqueror',
    title: 'Avrupa Fatihi Arması',
    description: 'Gece mavisi & gümüş Avrupa kupası özel kulüp arması',
    costCoins: 6500,
    priceTry: 69.99,
    icon: '🏆',
    category: 'crests_frames',
    type: 'crest',
    value: 'crest_euro_conqueror',
  },
  {
    id: 'crest_neon_dragon',
    title: 'Neon Ejderha Arması',
    description: 'Siber mor & neon cyan özel e-spor takım arması',
    costCoins: 8000,
    priceTry: 79.99,
    icon: '🐉',
    category: 'crests_frames',
    type: 'crest',
    value: 'crest_neon_dragon',
  },

  // ── 4. Altın / Neon Oyuncu Kartı Çerçeveleri ──
  {
    id: 'frame_gold',
    title: 'Altın Efsane Çerçevesi',
    description: 'Avatarını altın parıltılı efsane kart çerçevesiyle donat!',
    costCoins: 5500,
    priceTry: 59.99,
    icon: '🟨',
    category: 'crests_frames',
    type: 'frame',
    value: 'gold',
  },
  {
    id: 'frame_neon',
    title: 'Neon Siber Çerçeve',
    description: 'Elektrik cyan & mor neon ışıklı oyuncu kartı çerçevesi',
    costCoins: 6500,
    priceTry: 64.99,
    icon: '⚡',
    category: 'crests_frames',
    type: 'frame',
    value: 'neon',
  },
  {
    id: 'frame_emerald',
    title: 'Zümrüt Şampiyon Çerçeve',
    description: 'Parlak zümrüt yeşili prestijli oyuncu kartı çerçevesi',
    costCoins: 5000,
    priceTry: 54.99,
    icon: '🟩',
    category: 'crests_frames',
    type: 'frame',
    value: 'emerald',
  },
  {
    id: 'frame_fire',
    title: 'Alev Yıldızı Çerçevesi',
    description: 'Kızıl-turuncu yanan forvet çerçevesi',
    costCoins: 7500,
    priceTry: 79.99,
    icon: '🔥',
    category: 'crests_frames',
    type: 'frame',
    value: 'fire',
  },

  // ── 5. Farklı Saha Temaları ──
  {
    id: 'pitch_ucl_night',
    title: 'Şampiyonlar Gecesi Sahası',
    description: 'Maç arenasını lacivert yıldızlı gece stadyumu atmosferine çevirir',
    costCoins: 5000,
    priceTry: 59.99,
    icon: '🌌',
    category: 'themes_effects',
    type: 'pitch_theme',
    value: 'ucl_night',
  },
  {
    id: 'pitch_gold_stadium',
    title: 'Altın Kupa Arenası',
    description: 'Final atmosferi sunan altın ışıklandırmalı özel saha teması',
    costCoins: 7000,
    priceTry: 74.99,
    icon: '🏟️',
    category: 'themes_effects',
    type: 'pitch_theme',
    value: 'gold_stadium',
  },
  {
    id: 'pitch_cyber_arena',
    title: 'Neon Siber Saha',
    description: 'Mor-cyan fütüristik neon ışıklandırmalı arena teması',
    costCoins: 6500,
    priceTry: 69.99,
    icon: '🛸',
    category: 'themes_effects',
    type: 'pitch_theme',
    value: 'cyber_arena',
  },

  // ── 6. Gol / Zafer Efektleri ──
  {
    id: 'effect_gold_fireworks',
    title: 'Altın Havai Fişek Efekti',
    description: 'Her galibiyette ve maç sonunda altın yağmuru patlaması!',
    costCoins: 5500,
    priceTry: 59.99,
    icon: '🎆',
    category: 'themes_effects',
    type: 'goal_effect',
    value: 'gold_fireworks',
  },
  {
    id: 'effect_neon_lightning',
    title: 'Neon Şimşek Patlaması',
    description: 'Galibiyetlerde elektrik mavisi ve mor yıldırım konfetisi!',
    costCoins: 6500,
    priceTry: 69.99,
    icon: '🌩️',
    category: 'themes_effects',
    type: 'goal_effect',
    value: 'neon_lightning',
  },
  {
    id: 'effect_flame_burst',
    title: 'Şampiyon Alev Patlaması',
    description: 'Tur ve maç zaferlerinde alev kırmızısı şölen!',
    costCoins: 8000,
    priceTry: 84.99,
    icon: '🌋',
    category: 'themes_effects',
    type: 'goal_effect',
    value: 'flame_burst',
  },

  // ── 7. Profil Rozetleri & Unvanlar ──
  {
    id: 'badge_king_crown',
    title: 'Saha Kralı Rozeti',
    description: 'İsminin yanında parlayan Altın Kral Tacı profil rozeti',
    costCoins: 5000,
    priceTry: 49.99,
    icon: '👑',
    category: 'pp_badges',
    type: 'badge',
    value: '👑',
  },
  {
    id: 'badge_legend_10',
    title: 'Efsane 10 Numara Rozeti',
    description: 'Oyun kurucu ustalığını gösteren özel 10 Numara rozeti',
    costCoins: 6000,
    priceTry: 59.99,
    icon: '🔟',
    category: 'pp_badges',
    type: 'badge',
    value: '🔟',
  },
  {
    id: 'badge_golden_glove',
    title: 'Altın Eldiven Rozeti',
    description: 'Hatasız cevap veren kilit isimler için özel eldiven rozeti',
    costCoins: 5500,
    priceTry: 54.99,
    icon: '🧤',
    category: 'pp_badges',
    type: 'badge',
    value: '🧤',
  },
  {
    id: 'badge_unbeaten',
    title: 'Yenilmez Aslan Rozeti',
    description: 'Rakiplere gözdağı veren nadir Aslan profil rozeti',
    costCoins: 9000,
    priceTry: 89.99,
    icon: '🦁',
    category: 'pp_badges',
    type: 'badge',
    value: '🦁',
  },

  // Classic Titles & Avatars (kept for continuity)
  {
    id: 'gift_title_maestro',
    title: 'Orta Saha Maestrosu',
    description: 'Profilinde ve ligde parlayan özel unvan',
    costCoins: 500,
    priceTry: 19.99,
    icon: '🎖️',
    category: 'pp_badges',
    type: 'title',
    value: 'Orta Saha Maestrosu',
  },
  {
    id: 'gift_title_superlig',
    title: 'Süper Lig Gurmesi',
    description: 'Türk futbolu uzmanlarına özel unvan',
    costCoins: 1000,
    priceTry: 24.99,
    icon: '🇹🇷',
    category: 'pp_badges',
    type: 'title',
    value: 'Süper Lig Gurmesi',
  },
  {
    id: 'gift_title_legend',
    title: '3-2-1 Efsanesi',
    description: 'Şampiyonlara yakışan prestijli unvan ve taç',
    costCoins: 2500,
    priceTry: 39.99,
    icon: '👑',
    category: 'pp_badges',
    type: 'title',
    value: '3-2-1 Efsanesi',
  },
  {
    id: 'gift_avatar_diamond',
    title: 'Elmas Kupa Avatarı',
    description: 'Özel koleksiyon elmas avatarı',
    costCoins: 750,
    priceTry: 19.99,
    icon: '💎',
    category: 'pp_badges',
    type: 'avatar',
    value: '💎',
  },
  {
    id: 'gift_avatar_eagle',
    title: 'Altın Kartal Avatarı',
    description: 'Keskin gözlü futbol avcılarına özel',
    costCoins: 1200,
    priceTry: 24.99,
    icon: '🦅',
    category: 'pp_badges',
    type: 'avatar',
    value: '🦅',
  },
  {
    id: 'gift_avatar_goat',
    title: 'GOAT Tacı Avatarı',
    description: 'Tüm zamanların en iyileri için özel ikon',
    costCoins: 2000,
    priceTry: 34.99,
    icon: '🐐',
    category: 'pp_badges',
    type: 'avatar',
    value: '🐐',
  },

  // ── 8. Yıldız PP Avatarları (5.000 - 10.000 Coin + Gerçek Para ₺) ──
  ...STAR_PP_AVATARS.map((pp): ShopGiftItem => ({
    id: pp.giftId,
    title: pp.name,
    description: pp.description,
    costCoins: pp.costCoins,
    priceTry: pp.priceTry,
    icon: '🖼️',
    category: 'pp_badges',
    type: 'avatar',
    value: pp.avatarValue,
  })),
];

export function getFrameClasses(frame?: string): string {
  switch (frame) {
    case 'gold':
      return 'ring-2 ring-amber-400 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.55)]';
    case 'neon':
      return 'ring-2 ring-cyan-400 border-fuchsia-400 shadow-[0_0_16px_rgba(34,211,238,0.6)]';
    case 'emerald':
      return 'ring-2 ring-emerald-400 border-teal-300 shadow-[0_0_16px_rgba(52,211,153,0.55)]';
    case 'fire':
      return 'ring-2 ring-orange-500 border-rose-400 shadow-[0_0_16px_rgba(249,115,22,0.65)]';
    default:
      return '';
  }
}

export function getPitchThemeStyle(theme?: string): {
  bgClass: string;
  label: string;
} {
  switch (theme) {
    case 'ucl_night':
      return {
        bgClass:
          'bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.28),_transparent_65%),radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:100%_100%,24px_24px]',
        label: 'Şampiyonlar Gecesi',
      };
    case 'gold_stadium':
      return {
        bgClass:
          'bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.22),_transparent_65%),radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:100%_100%,24px_24px]',
        label: 'Altın Kupa Arenası',
      };
    case 'cyber_arena':
      return {
        bgClass:
          'bg-[radial-gradient(ellipse_at_top,_rgba(192,38,211,0.24),_transparent_65%),radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:100%_100%,22px_22px]',
        label: 'Neon Siber Saha',
      };
    default:
      return {
        bgClass:
          'bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.20),_transparent_65%),radial-gradient(#10b981_1px,transparent_1px)] [background-size:100%_100%,24px_24px]',
        label: 'Klasik Çim Arena',
      };
  }
}

export function getGoalEffectColors(effect?: string): string[] {
  switch (effect) {
    case 'gold_fireworks':
      return ['#fbbf24', '#f59e0b', '#fef08a', '#ffffff'];
    case 'neon_lightning':
      return ['#22d3ee', '#a855f7', '#ec4899', '#38bdf8'];
    case 'flame_burst':
      return ['#ef4444', '#f97316', '#facc15', '#fb7185'];
    default:
      return ['#10b981', '#fbbf24', '#3b82f6', '#ec4899'];
  }
}

export function getCrestBadgeInfo(crest?: string): { icon: string; label: string } | null {
  switch (crest) {
    case 'crest_gold_crown':
      return { icon: '🛡️', label: 'Altın Kraliyet Arması' };
    case 'crest_superlig_star':
      return { icon: '🌟', label: 'Süper Lig Yıldız Arması' };
    case 'crest_euro_conqueror':
      return { icon: '🏆', label: 'Avrupa Fatihi Arması' };
    case 'crest_neon_dragon':
      return { icon: '🐉', label: 'Neon Ejderha Arması' };
    default:
      return null;
  }
}

export function formatTry(price?: number): string {
  if (!price || price <= 0) return '';
  return `₺${price.toFixed(2).replace('.', ',')}`;
}
