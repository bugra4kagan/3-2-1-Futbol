import { MatchPlayerStats, PlayerBadge, PlayerProfile } from './types';

export function getBadgeCategoryLabel(badgeType: PlayerBadge['badgeType']): string {
  switch (badgeType) {
    case 'speed':
      return 'Hız';
    case 'goals':
      return 'Gol';
    case 'comeback':
      return 'Geri Dönüş';
    case 'accuracy':
      return 'İsabet';
    case 'streak':
      return 'Seri';
    case 'clutch':
      return 'Kritik An';
    case 'defense':
      return 'Savunma';
    case 'knowledge':
      return 'Bilgi';
  }
}

export function calculatePlayerBadges(
  player: PlayerProfile,
  stats: MatchPlayerStats,
  opponentStats?: MatchPlayerStats,
  isWinner: boolean = false
): PlayerBadge[] {
  const badges: PlayerBadge[] = [];

  // 1. Hızlı Yanıtlayıcı (Speed reflex badge)
  const isFasterThanOpponent =
    stats.fastestAnswerSec !== null &&
    (opponentStats?.fastestAnswerSec === null ||
      stats.fastestAnswerSec <= (opponentStats?.fastestAnswerSec ?? 99));

  if (
    stats.fastestAnswerSec !== null &&
    (stats.fastestAnswerSec <= 4.5 || isFasterThanOpponent)
  ) {
    badges.push({
      id: 'fastest_answer',
      title: 'Hızlı Yanıtlayıcı',
      subtitle: isFasterThanOpponent
        ? `${stats.fastestAnswerSec.toFixed(1)}s ile maçın en hızlı yanıtı`
        : `${stats.fastestAnswerSec.toFixed(1)}s süper refleks süresi`,
      icon: '⚡',
      badgeType: 'speed',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-400/40',
      textColor: 'text-amber-300',
    });
  }

  // 2. Gol Makinesi (3+ goals scored / dominant scoring)
  const goalsScored = Math.max(player.score, stats.totalCorrect);
  if (player.score >= 3 || stats.totalCorrect >= 3) {
    badges.push({
      id: 'goal_machine',
      title: 'Gol Makinesi',
      subtitle: `${goalsScored} golle rakip savunmayı çaresiz bıraktı`,
      icon: '⚽',
      badgeType: 'goals',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-400/45',
      textColor: 'text-emerald-300',
    });
  }

  // 3. Geri Dönüş Kralı (Trailed during the match and won)
  if (stats.trailedThenWon && isWinner) {
    badges.push({
      id: 'comeback_king',
      title: 'Geri Dönüş Kralı',
      subtitle: 'Gerideyken pes etmeyip maçı çevirdi',
      icon: '👑',
      badgeType: 'comeback',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-400/50',
      textColor: 'text-yellow-300',
    });
  }

  // 4. Durdurulamaz Seri (3+ consecutive round wins)
  if (stats.maxStreak >= 3) {
    badges.push({
      id: 'unstoppable_streak',
      title: 'Durdurulamaz Seri',
      subtitle: `Üst üste ${stats.maxStreak} tur boyunca gol attı`,
      icon: '🔥',
      badgeType: 'streak',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-400/40',
      textColor: 'text-rose-300',
    });
  }

  // 5. Keskin Nişancı (Zero wrong guesses with 2+ correct answers)
  if (stats.totalCorrect >= 2 && stats.totalWrongAttempts === 0) {
    badges.push({
      id: 'sharpshooter',
      title: 'Keskin Nişancı',
      subtitle: 'Maçı sıfır yanlış tahminle tamamladı',
      icon: '🎯',
      badgeType: 'accuracy',
      bgColor: 'bg-teal-500/15',
      borderColor: 'border-teal-400/40',
      textColor: 'text-teal-300',
    });
  }

  // 6. Son Saniye Golcüsü (Clutch answers near round expiration)
  if (stats.clutchAnswers >= 1) {
    badges.push({
      id: 'clutch_scorer',
      title: 'Son Saniye Golcüsü',
      subtitle: 'Süre bitmek üzereyken kritik golü buldu',
      icon: '⏱️',
      badgeType: 'clutch',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-400/40',
      textColor: 'text-cyan-300',
    });
  }

  // 7. Kale Duvarı (Clean sweep victory conceding 0 goals)
  if (
    isWinner &&
    opponentStats &&
    opponentStats.totalCorrect === 0 &&
    goalsScored >= 3
  ) {
    badges.push({
      id: 'clean_sheet',
      title: 'Kale Duvarı',
      subtitle: 'Rakibe tek bir gol şansı bile tanımadı',
      icon: '🛡️',
      badgeType: 'defense',
      bgColor: 'bg-sky-500/15',
      borderColor: 'border-sky-400/40',
      textColor: 'text-sky-300',
    });
  }

  // 8. Futbol Ansiklopedisi (High trivia accuracy & 3+ correct answers)
  if (stats.totalCorrect >= 3 && stats.totalWrongAttempts <= 2) {
    badges.push({
      id: 'football_professor',
      title: 'Futbol Ansiklopedisi',
      subtitle: `${stats.totalCorrect} doğru cevapla bilgi üstünlüğü kurdu`,
      icon: '🧠',
      badgeType: 'knowledge',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-400/40',
      textColor: 'text-purple-300',
    });
  }

  // Fallback badge for active competitors who didn't trigger specialized milestones
  if (badges.length === 0 && stats.totalCorrect >= 1) {
    badges.push({
      id: 'scout',
      title: 'Usta Kaşif',
      subtitle: `${stats.totalCorrect} galibiyetle mücadeleyi tamamladı`,
      icon: '🎖️',
      badgeType: 'knowledge',
      bgColor: 'bg-blue-500/15',
      borderColor: 'border-blue-400/40',
      textColor: 'text-blue-300',
    });
  }

  return badges;
}
