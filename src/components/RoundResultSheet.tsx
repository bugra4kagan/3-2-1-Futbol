import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MinigameRoundPayload, PlayerProfile } from '../game/types';
import { getRoundRevealInfo } from '../game/minigameEngine';
import { CLUBS, PLAYERS } from '../game/database';
import { getPlayerAsset } from '../game/playerAssets';
import { getGoalEffectColors } from '../game/storeCatalog';
import { ClubBadge } from './ClubBadge';
import { CountryFlag } from './CountryFlag';
import { PlayerAvatar } from './PlayerAvatar';
import { CheckCircle2, Clock, Film, Info, Sparkles } from 'lucide-react';

interface RoundResultSheetProps {
  round: MinigameRoundPayload;
  winnerPlayer: PlayerProfile | null;
  player1Id?: string;
  acceptedAnswer?: string;
  isTimeExpired?: boolean;
  endReason?: 'timeout' | 'attempts_exhausted' | 'draw';
  roundIndex: number;
  totalRounds: number;
  goalEffect?: string;
  roundReward?: { coins: number; points: number } | null;
  roundDoubled?: boolean;
  onRequestDoubleRound?: () => void;
}

const PlayerFaceAvatar: React.FC<{ playerId: string; name: string; highlight?: boolean }> = ({
  playerId,
  name,
  highlight = false,
}) => {
  const player = PLAYERS[playerId] || null;
  return (
    <PlayerAvatar
      player={player}
      name={name}
      size={highlight ? 'lg' : 'sm'}
      variant="circle"
      className={
        highlight
          ? 'border-2 border-emerald-400 shadow-lg'
          : 'border border-white/25'
      }
    />
  );
};

export const RoundResultSheet: React.FC<RoundResultSheetProps> = ({
  round,
  winnerPlayer,
  player1Id,
  acceptedAnswer,
  isTimeExpired = false,
  endReason,
  roundIndex,
  goalEffect,
  roundReward = null,
  roundDoubled = false,
  onRequestDoubleRound,
}) => {
  const { validPlayers, funFact } = getRoundRevealInfo(round);
  const resolvedReason = endReason || (isTimeExpired ? 'timeout' : 'draw');
  const didUserWinRound = Boolean(winnerPlayer && player1Id && winnerPlayer.id === player1Id);

  useEffect(() => {
    if (!didUserWinRound) return;
    try {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.65 },
        colors: getGoalEffectColors(goalEffect),
      });
    } catch {
      // ignore
    }
  }, [didUserWinRound, goalEffect]);

  const listHeading =
    round.minigameType === 'two_clubs'
      ? 'Her İki Kulüpte de Oynamış Ortak Futbolcular:'
      : round.minigameType === 'silhouette' || round.minigameType === 'career'
      ? 'Doğru Cevap:'
      : round.minigameType === 'country_club'
      ? 'Bu Ülke ve Kulüpten Uygun Futbolcular:'
      : 'Tahtadaki Uygun Yıldızlardan Bazıları:';

  const isSingleFeaturedReveal =
    validPlayers.length === 1 &&
    (round.minigameType === 'silhouette' || round.minigameType === 'career');

  return (
    <div
      data-testid="round-result-sheet"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-center max-h-[92dvh] overflow-y-auto my-auto">
        {/* Banner based on outcome */}
        {winnerPlayer ? (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center text-3xl mb-2 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="text-xs font-black tracking-widest text-emerald-400 uppercase px-3 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40">
              TUR KAZANILDI (+1 GALİBİYET)
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center justify-center gap-2">
              <PlayerAvatar
                avatar={winnerPlayer.avatar}
                name={winnerPlayer.name}
                size="sm"
                variant="circle"
                className="bg-slate-800 border border-emerald-400/50"
              />
              <span>{winnerPlayer.name} Kazandı!</span>
            </h3>
            {acceptedAnswer && (
              <p className="text-sm font-semibold text-emerald-300 mt-1">
                Cevap: <span className="text-white underline font-bold">{acceptedAnswer}</span>
              </p>
            )}
            {didUserWinRound && roundReward && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black">
                  🪙 +{roundDoubled ? roundReward.coins * 2 : roundReward.coins} Coin • 🏆 +
                  {roundDoubled ? roundReward.points * 2 : roundReward.points} Puan
                </span>
                {onRequestDoubleRound && (
                  <button
                    type="button"
                    data-testid="round-double-ad-btn"
                    disabled={roundDoubled}
                    onClick={onRequestDoubleRound}
                    className={`px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1 transition cursor-pointer ${
                      roundDoubled
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                        : 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 shadow'
                    }`}
                  >
                    {roundDoubled ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>2x Katlandı ✓</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3.5 h-3.5" />
                        <span>Reklam İzle &amp; 2x Katla</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center text-3xl mb-2 shadow-lg shadow-amber-500/30">
              <Clock className="w-8 h-8" />
            </div>
            <span className="text-xs font-black tracking-widest text-amber-400 uppercase px-3 py-0.5 rounded-full bg-amber-950 border border-amber-500/40">
              {resolvedReason === 'attempts_exhausted'
                ? 'DENEME HAKKI DOLDU'
                : resolvedReason === 'timeout'
                ? 'SÜRE DOLDU'
                : 'TUR BERABERE'}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
              {resolvedReason === 'attempts_exhausted'
                ? '8/8 Deneme Hakkı Bitti — 0 Puan!'
                : 'İki Oyuncu da Puan Alamadı'}
            </h3>
          </div>
        )}

        {/* Fun Fact / Trivia Pill */}
        {funFact && (
          <div className="my-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5 text-left">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{funFact}</span>
          </div>
        )}

        {/* All Eligible Players List */}
        {validPlayers.length > 0 && (
          <div className="mt-3 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>{listHeading}</span>
              <span className="text-emerald-400">{validPlayers.length} Oyuncu</span>
            </div>

            {isSingleFeaturedReveal ? (
              (() => {
                const player = validPlayers[0];
                const asset = getPlayerAsset(player.id);
                const clubObj = asset.clubId ? CLUBS[asset.clubId] : null;
                return (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/90 border border-emerald-500/40">
                    <PlayerFaceAvatar playerId={player.id} name={player.name} highlight />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm sm:text-base text-white truncate">
                          {player.name}
                        </span>
                        <CountryFlag
                          country={player.nationality}
                          flag={player.flag}
                          size="sm"
                          variant="circle"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 font-semibold">
                        <ClubBadge
                          club={clubObj}
                          clubId={asset.clubId}
                          clubName={asset.clubName}
                          size="xs"
                        />
                        <span className="truncate">{asset.clubName}</span>
                        <span className="text-slate-500">•</span>
                        <span>#{asset.shirtNumber}</span>
                        <span className="text-slate-500">•</span>
                        <span>{asset.age} Yaş</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 shrink-0">
                      {player.position}
                    </span>
                  </div>
                );
              })()
            ) : (
              <div
                className={`max-h-44 overflow-y-auto pr-1 grid gap-1.5 custom-scrollbar ${
                  validPlayers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {validPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-white min-w-0"
                  >
                    <PlayerFaceAvatar playerId={player.id} name={player.name} />
                    <CountryFlag
                      country={player.nationality}
                      flag={player.flag}
                      size="xs"
                      variant="circle"
                    />
                    <span className="truncate flex-1">{player.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded shrink-0">
                      {player.position}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next round progress indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400">
          <span>Tur {roundIndex} • İlk 3 Olan Kazanır</span>
          <span className="text-emerald-400 animate-pulse">Sonraki tur hazırlanıyor...</span>
        </div>
      </div>
    </div>
  );
};
