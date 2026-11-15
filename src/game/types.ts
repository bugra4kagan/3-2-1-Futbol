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

export interface Player {
  id: string;
  name: string;
  commonName?: string;
  aliases: string[];
  nationality: string;
  flag: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  era?: string;
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

export interface PlayerBadge {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badgeType: 'speed' | 'accuracy' | 'knowledge' | 'comeback' | 'clutch' | 'streak';
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

export type MainTab = 'stats' | 'friends' | 'play' | 'league' | 'profile';

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
    | 'ad_free'
    | 'coin_pack'
    | 'energy_pack'
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
