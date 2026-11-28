import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { MatchPlayerStats, MinigameType, PlayerProfile } from '../game/types';
import { getMinigameMeta } from '../game/minigameEngine';
import { getCrestBadgeInfo } from '../game/storeCatalog';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { useLanguage } from '../game/LanguageContext';
import { PlayerAvatar } from './PlayerAvatar';

interface ScoreBoardProps {
  player1: PlayerProfile;
  player2: PlayerProfile;
  roundNumber: number;
  totalRounds: number;
  timeRemaining: number;
  minigameType?: MinigameType;
  fastComboStreak?: number;
  isBotMatch?: boolean;
  botStatus?: 'idle' | 'thinking' | 'answered';
  player1Stats?: MatchPlayerStats;
  player2Stats?: MatchPlayerStats;
  player1Frame?: string;
  player1Crest?: string;
  player1Badge?: string;
  compact?: boolean;
  ultraCompact?: boolean;
  onOpenSettings: () => void;
  onExit: () => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = React.memo(({
  player1,
  player2,
  roundNumber,
  timeRemaining,
  minigameType = 'two_clubs',
  isBotMatch = false,
  botStatus = 'idle',
  player1Stats,
  player2Stats,
  player1Frame,
  player1Crest,
  player1Badge,
  compact = false,
  ultraCompact = false,
  onOpenSettings,
  onExit,
}) => {
  const { t } = useLanguage();
  const crestInfo = getCrestBadgeInfo(player1Crest);
  const p1Name = sanitizePublicDisplayName(player1.name, player1.id);
  const p2Name = sanitizePublicDisplayName(player2.name, player2.id);
  const p1Leading = player1.score > player2.score;
  const p2Leading = player2.score > player1.score;

  const p1Streak = player1Stats?.currentStreak ?? 0;
  const p2Streak = player2Stats?.currentStreak ?? 0;
  const p1Correct = player1Stats?.totalCorrect ?? player1.score;
  const p2Correct = player2Stats?.totalCorrect ?? player2.score;

  const maxRoundTime = minigameType === 'silhouette' ? 120 : 15;
  const isLowTime =
    (minigameType === 'silhouette' ? timeRemaining <= 15 : timeRemaining <= 5) &&
    timeRemaining > 0;
  const formattedTime =
    timeRemaining >= 60
      ? `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`
      : `${Math.max(0, timeRemaining)}s`;
  const gameMeta = getMinigameMeta(minigameType);

  return (
    <header
      className={`shrink-0 z-30 w-full max-w-[560px] mx-auto px-2 sm:px-3 bg-[#0E3120]/95 border-b border-[#E5B94F]/30 ${
        ultraCompact
          ? 'pt-[max(0.2rem,env(safe-area-inset-top))] pb-1'
          : compact
          ? 'pt-[max(0.35rem,calc(env(safe-area-inset-top)+0.2rem))] pb-1'
          : 'pt-[max(0.65rem,calc(env(safe-area-inset-top)+0.4rem))] pb-1.5'
      }`}
    >
      {/* Top utility bar */}
      <div
        className={`flex items-center justify-between gap-1 sm:gap-2 text-xs text-[#F5F3EB] font-semibold ${
          ultraCompact ? 'mb-1' : compact ? 'mb-1.5' : 'mb-2 sm:mb-2.5'
        }`}
      >
        <button
          type="button"
          data-testid="match-exit-btn"
          onClick={onExit}
          className={`flex items-center gap-1 px-2 sm:px-3 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#F5F3EB]/20 transition active:scale-95 text-[#FFFFFF] whitespace-nowrap shrink-0 cursor-pointer touch-manipulation ${
            compact ? 'min-h-[34px] py-1' : 'min-h-[38px] sm:min-h-[42px] py-1.5'
          }`}
          title="Maçtan Çık"
          aria-label="Maçtan Çık"
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#C4D6CA]" />
          <span className="font-bold hidden min-[350px]:inline">{t('menu')}</span>
        </button>

        <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-0">
          <div className="min-w-0 truncate px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#144D2F] border border-[#4ADE80]/60 text-[#4ADE80] font-black tracking-wide uppercase text-[10px] sm:text-xs whitespace-nowrap">
            <span className="md:hidden">TUR {roundNumber} · {gameMeta.shortTitle}</span>
            <span className="hidden md:inline">İLK 3 KAZANIR • TUR {roundNumber} • {gameMeta.shortTitle}</span>
          </div>
          <div
            data-testid="round-timer-badge"
            className={`px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full border font-score font-extrabold tracking-wider text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              isLowTime
                ? 'bg-[#C93B32] border-[#FFFFFF]/65 text-[#FFFFFF] animate-pulse'
                : 'bg-[#0F273E] border-[#E5B94F]/60 text-[#E5B94F]'
            }`}
          >
            ⏱ {formattedTime}
          </div>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className={`p-2 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#F5F3EB]/20 transition active:scale-95 text-[#E5B94F] flex items-center justify-center shrink-0 cursor-pointer touch-manipulation ${
            compact ? 'min-w-[34px] min-h-[34px]' : 'min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px]'
          }`}
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scoreboard Banner (Unified Portrait Layout across all screen sizes) */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-[#124029] border border-[#E5B94F]/30 ${
          ultraCompact ? 'p-1.5' : compact ? 'p-2' : 'p-2.5'
        }`}
      >
        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
          {/* Player 1 Card */}
          <div
            className={`min-w-0 rounded-xl transition ${ultraCompact ? 'px-2 py-1' : 'p-2'} ${
              p1Leading
                ? 'bg-[#183D2B] border border-[#168A52]/75'
                : 'bg-[#16212E] border border-white/10'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerAvatar
                avatar={player1.avatar || '⚽'}
                name={p1Name}
                size="xs"
                frame={player1Frame}
                className={ultraCompact ? '!w-6 !h-6' : '!w-7 !h-7'}
              />
              <span className="font-bold text-[#F8FAFC] text-xs truncate min-w-0 flex-1">
                {crestInfo ? `${crestInfo.icon} ` : ''}
                {p1Name}
                {player1Badge ? ` ${player1Badge}` : ''}
              </span>
              {ultraCompact && (
                <span className="font-black text-lg text-[#22C55E] font-mono tabular-nums leading-none shrink-0">
                  {player1.score}
                </span>
              )}
            </div>
            {!ultraCompact && (
              <div className="flex items-center justify-between mt-1.5 gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] text-[#94A3B8] font-bold tabular-nums">
                    {p1Correct}✓
                  </span>
                  {p1Streak >= 2 && (
                    <span className="text-[10px] font-black text-[#FBBF24] tabular-nums">
                      🔥{p1Streak}
                    </span>
                  )}
                </div>
                <span className="font-black text-xl text-[#22C55E] font-mono tabular-nums leading-none">
                  {player1.score}
                </span>
              </div>
            )}
          </div>

          {/* Center VS Badge */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#080E14] border border-[#22C55E]/40 flex items-center justify-center">
              <span className="font-black text-[10px] text-[#FBBF24] tracking-tighter">
                VS
              </span>
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            className={`min-w-0 rounded-xl transition ${ultraCompact ? 'px-2 py-1' : 'p-2'} ${
              p2Leading
                ? 'bg-[#183D2B] border border-[#168A52]/75'
                : 'bg-[#16212E] border border-white/10'
            }`}
          >
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              {ultraCompact && (
                <span className="font-black text-lg text-[#22C55E] font-mono tabular-nums leading-none shrink-0">
                  {player2.score}
                </span>
              )}
              <div className="min-w-0 flex-1 text-right">
                <div className="flex items-center justify-end gap-1 min-w-0">
                  {isBotMatch && (
                    <span
                      data-testid="scoreboard-bot-badge"
                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-[#080E14] border border-white/15 text-[8px] font-black text-[#94A3B8] shrink-0"
                    >
                      BOT
                    </span>
                  )}
                  <span className="font-bold text-[#F8FAFC] text-xs truncate">
                    {p2Name}
                  </span>
                </div>
                {!ultraCompact && isBotMatch && botStatus === 'thinking' && (
                  <span
                    data-testid="bot-thinking-indicator"
                    className="block text-[9px] font-bold text-[#FBBF24] animate-pulse leading-tight"
                  >
                    Düşünüyor...
                  </span>
                )}
              </div>
              <PlayerAvatar
                avatar={isBotMatch ? '🤖' : player2.avatar || '⚽'}
                name={p2Name}
                size="xs"
                className={ultraCompact ? '!w-6 !h-6' : '!w-7 !h-7'}
              />
            </div>
            {!ultraCompact && (
              <div className="flex items-center justify-between mt-1.5 gap-1">
                <span className="font-black text-xl text-[#22C55E] font-mono tabular-nums leading-none">
                  {player2.score}
                </span>
                <div className="flex items-center gap-1 min-w-0">
                  {p2Streak >= 2 && (
                    <span className="text-[10px] font-black text-[#FBBF24] tabular-nums">
                      🔥{p2Streak}
                    </span>
                  )}
                  <span className="text-[10px] text-[#94A3B8] font-bold tabular-nums">
                    {p2Correct}✓
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar for Current Round Time */}
        <div
          className={`w-full bg-[#080E14] h-1.5 rounded-full overflow-hidden border border-white/10 ${
            ultraCompact ? 'mt-1' : compact ? 'mt-1.5' : 'mt-2'
          }`}
        >
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              isLowTime ? 'bg-[#EF4444]' : 'bg-[#22C55E]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (timeRemaining / maxRoundTime) * 100))}%` }}
          />
        </div>
      </div>
    </header>
  );
});
