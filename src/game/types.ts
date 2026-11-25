export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string;
  countryFlag: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
  founded: number;
  stadium: string;
}

export interface CareerHistoryEntry {
  club: string;
  clubId?: string;
  years: string;
  countryFlag: string;
  isYouth?: boolean;
}

export type HairStyle =
  | 'braided-bun'
  | 'long-blonde'
  | 'curly-afro'
  | 'short-fade'
  | 'buzzcut'
  | 'messy-medium'
  | 'bald';

export type FacialHair = 'none' | 'beard' | 'stubble' | 'mustache';

export type PlayerSignatureTrait =
  | 'none'
  | 'mask'
  | 'viking'
  | 'commander'
  | 'headband'
  | 'legend_crown'
  | 'keeper_aura';

export interface PlayerAppearance {
  hairStyle: HairStyle;
  hairColor: string;
  skinTone: string;
  facialHair: FacialHair;
  jerseyColors: [string, string];
  eyeColor?: string;
  signature?: PlayerSignatureTrait;
}

export interface Player {
  id: string;
  name: string;
  commonName?: string;
  aliases: string[];
  nationality: string;
  flag: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  era?: string;
  photoUrl?: string;
  age?: number;
  shirtNumber?: number;
  clubName?: string;
  clubId?: string;
  league?: string;
  careerHistory?: CareerHistoryEntry[];
  appearance?: PlayerAppearance;
}

export interface MatchPairing {
  id: string;
  club1Id: string;
  club2Id: string;
  validPlayerIds: string[];
  funFact?: string;
}

export type GameMode = 'bot' | 'online_match' | 'online_room';

export type MinigameType = 'two_clubs' | 'silhouette' | 'xox' | 'career' | 'country_club';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type SilhouettePose =
  | 'siu'
  | 'dribble'
  | 'viking'
  | 'mask'
  | 'arms_wide'
  | 'captain'
  | 'gk_save'
  | 'sniper';

export interface SilhouetteChallenge {
  id: string;
  playerId: string;
  jerseyNumber: number;
  pose: SilhouettePose;
  hintClubId: string;
  traitHint: string;
  funFact?: string;
}

export interface CareerStep {
  clubId?: string;
  clubName: string;
  years: string;
  countryFlag: string;
}

export interface CareerChallenge {
  id: string;
  playerId: string;
  steps: CareerStep[];
  funFact?: string;
}

export interface CountryClubChallenge {
  id: string;
  country: string;
  countryFlag: string;
  clubId: string;
  validPlayerIds: string[];
  funFact?: string;
}

export interface XoxCondition {
  type: 'club' | 'teammate' | 'country';
  id: string;
  label: string;
  sublabel?: string;
  flag?: string;
}

export interface XoxBoardChallenge {
  id: string;
  title: string;
  rows: [XoxCondition, XoxCondition, XoxCondition];
  cols: [XoxCondition, XoxCondition, XoxCondition];
  cellValidPlayerIds: Record<string, string[]>;
}

export interface XoxCellMark {
  ownerId: string;
  symbol: 'X' | 'O';
  playerName: string;
}

export interface XoxRuntimeState {
  board: (XoxCellMark | null)[][];
  currentTurnPlayerId: string;
  turnTimeRemaining: number;
  winningCells: [number, number][] | null;
}

export interface MinigameRoundPayload {
  minigameType: MinigameType;
  pairing?: MatchPairing;
  silhouette?: SilhouetteChallenge;
  career?: CareerChallenge;
  countryClub?: CountryClubChallenge;
  xoxBoard?: XoxBoardChallenge;
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  score: number;
  favoriteClubId?: string;
  isReady?: boolean;
  streak?: number;
  accountStats?: {
    totalMatches: number;
    totalWins: number;
    badgesEarned: string[];
  };
}

export interface MatchPlayerStats {
  fastestAnswerSec: number | null;
  totalCorrect: number;
  totalWrongAttempts: number;
  currentStreak: number;
  maxStreak: number;
  clutchAnswers: number;
  trailedThenWon: boolean;
}

export interface MatchRoundHighlight {
  roundNumber: number;
  minigameType: MinigameType;
  winnerPlayerId: string | null;
  winnerName?: string;
  acceptedAnswer?: string;
  elapsedSec: number | null;
  wasClutch?: boolean;
  reason: 'scored' | 'timeout' | 'attempts_exhausted' | 'draw';
  scoreAfter: { p1: number; p2: number };
}

export interface PlayerBadge {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badgeType:
    | 'speed'
    | 'goals'
    | 'accuracy'
    | 'knowledge'
    | 'comeback'
    | 'clutch'
    | 'streak'
    | 'defense';
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export interface RoundState {
  roundNumber: number;
  totalRounds: number;
  club1: Club;
  club2: Club;
  countdown: number;
  status: 'countdown' | 'playing' | 'round_ended' | 'match_ended';
  timeRemaining: number;
  winnerPlayerId: string | null;
  acceptedAnswer?: string;
  revealedPlayers: Player[];
}

export type MainTab = 'play' | 'league' | 'profile';

export type QuestMetric =
  | 'matches_played'
  | 'matches_won'
  | 'correct_answers'
  | 'minigame_played';

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardPoints: number;
  claimed: boolean;
  icon: string;
}

export interface DailyLoginState {
  streakDays: number;
  lastClaimDate: string | null;
}

export type StoreCategory =
  | 'featured'
  | 'ads_coins'
  | 'crests_frames'
  | 'themes_effects'
  | 'pp_badges';

export type SocialProvider = 'google' | 'apple' | 'instagram' | 'x';

export interface LinkedSocialAccount {
  provider: SocialProvider;
  handle: string;
  linkedAt: string;
}

export interface ShopGiftItem {
  id: string;
  title: string;
  description: string;
  costCoins: number;
  priceTry?: number;
  icon: string;
  category?: StoreCategory;
  type:
    | 'title'
    | 'avatar'
    | 'avatar_gear'
    | 'ad_free'
    | 'vip_bundle'
    | 'coin_pack'
    | 'energy_pack'
    | 'league_shield'
    | 'extra_time_card'
    | 'multiplier_2x'
    | 'crest'
    | 'frame'
    | 'pitch_theme'
    | 'goal_effect'
    | 'badge';
  value: string;
  quantity?: number;
}

export interface FriendEntry {
  id: string;
  friendCode: string;
  name: string;
  avatar: string;
  weeklyPoints: number;
  totalPoints: number;
  statusText: string;
  isOnline: boolean;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequestEntry {
  id: string;
  fromPlayerId: string;
  fromFriendCode: string;
  fromName: string;
  fromAvatar: string;
  toPlayerId?: string;
  toFriendCode?: string;
  toName: string;
  toAvatar?: string;
  weeklyPoints?: number;
  totalPoints?: number;
  subtitle?: string;
  status: FriendRequestStatus;
  isBot?: boolean;
  createdAt: number;
}

export type WeeklyLeagueTierId =
  | 'amateur'
  | 'league_2'
  | 'league_1'
  | 'super_lig'
  | 'champions_league';

export interface WeeklyLeagueTierInfo {
  id: WeeklyLeagueTierId;
  name: string;
  shortName: string;
  icon: string;
  order: number;
  promotionRewardCoins: number;
  stayRewardCoins: number;
  accentClass: string;
  badgeBgClass: string;
  minBotWeeklyPoints: number;
  maxBotWeeklyPoints: number;
}

export interface LeagueSeasonResetNotice {
  weekKey: string;
  previousTierId: WeeklyLeagueTierId;
  newTierId: WeeklyLeagueTierId;
  outcome: 'promoted' | 'stayed' | 'relegated';
  finalRank: number;
  rewardCoins: number;
  previousWeeklyPoints: number;
}

export interface LeaguePlayerEntry {
  id: string;
  friendCode?: string;
  name: string;
  avatar: string;
  weeklyPoints: number;
  totalPoints: number;
  subtitle?: string;
  hasCrown?: boolean;
  isUser?: boolean;
  isFriend?: boolean;
  isBot?: boolean;
  favoriteClubId?: string;
  equippedCrest?: string;
  equippedFrame?: string;
  equippedBadge?: string;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  winStreak?: number;
  bestWinStreak?: number;
  totalCorrectAnswers?: number;
  totalWrongAttempts?: number;
  fastestAnswerSec?: number | null;
  clutchAnswers?: number;
  minigameMatchCounts?: Record<MinigameType, number>;
  dailyStreakDays?: number;
  tournamentWins?: number;
  tournamentsPlayed?: number;
}

export interface PublicPlayerProfile {
  id: string;
  usernameKey?: string;
  friendCode?: string;
  name: string;
  avatar: string;
  favoriteClubId?: string;
  subtitle?: string;
  equippedCrest?: string;
  equippedFrame?: string;
  equippedBadge?: string;
  hasCrown?: boolean;
  weeklyPoints: number;
  totalPoints: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  totalCorrectAnswers: number;
  totalWrongAttempts: number;
  fastestAnswerSec: number | null;
  clutchAnswers: number;
  minigameMatchCounts: Record<MinigameType, number>;
  dailyStreakDays: number;
  tournamentWins: number;
  tournamentsPlayed: number;
  updatedAt: number;
  isOnline?: boolean;
  isBot?: boolean;
}

export interface UserProgression {
  friendCode: string;
  coins: number;
  weeklyPoints: number;
  totalPoints: number;
  weekKey: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  totalCorrectAnswers: number;
  totalWrongAttempts: number;
  fastestAnswerSec: number | null;
  clutchAnswers: number;
  minigameMatchCounts: Record<MinigameType, number>;
  modeWinCounts?: Partial<Record<MinigameType, number>>;
  unlockedAchievements?: string[];
  claimedAchievements?: string[];
  dailyLogin: DailyLoginState;
  questsDate: string;
  dailyQuests: DailyQuest[];
  unlockedGiftIds: string[];
  equippedTitle?: string;
  adFree?: boolean;
  energyDrinks?: number;
  multiplier2xMatches?: number;
  permanentMultiplier2x?: boolean;
  equippedCrest?: string;
  equippedFrame?: string;
  equippedPitchTheme?: string;
  equippedGoalEffect?: string;
  equippedBadge?: string;
  linkedAccounts?: LinkedSocialAccount[];
  socialBonusClaimed?: boolean;
  tournamentWins?: number;
  tournamentsPlayed?: number;
  friends: FriendEntry[];
  outgoingFriendRequests?: FriendRequestEntry[];
  incomingFriendRequests?: FriendRequestEntry[];
  dailyChallengeHistory?: Record<string, DailyChallengeRecord>;
  dailyChallengeLastPlayedAt?: number;
  dailyEnergy?: number;
  energyLastResetDate?: string;
  wheelLastFreeSpinDate?: string;
  wheelLastFreeSpinAt?: number;
  wheelAdSpinsDate?: string;
  wheelAdSpinsUsed?: number;
  freeJokerTickets?: number;
  leagueShields?: number;
  extraTimeCards?: number;
  leagueTierId?: WeeklyLeagueTierId;
  lastSeasonResetNotice?: LeagueSeasonResetNotice | null;
}

export type WheelRewardType = 'coins' | 'energy' | 'joker';

export interface WheelSliceDefinition {
  id: string;
  index: number;
  label: string;
  shortLabel: string;
  rewardType: WheelRewardType;
  amount: number;
  weight: number;
  tier: 'standard' | 'rare' | 'jackpot';
  accentColor: string;
  sliceBgStart: string;
  sliceBgEnd: string;
  badgeText?: string;
}

export interface DailyChallengeRecord {
  dateKey: string;
  puzzleNumber: number;
  correctCount: number;
  totalRounds: number;
  elapsedSec: number;
  rewardCoins: number;
  rewardPoints: number;
  completedAt: number;
}

export type TournamentMode = 'open_cup' | 'friends_cup';
export type TournamentStage = 'qf' | 'sf' | 'final' | 'completed';

export interface TournamentParticipant {
  id: string;
  name: string;
  avatar: string;
  isUser: boolean;
  isBot: boolean;
  seed: number;
}

export interface TournamentMatchSlot {
  id: string;
  stage: 'qf' | 'sf' | 'final';
  matchIndex: number;
  p1: TournamentParticipant | null;
  p2: TournamentParticipant | null;
  winnerId: string | null;
  status: 'pending' | 'ready' | 'completed';
}

export interface TournamentBracketState {
  id: string;
  code?: string;
  title: string;
  mode: TournamentMode;
  minigameType: MinigameType;
  entryFeeCoins: number;
  prizeCoins: number;
  participants: TournamentParticipant[];
  qf: TournamentMatchSlot[];
  sf: TournamentMatchSlot[];
  finalMatch: TournamentMatchSlot;
  currentStage: TournamentStage;
  status: 'lobby' | 'active' | 'eliminated' | 'won';
  championId: string | null;
  userPlacementLabel?: string;
}

export type FriendNotificationType = 'tournament_started' | 'high_score';

export interface FriendActivityEvent {
  id: string;
  type: FriendNotificationType;
  actorId: string;
  actorFriendCode?: string;
  actorName: string;
  actorAvatar: string;
  title: string;
  message: string;
  tournamentCode?: string;
  tournamentTitle?: string;
  minigameType?: MinigameType;
  scoreValue?: number;
  createdAt: number;
}

export interface ToastItem {
  id: string;
  eventId?: string;
  type: FriendNotificationType;
  actorId?: string;
  actorFriendCode?: string;
  actorName: string;
  actorAvatar: string;
  title: string;
  message: string;
  badgeLabel: string;
  tournamentCode?: string;
  minigameType?: MinigameType;
  scoreValue?: number;
  createdAt: number;
  durationMs: number;
}

