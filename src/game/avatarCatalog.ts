import { PLAYER_ASSETS } from './playerAssets';

export interface StarterPpAvatarDef {
  playerId: string;
  avatarValue: string;
  name: string;
  shortName: string;
}

/**
 * Başlangıçta ücretsiz seçilebilen gerçek futbolcu anime PP'leri.
 * (Mağazadaki ücretli STAR_PP_AVATARS kataloğundan tamamen ayrıdır.)
 */
export const FREE_STARTER_PLAYER_AVATARS: StarterPpAvatarDef[] = [
  {
    playerId: 'hakan_calhanoglu',
    avatarValue: 'pp:hakan_calhanoglu',
    name: 'Hakan Çalhanoğlu',
    shortName: 'Çalhanoğlu',
  },
  {
    playerId: 'ferdi_kadioglu',
    avatarValue: 'pp:ferdi_kadioglu',
    name: 'Ferdi Kadıoğlu',
    shortName: 'Ferdi',
  },
  {
    playerId: 'kenan_yildiz',
    avatarValue: 'pp:kenan_yildiz',
    name: 'Kenan Yıldız',
    shortName: 'Kenan',
  },
  {
    playerId: 'baris_alper_yilmaz',
    avatarValue: 'pp:baris_alper_yilmaz',
    name: 'Barış Alper Yılmaz',
    shortName: 'Barış Alper',
  },
  {
    playerId: 'kerem_akturkoglu',
    avatarValue: 'pp:kerem_akturkoglu',
    name: 'Kerem Aktürkoğlu',
    shortName: 'Kerem',
  },
  {
    playerId: 'mauro_icardi',
    avatarValue: 'pp:mauro_icardi',
    name: 'Mauro Icardi',
    shortName: 'Icardi',
  },
  {
    playerId: 'dusan_tadic',
    avatarValue: 'pp:dusan_tadic',
    name: 'Dušan Tadić',
    shortName: 'Tadić',
  },
  {
    playerId: 'orkun_kokcu',
    avatarValue: 'pp:orkun_kokcu',
    name: 'Orkun Kökçü',
    shortName: 'Orkun',
  },
];

/** Yeni başlayan oyuncuya otomatik atanan gerçek futbolcu avatarı */
export const DEFAULT_STARTER_AVATAR = FREE_STARTER_PLAYER_AVATARS[0].avatarValue;

/** Yalnızca futbol ekipmanı / kupa / top ikonları (jenerik insan çizimi içermez) */
export const FREE_ICON_AVATARS = ['⚽', '🏆', '👟', '👕', '🧤', '🏟️'];

export const FREE_AVATARS = [
  ...FREE_STARTER_PLAYER_AVATARS.map((item) => item.avatarValue),
  ...FREE_ICON_AVATARS,
];

export interface StarPpAvatarDef {
  giftId: string;
  playerId: string;
  avatarValue: string;
  name: string;
  costCoins: number;
  priceTry: number;
  description: string;
}

export const STAR_PP_AVATARS: StarPpAvatarDef[] = [
  {
    giftId: 'gift_pp_arda_guler',
    playerId: 'arda_guler',
    avatarValue: 'pp:arda_guler',
    name: 'Arda Güler PP',
    costCoins: 1500,
    priceTry: 49.99,
    description: 'Real Madrid ve Milli Takım yıldızı Arda Güler profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_victor_osimhen',
    playerId: 'victor_osimhen',
    avatarValue: 'pp:victor_osimhen',
    name: 'Victor Osimhen PP',
    costCoins: 2000,
    priceTry: 54.99,
    description: 'Maskeli golcü Victor Osimhen profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_mohamed_salah',
    playerId: 'mohamed_salah',
    avatarValue: 'pp:mohamed_salah',
    name: 'Mohamed Salah PP',
    costCoins: 2500,
    priceTry: 59.99,
    description: 'Mısır Kralı Mohamed Salah özel profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_kylian_mbappe',
    playerId: 'kylian_mbappe',
    avatarValue: 'pp:kylian_mbappe',
    name: 'Kylian Mbappé PP',
    costCoins: 4500,
    priceTry: 69.99,
    description: 'Süperstar Kylian Mbappé profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_erling_haaland',
    playerId: 'erling_haaland',
    avatarValue: 'pp:erling_haaland',
    name: 'Erling Haaland PP',
    costCoins: 4000,
    priceTry: 74.99,
    description: 'Gol makinesi Erling Haaland profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_jude_bellingham',
    playerId: 'jude_bellingham',
    avatarValue: 'pp:jude_bellingham',
    name: 'Jude Bellingham PP',
    costCoins: 3500,
    priceTry: 79.99,
    description: 'Real Madrid yıldızı Jude Bellingham profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_lionel_messi',
    playerId: 'lionel_messi',
    avatarValue: 'pp:lionel_messi',
    name: 'Lionel Messi PP',
    costCoins: 5000,
    priceTry: 89.99,
    description: 'Efsane 10 numara Lionel Messi profil fotoğrafı',
  },
  {
    giftId: 'gift_pp_cristiano_ronaldo',
    playerId: 'cristiano_ronaldo',
    avatarValue: 'pp:cristiano_ronaldo',
    name: 'Cristiano Ronaldo PP',
    costCoins: 5000,
    priceTry: 94.99,
    description: 'CR7 efsanesi Cristiano Ronaldo profil fotoğrafı',
  },
];

export function isPhotoAvatar(avatar?: string): boolean {
  return Boolean(avatar && avatar.startsWith('pp:'));
}

export function resolveAvatarPhotoUrl(avatar?: string): string | null {
  if (!avatar || !avatar.startsWith('pp:')) return null;
  const pid = avatar.slice(3);
  return PLAYER_ASSETS[pid]?.photoUrl || `/players/${pid}.png`;
}

export function getAvatarDisplayLabel(avatar?: string): string {
  if (!avatar) return '⚽';
  if (avatar.startsWith('pp:')) {
    const pid = avatar.slice(3);
    const starFound = STAR_PP_AVATARS.find((item) => item.playerId === pid);
    if (starFound) return `⭐ (${starFound.name.replace(' PP', '')})`;
    const starterFound = FREE_STARTER_PLAYER_AVATARS.find((item) => item.playerId === pid);
    if (starterFound) return `⚽ (${starterFound.name})`;
    return '⭐';
  }
  return avatar;
}
