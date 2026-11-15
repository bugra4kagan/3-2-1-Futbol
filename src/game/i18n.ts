export type AppLanguage = 'tr' | 'en' | 'de' | 'es';

export interface LanguageOption {
  id: AppLanguage;
  nativeName: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'tr', nativeName: 'Türkçe', flag: '🇹🇷' },
  { id: 'en', nativeName: 'English', flag: '🇬🇧' },
  { id: 'de', nativeName: 'Deutsch', flag: '🇩🇪' },
  { id: 'es', nativeName: 'Español', flag: '🇪🇸' },
];

const STORAGE_KEY = 'app_language_v1';

export function isSupportedLanguage(value: unknown): value is AppLanguage {
  return value === 'tr' || value === 'en' || value === 'de' || value === 'es';
}

export function loadSavedLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'tr';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(raw) ? raw : 'tr';
  } catch {
    return 'tr';
  }
}

export function saveLanguage(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }
}

const TR_TRANSLATIONS = {
  settings: 'Ayarlar',
  settingsSubtitle: 'Ses, dil ve hesap güvenliği tercihlerini yönet',
  soundSectionTitle: 'Ses Efektleri',
  soundOnDesc: 'Oyun içi düdük, gol ve bildirim sesleri açık',
  soundOffDesc: 'Tüm oyun sesleri sessize alındı',
  soundOnLabel: 'Ses Açık',
  soundOffLabel: 'Ses Kapalı',
  languageSectionTitle: 'Uygulama Dili',
  languageSectionDesc: 'Menü ve arayüz dilini anında değiştir',
  socialSectionTitle: 'Sosyal Medya Hesabı Bağla',
  socialSectionDesc:
    'Puanlarını, yıldız PP’lerini ve mağaza ürünlerini kaybetmemek için hesabını bağla.',
  socialSafeBadge: 'Hesap Güvende ✓',
  socialNotLinked: 'Bağlı değil',
  socialLinkBtn: 'Bağla',
  socialUnlinkBtn: 'Kaldır',
  socialConfirmBtn: 'Onayla & Bağla',
  cancel: 'İptal',
  close: 'Kapat',
  store: 'Mağaza',
  rules: 'Kurallar',
  menu: 'Menü',
  navStats: 'İstatistik',
  navFriends: 'Arkadaşlar',
  navPlay: 'Oyna',
  navLeague: 'Lig',
  navProfile: 'Profil',
  tabStatsTitle: 'İSTATİSTİK',
  tabFriendsTitle: 'ARKADAŞLAR',
  tabLeagueTitle: 'LİG',
  tabProfileTitle: 'PROFİL',
  introBadge: 'GERÇEK ZAMANLI FUTBOL BİLGİ DÜELLOSU',
  introSubtitle: 'İki kulüp, tek ortak futbolcu! İlk 3 olan şampiyonluğu kapar!',
  introStart: 'Oyuna Giriş Yap',
  introLeagues: 'Süper Lig & Top 5 Avrupa Ligi Eşleşmeleri',
  introFooter: '3-2-1 Football Challenge • 2026 Mobil Futbol Bilgi Yarışması',
  lobbyTagline: '5 farklı futbol mini oyunuyla 1v1 veya bota karşı yarış! İlk 3 olan şampiyon!',
  lobbyDailyReward: 'Günlük Ödül!',
  lobbyDailyDone: 'Seri ✓',
  lobbyQuests: 'Görevler',
  lobbyOnlineTitle: "1'e 1 Çevrim İçi Yarışma",
  lobbyOnlineDesc: 'İki Kulüp, Futbolcuyu Tahmin Et, XOX, Kariyer Yolu & Ülke+Kulüp — eşleş!',
  lobbyBotTitle: 'Bot ile Antrenman (Solo)',
  lobbyBotDesc: 'Çırak, Şampiyon veya Efsane bota karşı yarış',
  lobbyRoomTitle: 'Arkadaşla Özel Oda',
  lobbyRoomDesc: 'Oyun türünü seç, oda koduyla arkadaşını davet et',
  lobbyTournamentTitle: '8 Kişilik Turnuva',
  lobbyTournamentDesc: '2.000 Coin ile katıl 6.000 Coin kazan veya arkadaşlarınla turnuva kur!',
  lobbyAdTag: 'SPONSORLU ALAN • REKLAM',
  lobbyAdDesc: 'Reklamsız kesintisiz maç keyfi için VIP paketi keşfet!',
  lobbyRemoveAds: 'Reklamı Kaldır',
} as const;

export type TranslationKey = keyof typeof TR_TRANSLATIONS;

export const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = {
  tr: TR_TRANSLATIONS,
  en: {
    settings: 'Settings',
    settingsSubtitle: 'Manage sound, language and account backup preferences',
    soundSectionTitle: 'Sound Effects',
    soundOnDesc: 'Whistle, goal and UI sound effects are enabled',
    soundOffDesc: 'All game sound effects are muted',
    soundOnLabel: 'Sound On',
    soundOffLabel: 'Muted',
    languageSectionTitle: 'App Language',
    languageSectionDesc: 'Switch interface language immediately',
    socialSectionTitle: 'Link Social Account',
    socialSectionDesc:
      'Connect a social account to back up your points, Star PPs and store items.',
    socialSafeBadge: 'Account Protected ✓',
    socialNotLinked: 'Not linked',
    socialLinkBtn: 'Link',
    socialUnlinkBtn: 'Unlink',
    socialConfirmBtn: 'Confirm & Link',
    cancel: 'Cancel',
    close: 'Close',
    store: 'Store',
    rules: 'Rules',
    menu: 'Menu',
    navStats: 'Stats',
    navFriends: 'Friends',
    navPlay: 'Play',
    navLeague: 'League',
    navProfile: 'Profile',
    tabStatsTitle: 'STATS',
    tabFriendsTitle: 'FRIENDS',
    tabLeagueTitle: 'LEAGUE',
    tabProfileTitle: 'PROFILE',
    introBadge: 'REAL-TIME FOOTBALL TRIVIA DUEL',
    introSubtitle: 'Two clubs, one shared footballer! First to 3 wins the trophy!',
    introStart: 'Enter Game',
    introLeagues: 'Süper Lig & Top 5 European League Matchups',
    introFooter: '3-2-1 Football Challenge • 2026 Mobile Football Trivia',
    lobbyTagline: 'Compete 1v1 or vs Bot across 5 football minigames! First to 3 wins!',
    lobbyDailyReward: 'Daily Reward!',
    lobbyDailyDone: 'Streak ✓',
    lobbyQuests: 'Quests',
    lobbyOnlineTitle: '1v1 Online Challenge',
    lobbyOnlineDesc: 'Two Clubs, Guess the Player, XOX, Career Path & Country+Club — match now!',
    lobbyBotTitle: 'Bot Practice (Solo)',
    lobbyBotDesc: 'Challenge Rookie, Champion or Legend AI',
    lobbyRoomTitle: 'Private Friend Room',
    lobbyRoomDesc: 'Pick a game mode and invite your friend with a room code',
    lobbyTournamentTitle: '8-Player Tournament',
    lobbyTournamentDesc: 'Enter with 2,000 Coins to win 6,000 Coins or host with friends!',
    lobbyAdTag: 'SPONSORED • AD',
    lobbyAdDesc: 'Unlock VIP Ad-Free for uninterrupted matches!',
    lobbyRemoveAds: 'Remove Ads',
  },
  de: {
    settings: 'Einstellungen',
    settingsSubtitle: 'Ton, Sprache und Kontosicherung verwalten',
    soundSectionTitle: 'Soundeffekte',
    soundOnDesc: 'Pfiff-, Tor- und UI-Sounds sind aktiviert',
    soundOffDesc: 'Alle Spielgeräusche sind stummgeschaltet',
    soundOnLabel: 'Ton An',
    soundOffLabel: 'Stumm',
    languageSectionTitle: 'App-Sprache',
    languageSectionDesc: 'Oberflächensprache sofort wechseln',
    socialSectionTitle: 'Konto Verknüpfen',
    socialSectionDesc:
      'Verknüpfe ein Konto, um Punkte, Star-Avatare und Shop-Artikel zu sichern.',
    socialSafeBadge: 'Konto Gesichert ✓',
    socialNotLinked: 'Nicht verknüpft',
    socialLinkBtn: 'Verbinden',
    socialUnlinkBtn: 'Trennen',
    socialConfirmBtn: 'Bestätigen',
    cancel: 'Abbrechen',
    close: 'Schließen',
    store: 'Shop',
    rules: 'Regeln',
    menu: 'Menü',
    navStats: 'Statistik',
    navFriends: 'Freunde',
    navPlay: 'Spielen',
    navLeague: 'Liga',
    navProfile: 'Profil',
    tabStatsTitle: 'STATISTIK',
    tabFriendsTitle: 'FREUNDE',
    tabLeagueTitle: 'LIGA',
    tabProfileTitle: 'PROFIL',
    introBadge: 'ECHTZEIT-FUSSBALL-QUIZ-DUELL',
    introSubtitle: 'Zwei Vereine, ein gemeinsamer Spieler! Wer zuerst 3 holt, gewinnt!',
    introStart: 'Spiel Starten',
    introLeagues: 'Süper Lig & Top-5-Ligen Europas',
    introFooter: '3-2-1 Football Challenge • 2026 Mobiles Fußball-Quiz',
    lobbyTagline: 'Spiele 1v1 oder gegen Bots in 5 Fußball-Minispielen! Zuerst 3 gewinnt!',
    lobbyDailyReward: 'Tagesbonus!',
    lobbyDailyDone: 'Serie ✓',
    lobbyQuests: 'Aufgaben',
    lobbyOnlineTitle: '1v1 Online-Duell',
    lobbyOnlineDesc: 'Zwei Klubs, Spieler erraten, XOX, Karrierepfad & Land+Klub!',
    lobbyBotTitle: 'Bot-Training (Solo)',
    lobbyBotDesc: 'Spiele gegen Neuling, Champion oder Legende',
    lobbyRoomTitle: 'Privater Raum',
    lobbyRoomDesc: 'Modus wählen und Freunde per Raumcode einladen',
    lobbyTournamentTitle: '8-Spieler-Turnier',
    lobbyTournamentDesc: 'Mit 2.000 Coins teilnehmen, 6.000 gewinnen oder mit Freunden spielen!',
    lobbyAdTag: 'GESPONSERTER BEREICH • WERBUNG',
    lobbyAdDesc: 'Entdecke VIP Werbefrei für ungestörte Matches!',
    lobbyRemoveAds: 'Werbung aus',
  },
  es: {
    settings: 'Ajustes',
    settingsSubtitle: 'Gestiona sonido, idioma y respaldo de cuenta',
    soundSectionTitle: 'Efectos de Sonido',
    soundOnDesc: 'Silbatos, goles y efectos activados',
    soundOffDesc: 'Todos los sonidos están silenciados',
    soundOnLabel: 'Sonido Sí',
    soundOffLabel: 'Silencio',
    languageSectionTitle: 'Idioma de la App',
    languageSectionDesc: 'Cambia el idioma de la interfaz al instante',
    socialSectionTitle: 'Vincular Cuenta Social',
    socialSectionDesc:
      'Vincula una cuenta para guardar tus puntos, avatares y artículos.',
    socialSafeBadge: 'Cuenta Protegida ✓',
    socialNotLinked: 'No vinculada',
    socialLinkBtn: 'Vincular',
    socialUnlinkBtn: 'Quitar',
    socialConfirmBtn: 'Confirmar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    store: 'Tienda',
    rules: 'Reglas',
    menu: 'Menú',
    navStats: 'Estadísticas',
    navFriends: 'Amigos',
    navPlay: 'Jugar',
    navLeague: 'Liga',
    navProfile: 'Perfil',
    tabStatsTitle: 'ESTADÍSTICAS',
    tabFriendsTitle: 'AMIGOS',
    tabLeagueTitle: 'LIGA',
    tabProfileTitle: 'PERFIL',
    introBadge: 'DUELO DE TRIVIA DE FÚTBOL EN VIVO',
    introSubtitle: '¡Dos clubes, un futbolista en común! ¡El primero en llegar a 3 gana!',
    introStart: 'Entrar al Juego',
    introLeagues: 'Süper Lig y las 5 Grandes Ligas Europeas',
    introFooter: '3-2-1 Football Challenge • 2026 Trivia de Fútbol',
    lobbyTagline: '¡Compite 1v1 o contra Bots en 5 minijuegos! ¡El primero en 3 gana!',
    lobbyDailyReward: '¡Premio Diario!',
    lobbyDailyDone: 'Racha ✓',
    lobbyQuests: 'Misiones',
    lobbyOnlineTitle: 'Desafío Online 1v1',
    lobbyOnlineDesc: 'Dos Clubes, Adivina el Jugador, XOX, Trayectoria y País+Club',
    lobbyBotTitle: 'Práctica vs Bot (Solo)',
    lobbyBotDesc: 'Reta a bots Novato, Campeón o Leyenda',
    lobbyRoomTitle: 'Sala Privada con Amigos',
    lobbyRoomDesc: 'Elige juego e invita con código de sala',
    lobbyTournamentTitle: 'Torneo de 8 Jugadores',
    lobbyTournamentDesc: '¡Participa con 2.000 Coins y gana 6.000 o crea con amigos!',
    lobbyAdTag: 'ESPACIO PATROCINADO • ANUNCIO',
    lobbyAdDesc: '¡Activa VIP Sin Anuncios para partidas sin cortes!',
    lobbyRemoveAds: 'Quitar Anuncios',
  },
};

export function t(lang: AppLanguage, key: TranslationKey): string {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.tr[key];
}
