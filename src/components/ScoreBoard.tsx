import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { MinigameType, PlayerProfile } from '../game/types';
import { getMinigameMeta } from '../game/minigameEngine';
import { getCrestBadgeInfo } from '../game/storeCatalog';
import { useLanguage } from '../game/LanguageContext';
import { PlayerAvatar } from './PlayerAvatar';

interface ScoreBoardProps {
  player1: PlayerProfile;
  player2: PlayerProfile;
  roundNumber: number;
  totalRounds: number;
  timeRemaining: number;
  minigameType?: MinigameType;
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
  player1Frame,
  player1Crest,
  player1Badge,
  onOpenSettings,
  onExit,
}) => {
  const { t } = useLanguage();
  const crestInfo = getCrestBadgeInfo(player1Crest);
  const p1Leading = player1.score > player2.score;
  const p2Leading = player2.score > player1.score;

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
    <header className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 pt-2 pb-1.5 sm:pb-2">
      {/* Top utility bar: Single-line on all screen sizes */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 text-xs text-slate-300 font-semibold mb-2 sm:mb-2.5">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition active:scale-95 text-slate-200 hover:text-white shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          title="Maçtan Çık"
          aria-label="Maçtan Çık"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="font-bold">{t('menu')}</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
          <div className="min-w-0 truncate px-2.5 sm:px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 font-black tracking-wide uppercase text-[11px] sm:text-xs shadow-sm whitespace-nowrap">
            <span className="md:hidden">TUR {roundNumber} · {gameMeta.shortTitle}</span>
            <span className="hidden md:inline">İLK 3 KAZANIR • TUR {roundNumber} • {gameMeta.shortTitle}</span>
          </div>
          <div
            data-testid="round-timer-badge"
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-full border font-black tracking-wider text-[11px] sm:text-xs transition-colors shadow-sm whitespace-nowrap shrink-0 tabular-nums ${
              isLowTime
                ? 'bg-red-950/95 border-red-500 text-red-400 animate-pulse'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            }`}
          >
            ⏱ {formattedTime}
          </div>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition active:scale-95 text-slate-200 hover:text-white shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Main Scoreboard Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/70 to-slate-900 border border-emerald-500/40 shadow-2xl p-2.5 sm:p-5">
        {/* Pitch grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] opacity-15 pointer-events-none" />

        {/* MOBILE LAYOUT (< 640px): Compact 2-column grid with zero horizontal overflow */}
        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:hidden">
          {/* Mobile Player 1 Card */}
          <div
            className={`min-w-0 p-2 rounded-xl transition shadow-md ${
              p1Leading
                ? 'bg-emerald-500/20 border border-emerald-400/60'
                : 'bg-slate-950/75 border border-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerAvatar
                avatar={player1.avatar || '⚽'}
                name={player1.name}
                size="xs"
                frame={player1Frame}
                className="!w-7 !h-7 bg-gradient-to-br from-blue-600 to-indigo-800 shadow border border-white/20"
              />
              <span className="font-bold text-white text-xs truncate min-w-0 flex-1">
                {crestInfo ? `${crestInfo.icon} ` : ''}
                {player1.name}
                {player1Badge ? ` ${player1Badge}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full border transition-all ${
                      player1.score >= step
                        ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                ))}
                <span className="text-[10px] text-slate-400 font-bold ml-0.5 tabular-nums">
                  {player1.score}/3
                </span>
              </div>
              <span className="font-black text-xl text-emerald-400 font-mono tabular-nums leading-none">
                {player1.score}
              </span>
            </div>
          </div>

          {/* Mobile Center VS Badge */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-7 h-7 rounded-lg bg-slate-950 border border-emerald-500/60 flex items-center justify-center shadow">
              <span className="font-black text-[10px] text-amber-400 tracking-tighter">
                VS
              </span>
            </div>
          </div>

          {/* Mobile Player 2 Card */}
          <div
            className={`min-w-0 p-2 rounded-xl transition shadow-md ${
              p2Leading
                ? 'bg-emerald-500/20 border border-emerald-400/60'
                : 'bg-slate-950/75 border border-slate-800'
            }`}
          >
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              <span className="font-bold text-white text-xs truncate text-right min-w-0 flex-1">
                {player2.name}
              </span>
              <PlayerAvatar
                avatar={player2.avatar || '🔥'}
                name={player2.name}
                size="xs"
                className="!w-7 !h-7 bg-gradient-to-br from-rose-600 to-amber-700 shadow border border-white/20"
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-1">
              <span className="font-black text-xl text-emerald-400 font-mono tabular-nums leading-none">
                {player2.score}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-bold mr-0.5 tabular-nums">
                  {player2.score}/3
                </span>
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full border transition-all ${
                      player2.score >= step
                        ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP & TABLET LAYOUT (>= 640px): Spacious stadium scoreboard */}
        <div className="relative z-10 hidden sm:flex items-center justify-between gap-4 md:gap-6">
          {/* Player 1 Card */}
          <div
            className={`flex-1 min-w-0 flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl transition shadow-lg ${
              p1Leading
                ? 'bg-emerald-500/20 border-2 border-emerald-400/60 shadow-emerald-500/10'
                : 'bg-slate-950/70 border border-slate-800'
            }`}
          >
            <PlayerAvatar
              avatar={player1.avatar || '⚽'}
              name={player1.name}
              size="lg"
              frame={player1Frame}
              className="bg-gradient-to-br from-blue-600 to-indigo-800 shadow-md border border-white/20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {crestInfo && (
                  <span title={crestInfo.label} className="text-sm shrink-0">
                    {crestInfo.icon}
                  </span>
                )}
                <span className="font-extrabold text-white text-sm md:text-base truncate">
                  {player1.name}
                </span>
                {player1Badge && (
                  <span className="text-sm shrink-0">{player1Badge}</span>
                )}
                {p1Leading && (
                  <span className="text-[10px] bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded font-black tracking-tight shrink-0">
                    ÖNDE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2.5 h-2.5 rounded-full border transition-all ${
                      player1.score >= step
                        ? 'bg-amber-400 border-amber-300 shadow-md shadow-amber-400/50 scale-110'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                    title={`${step}. Galibiyet`}
                  />
                ))}
                <span className="text-xs text-slate-300 font-black ml-1.5 tabular-nums">
                  {player1.score}/3
                </span>
              </div>
            </div>
            <div className="text-right pl-1 shrink-0">
              <span className="font-black text-3xl md:text-4xl text-emerald-400 font-mono tabular-nums tracking-tight drop-shadow-sm">
                {player1.score}
              </span>
              <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">
                SKOR
              </span>
            </div>
          </div>

          {/* Center VS Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-0.5">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-950 border-2 border-emerald-500/60 flex items-center justify-center shadow-xl shadow-emerald-500/20 transform rotate-45">
              <span className="font-black text-xs md:text-sm text-amber-400 tracking-tighter transform -rotate-45">
                VS
              </span>
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            className={`flex-1 min-w-0 flex items-center justify-end gap-3 md:gap-4 p-3 md:p-4 rounded-2xl transition shadow-lg ${
              p2Leading
                ? 'bg-emerald-500/20 border-2 border-emerald-400/60 shadow-emerald-500/10'
                : 'bg-slate-950/70 border border-slate-800'
            }`}
          >
            <div className="text-left pr-1 shrink-0">
              <span className="font-black text-3xl md:text-4xl text-emerald-400 font-mono tabular-nums tracking-tight drop-shadow-sm">
                {player2.score}
              </span>
              <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">
                SKOR
              </span>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="flex items-center justify-end gap-2">
                {p2Leading && (
                  <span className="text-[10px] bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded font-black tracking-tight shrink-0">
                    ÖNDE
                  </span>
                )}
                <span className="font-extrabold text-white text-sm md:text-base truncate">
                  {player2.name}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1.5">
                <span className="text-xs text-slate-300 font-black mr-1.5 tabular-nums">
                  {player2.score}/3
                </span>
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2.5 h-2.5 rounded-full border transition-all ${
                      player2.score >= step
                        ? 'bg-amber-400 border-amber-300 shadow-md shadow-amber-400/50 scale-110'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                    title={`${step}. Galibiyet`}
                  />
                ))}
              </div>
            </div>
            <PlayerAvatar
              avatar={player2.avatar || '🔥'}
              name={player2.name}
              size="lg"
              className="bg-gradient-to-br from-rose-600 to-amber-700 shadow-md border border-white/20"
            />
          </div>
        </div>

        {/* Progress Bar for Current Round Time */}
        <div className="w-full bg-slate-950 h-1.5 sm:h-2 rounded-full mt-2.5 sm:mt-3.5 overflow-hidden border border-slate-800 shadow-inner">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full shadow-sm ${
              isLowTime ? 'bg-red-500 shadow-red-500/50' : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/50'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (timeRemaining / maxRoundTime) * 100))}%` }}
          />
        </div>
      </div>
    </header>
  );
};
