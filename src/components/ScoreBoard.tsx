import React from 'react';
import { Settings, LogOut, Bot } from 'lucide-react';
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
  onOpenSettings: () => void;
  onExit: () => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
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
    <header className="shrink-0 z-30 w-full max-w-4xl mx-auto px-2.5 sm:px-4 pt-[max(0.65rem,calc(env(safe-area-inset-top)+0.4rem))] pb-1 sm:pb-1.5 bg-[#0B1220] border-b border-[#A8B3C2]/20">
      {/* Top utility bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 text-xs text-[#F5F3EB] font-semibold mb-2 sm:mb-2.5">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#16212E] hover:bg-[#1E293B] border border-[#A8B3C2]/25 transition active:scale-95 text-[#FFFFFF] whitespace-nowrap shrink-0 cursor-pointer touch-manipulation"
          title="Maçtan Çık"
          aria-label="Maçtan Çık"
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#A8B3C2]" />
          <span className="font-bold">{t('menu')}</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
          <div className="min-w-0 truncate px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#183D2B] border border-[#168A52] text-[#22C55E] font-black tracking-wide uppercase text-[11px] sm:text-xs whitespace-nowrap">
            <span className="md:hidden">TUR {roundNumber} · {gameMeta.shortTitle}</span>
            <span className="hidden md:inline">İLK 3 KAZANIR • TUR {roundNumber} • {gameMeta.shortTitle}</span>
          </div>
          <div
            data-testid="round-timer-badge"
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-full border font-score font-extrabold tracking-wider text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              isLowTime
                ? 'bg-[#DC2626] border-[#FFFFFF]/60 text-[#FFFFFF] animate-pulse'
                : 'bg-[#16212E] border-[#E5B94F]/55 text-[#E5B94F]'
            }`}
          >
            ⏱ {formattedTime}
          </div>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="min-w-[42px] min-h-[42px] p-2 rounded-xl bg-[#16212E] hover:bg-[#1E293B] border border-[#A8B3C2]/25 transition active:scale-95 text-[#E5B94F] flex items-center justify-center shrink-0 cursor-pointer touch-manipulation"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scoreboard Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#16212E] border border-[#A8B3C2]/20 p-2.5 sm:p-4">
        {/* MOBILE LAYOUT (< 640px) */}
        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:hidden">
          {/* Mobile Player 1 Card */}
          <div
            className={`min-w-0 p-2 rounded-xl transition ${
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
                className="!w-7 !h-7"
              />
              <span className="font-bold text-[#F8FAFC] text-xs truncate min-w-0 flex-1">
                {crestInfo ? `${crestInfo.icon} ` : ''}
                {p1Name}
                {player1Badge ? ` ${player1Badge}` : ''}
              </span>
            </div>
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
          </div>

          {/* Mobile Center VS Badge */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#080E14] border border-[#22C55E]/40 flex items-center justify-center">
              <span className="font-black text-[10px] text-[#FBBF24] tracking-tighter">
                VS
              </span>
            </div>
          </div>

          {/* Mobile Player 2 Card */}
          <div
            className={`min-w-0 p-2 rounded-xl transition ${
              p2Leading
                ? 'bg-[#183D2B] border border-[#168A52]/75'
                : 'bg-[#16212E] border border-white/10'
            }`}
          >
            <div className="flex items-center justify-end gap-1.5 min-w-0">
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
                {isBotMatch && botStatus === 'thinking' && (
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
                className="!w-7 !h-7"
              />
            </div>
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
          </div>
        </div>

        {/* DESKTOP & TABLET LAYOUT (>= 640px) */}
        <div className="relative z-10 hidden sm:flex items-center justify-between gap-4 md:gap-6">
          {/* Player 1 Card */}
          <div
            className={`flex-1 min-w-0 flex items-center gap-3 md:gap-4 p-3 rounded-2xl transition ${
              p1Leading
                ? 'bg-[#183D2B] border border-[#168A52]/75'
                : 'bg-[#16212E] border border-white/10'
            }`}
          >
            <PlayerAvatar
              avatar={player1.avatar || '⚽'}
              name={p1Name}
              size="lg"
              frame={player1Frame}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {crestInfo && (
                  <span title={crestInfo.label} className="text-sm shrink-0">
                    {crestInfo.icon}
                  </span>
                )}
                <span className="font-extrabold text-[#F8FAFC] text-sm md:text-base truncate">
                  {p1Name}
                </span>
                {player1Badge && (
                  <span className="text-sm shrink-0">{player1Badge}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold text-[#94A3B8]">
                <span className="tabular-nums">Doğru: {p1Correct}</span>
                {p1Streak >= 1 && (
                  <span className="text-[#FBBF24] font-black tabular-nums">
                    🔥 Seri: {p1Streak}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right pl-1 shrink-0">
              <span className="font-black text-3xl md:text-4xl text-[#22C55E] font-mono tabular-nums tracking-tight">
                {player1.score}
              </span>
              <span className="block text-[10px] text-[#94A3B8] uppercase font-black tracking-wider">
                SKOR
              </span>
            </div>
          </div>

          {/* Center VS Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-0.5">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#080E14] border border-[#22C55E]/40 flex items-center justify-center">
              <span className="font-black text-xs md:text-sm text-[#FBBF24] tracking-tighter">
                VS
              </span>
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            className={`flex-1 min-w-0 flex items-center justify-end gap-3 md:gap-4 p-3 rounded-2xl transition ${
              p2Leading
                ? 'bg-[#183D2B] border border-[#168A52]/75'
                : 'bg-[#16212E] border border-white/10'
            }`}
          >
            <div className="text-left pr-1 shrink-0">
              <span className="font-black text-3xl md:text-4xl text-[#22C55E] font-mono tabular-nums tracking-tight">
                {player2.score}
              </span>
              <span className="block text-[10px] text-[#94A3B8] uppercase font-black tracking-wider">
                SKOR
              </span>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {isBotMatch && (
                  <span
                    data-testid="scoreboard-bot-badge-desktop"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#080E14] border border-white/15 text-[10px] font-black text-[#94A3B8] shrink-0"
                  >
                    <Bot className="w-3 h-3 text-[#22C55E]" />
                    BOT
                  </span>
                )}
                <span className="font-extrabold text-[#F8FAFC] text-sm md:text-base truncate">
                  {p2Name}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 mt-1 text-xs font-bold text-[#94A3B8]">
                {isBotMatch && botStatus === 'thinking' ? (
                  <span
                    data-testid="bot-thinking-indicator-desktop"
                    className="text-[#FBBF24] font-black animate-pulse"
                  >
                    Düşünüyor...
                  </span>
                ) : (
                  <>
                    {p2Streak >= 1 && (
                      <span className="text-[#FBBF24] font-black tabular-nums">
                        🔥 Seri: {p2Streak}
                      </span>
                    )}
                    <span className="tabular-nums">Doğru: {p2Correct}</span>
                  </>
                )}
              </div>
            </div>
            <PlayerAvatar
              avatar={isBotMatch ? '🤖' : player2.avatar || '⚽'}
              name={p2Name}
              size="lg"
            />
          </div>
        </div>

        {/* Progress Bar for Current Round Time */}
        <div className="w-full bg-[#080E14] h-1.5 sm:h-2 rounded-full mt-2.5 overflow-hidden border border-white/10">
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
};
