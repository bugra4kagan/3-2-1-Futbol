import { MatchPlayerStats, PlayerBadge, PlayerProfile } from './types';

export function calculatePlayerBadges(
  player: PlayerProfile,
  stats: MatchPlayerStats,
  opponentStats?: MatchPlayerStats,
  isWinner: boolean = false
): PlayerBadge[] {
  const badges: PlayerBadge[] = [];

  // 1. En Hızlı Cevaplayan (Şimşek Refleks)
  const isFasterThanOpponent =
    stats.fastestAnswerSec !== null &&
    (opponentStats?.fastestAnswerSec === null ||
      stats.fastestAnswerSec <= (opponentStats?.fastestAnswerSec ?? 99));

  if (stats.fastestAnswerSec !== null && (stats.fastestAnswerSec <= 4.5 || isFasterThanOpponent)) {
    badges.push({
      id: 'fastest_answer',
      title: 'Şimşek Refleks',
      subtitle: `${stats.fastestAnswerSec.toFixed(1)}s ile maçın en hızlı cevabı`,
      icon: '⚡',
      badgeType: 'speed',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-400/40',
      textColor: 'text-amber-300',
    });
  }

  // 2. Futbol Ansiklopedisi (İlk 3 olan formatında 3 doğru cevapla şampiyonluk)
  if (stats.totalCorrect >= 3) {
    badges.push({
      id: 'football_professor',
      title: 'Futbol Ansiklopedisi',
      subtitle: `${stats.totalCorrect} galibiyetle maçı domine etti`,
      icon: '🧠',
      badgeType: 'knowledge',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-400/40',
      textColor: 'text-purple-300',
    });
  }

  // 3. Durdurulamaz Seri (3+ tur üst üste doğru)
  if (stats.maxStreak >= 3) {
    badges.push({
      id: 'unstoppable_streak',
      title: 'Durdurulamaz Seri',
      subtitle: `${stats.maxStreak} tur üst üste turu kazandı`,
      icon: '🔥',
      badgeType: 'streak',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-400/40',
      textColor: 'text-rose-300',
    });
  }

  // 4. Keskin Nişancı (Hatasız Tahmin - en az 2 doğru ve 0 yanlış deneme)
  if (stats.totalCorrect >= 2 && stats.totalWrongAttempts === 0) {
    badges.push({
      id: 'sharpshooter',
      title: 'Keskin Nişancı',
      subtitle: 'Maçı sıfır yanlış tahminle tamamladı',
      icon: '🎯',
      badgeType: 'accuracy',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-400/40',
      textColor: 'text-emerald-300',
    });
  }

  // 5. Son Saniye Golcüsü (Clutch answers: sürenin son 4 saniyesinde bilinen cevap)
  if (stats.clutchAnswers >= 1) {
    badges.push({
      id: 'clutch_scorer',
      title: 'Son Saniye Golcüsü',
      subtitle: 'Sürenin bitmesine ramak kala turu kopardı',
      icon: '⏱️',
      badgeType: 'clutch',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-400/40',
      textColor: 'text-cyan-300',
    });
  }

  // 6. Geri Dönüş Kralı (Gerideyken öne geçip kazanan)
  if (stats.trailedThenWon && isWinner) {
    badges.push({
      id: 'comeback_king',
      title: 'Geri Dönüş Kralı',
      subtitle: 'Geriden gelerek maçı şampiyonlukla tamamladı',
      icon: '👑',
      badgeType: 'comeback',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-400/50',
      textColor: 'text-yellow-300',
    });
  }

  // Fallback badge if player was an active competitor but didn't hit extreme milestones
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
