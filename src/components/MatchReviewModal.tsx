import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, ShieldAlert, Trophy, X, XCircle } from 'lucide-react';
import { CLUBS, PLAYERS } from '../game/database';
import { getRoundRevealInfo, getRoundValidPlayerIds } from '../game/minigameEngine';
import { MatchRoundHighlight, MinigameType, Player, XoxCellMark } from '../game/types';
import { ClubBadge } from './ClubBadge';
import { CountryFlag } from './CountryFlag';
import { PlayerAvatar } from './PlayerAvatar';

export type ReviewFilter = 'all' | 'correct' | 'wrong' | 'unanswered';

export interface ClassifiedReviewRound {
  highlight: MatchRoundHighlight;
  category: 'correct' | 'wrong' | 'unanswered';
}

export function classifyReviewRound(highlight: MatchRoundHighlight): 'correct' | 'wrong' | 'unanswered' {
  if (highlight.didUserWin) return 'correct';
  const submitted = highlight.userSubmittedAnswers ?? [];
  if (submitted.length > 0) return 'wrong';
  return 'unanswered';
}

export function filterReviewHighlights(
  highlights: MatchRoundHighlight[],
  filter: ReviewFilter
): ClassifiedReviewRound[] {
  const classified = highlights.map((highlight) => ({
    highlight,
    category: classifyReviewRound(highlight),
  }));
  if (filter === 'all') return classified;
  return classified.filter((item) => item.category === filter);
}

const MODE_LABELS: Record<MinigameType, string> = {
  two_clubs: 'İki Kulüp',
  xox: 'Futbol XOX',
  career: 'Kariyer Yolu',
  country_club: 'Ülke + Kulüp',
  silhouette: 'Silüet',
};

const POSITION_LABELS: Record<Player['position'], string> = {
  GK: 'Kaleci',
  DF: 'Defans',
  MF: 'Orta Saha',
  FW: 'Forvet',
};

interface MatchReviewModalProps {
  isOpen: boolean;
  highlights: MatchRoundHighlight[];
  player1Id: string;
  player1Name: string;
  player2Name: string;
  onClose: () => void;
}

export const MatchReviewModal: React.FC<MatchReviewModalProps> = ({
  isOpen,
  highlights,
  player1Id,
  player1Name,
  player2Name,
  onClose,
}) => {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedPlayerIdByRound, setSelectedPlayerIdByRound] = useState<Record<number, string>>({});

  const counts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (const h of highlights) {
      const cat = classifyReviewRound(h);
      if (cat === 'correct') correct += 1;
      else if (cat === 'wrong') wrong += 1;
      else unanswered += 1;
    }
    return { all: highlights.length, correct, wrong, unanswered };
  }, [highlights]);

  const items = useMemo(
    () => filterReviewHighlights(highlights, filter),
    [highlights, filter]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="match-review-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-3xl bg-[#0B171D] border border-emerald-500/35 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#0E241C] via-[#0B171D] to-[#102027] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-black text-base sm:text-lg text-white truncate">
                Maç Sonu Soru İnceleme
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Tamamlanan turlar • Doğru futbolcular ve kariyer bilgileri (ek puan verilmez)
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="match-review-close-btn"
            onClick={onClose}
            aria-label="Soru incelemeyi kapat"
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-slate-950/60 flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'Tüm Sorular', count: counts.all },
              { id: 'correct', label: 'Doğru Cevaplar', count: counts.correct },
              { id: 'wrong', label: 'Yanlış Cevaplar', count: counts.wrong },
              { id: 'unanswered', label: 'Cevaplanmayanlar', count: counts.unanswered },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`review-filter-${tab.id}`}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Round Cards List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {items.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
              Bu filtrede gösterilecek tamamlanmış tur bulunmuyor.
            </div>
          ) : (
            items.map(({ highlight, category }) => {
              const payload = highlight.roundPayload;
              const allValidIds = payload ? getRoundValidPlayerIds(payload) : [];
              const reveal = payload ? getRoundRevealInfo(payload) : null;
              const selectedId =
                selectedPlayerIdByRound[highlight.roundNumber] ||
                (reveal?.validPlayers?.[0]?.id ?? allValidIds[0]);
              const featuredPlayer: Player | undefined = selectedId
                ? PLAYERS[selectedId]
                : reveal?.validPlayers?.[0] ?? undefined;

              const statusBadge =
                category === 'correct'
                  ? {
                      text: 'Doğru',
                      cls: 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300',
                      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                    }
                  : category === 'wrong'
                  ? {
                      text: 'Yanlış',
                      cls: 'bg-rose-500/15 border-rose-400/45 text-rose-300',
                      icon: <XCircle className="w-3.5 h-3.5" />,
                    }
                  : {
                      text: 'Cevaplanmadı',
                      cls: 'bg-amber-500/15 border-amber-400/45 text-amber-300',
                      icon: <Clock className="w-3.5 h-3.5" />,
                    };

              return (
                <div
                  key={`${highlight.roundNumber}-${highlight.minigameType}`}
                  data-testid={`review-round-card-${highlight.roundNumber}`}
                  className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-3"
                >
                  {/* Top Meta Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 font-mono text-[11px] font-black">
                        Tur {highlight.roundNumber}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {MODE_LABELS[highlight.minigameType] || highlight.minigameType}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-black inline-flex items-center gap-1 ${statusBadge.cls}`}
                    >
                      {statusBadge.icon}
                      <span>{statusBadge.text}</span>
                    </span>
                  </div>

                  {/* Prompt Presentation per Game Mode */}
                  {payload?.minigameType === 'two_clubs' && payload.pairing && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      {CLUBS[payload.pairing.club1Id] && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                          <ClubBadge club={CLUBS[payload.pairing.club1Id]} size="xs" />
                          <span className="text-xs font-black text-white">
                            {CLUBS[payload.pairing.club1Id].name}
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-black text-emerald-400">×</span>
                      {CLUBS[payload.pairing.club2Id] && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                          <ClubBadge club={CLUBS[payload.pairing.club2Id]} size="xs" />
                          <span className="text-xs font-black text-white">
                            {CLUBS[payload.pairing.club2Id].name}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {payload?.minigameType === 'country_club' && payload.countryClub && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                        <CountryFlag flag={payload.countryClub.countryFlag} size="sm" />
                        <span className="text-xs font-black text-white">
                          {payload.countryClub.country}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400">+</span>
                      {CLUBS[payload.countryClub.clubId] && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                          <ClubBadge club={CLUBS[payload.countryClub.clubId]} size="xs" />
                          <span className="text-xs font-black text-white">
                            {CLUBS[payload.countryClub.clubId].name}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {payload?.minigameType === 'career' && payload.career && (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Kariyer Basamakları
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {payload.career.steps.map((st, idx) => (
                          <span
                            key={`${highlight.roundNumber}-step-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-200"
                          >
                            <CountryFlag flag={st.countryFlag} size="xs" />
                            <span>{st.clubName}</span>
                            {st.years && (
                              <span className="text-slate-400 font-mono text-[10px]">
                                ({st.years})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {payload?.minigameType === 'xox' && payload.xoxBoard && (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-purple-300">
                          {payload.xoxBoard.title}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <div />
                        {payload.xoxBoard.cols.map((col, ci) => (
                          <div
                            key={`xox-col-${ci}`}
                            className="p-1 rounded bg-slate-950 text-center font-bold text-slate-300 truncate"
                            title={col.label}
                          >
                            {col.label}
                          </div>
                        ))}
                        {payload.xoxBoard.rows.map((row, ri) => (
                          <React.Fragment key={`xox-row-${ri}`}>
                            <div
                              className="p-1 rounded bg-slate-950 font-bold text-slate-300 flex items-center truncate"
                              title={row.label}
                            >
                              {row.label}
                            </div>
                            {[0, 1, 2].map((ci) => {
                              const claim: XoxCellMark | null =
                                highlight.xoxBoardSnapshot?.[ri]?.[ci] ?? null;
                              const cellKey = `${ri}_${ci}`;
                              const cellValid = payload.xoxBoard?.cellValidPlayerIds[cellKey] ?? [];
                              const sampleName = cellValid[0]
                                ? PLAYERS[cellValid[0]]?.name
                                : undefined;
                              return (
                                <div
                                  key={cellKey}
                                  className={`p-1.5 rounded border text-center leading-tight ${
                                    claim
                                      ? claim.ownerId === player1Id
                                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                                        : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {claim ? (
                                    <>
                                      <span className="block font-black text-[10px]">
                                        {claim.symbol}
                                      </span>
                                      <span className="block truncate text-[9px]">
                                        {claim.playerName}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="block truncate text-[9px]">
                                      {sampleName || `${cellValid.length} aday`}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Answer vs Round Outcome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-900/75 border border-slate-800">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Senin Cevabın ({player1Name})
                      </span>
                      <span className="block font-bold text-white mt-0.5 truncate">
                        {highlight.userSubmittedAnswers && highlight.userSubmittedAnswers.length > 0
                          ? highlight.userSubmittedAnswers.join(', ')
                          : 'Cevap girilmedi'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-900/75 border border-slate-800">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Tur Sonucu
                      </span>
                      <span className="block font-bold text-slate-200 mt-0.5 truncate">
                        {highlight.winnerPlayerId
                          ? `${highlight.winnerName || player2Name}: ${highlight.acceptedAnswer || '-'}`
                          : highlight.reason === 'timeout'
                          ? 'Süre doldu (kimse bilmedi)'
                          : 'Tur tamamlandı'}
                      </span>
                    </div>
                  </div>

                  {/* Featured Footballer Card with Avatar, Country, Position & Verified Career */}
                  {featuredPlayer && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-slate-900 to-[#0D1E19] border border-emerald-500/25 space-y-2">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar
                          player={featuredPlayer}
                          name={featuredPlayer.name}
                          size="md"
                          variant="rounded"
                          className="shrink-0 bg-slate-800 border border-slate-700"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-black text-sm text-white truncate">
                              {featuredPlayer.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-black text-emerald-300">
                              {POSITION_LABELS[featuredPlayer.position] || featuredPlayer.position}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5">
                            <CountryFlag flag={featuredPlayer.flag} size="xs" />
                            <span>{featuredPlayer.nationality}</span>
                            {featuredPlayer.clubName && (
                              <>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-300 truncate">
                                  {featuredPlayer.clubName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {featuredPlayer.careerHistory && featuredPlayer.careerHistory.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {featuredPlayer.careerHistory
                            .filter((ch) => !ch.isYouth)
                            .map((ch, idx) => (
                              <span
                                key={`${featuredPlayer.id}-ch-${idx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px] font-semibold text-slate-300"
                              >
                                <CountryFlag flag={ch.countryFlag} size="xs" />
                                <span>{ch.club}</span>
                                {ch.years && ch.years.trim().length > 0 && (
                                  <span className="text-slate-400 font-mono">{ch.years}</span>
                                )}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Other Accepted Valid Answers */}
                  {allValidIds.length > 1 && (
                    <div className="space-y-1">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Diğer Doğru Futbolcular ({allValidIds.length}) — İncelemek için dokun
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {allValidIds.map((pid) => {
                          const pl = PLAYERS[pid];
                          if (!pl) return null;
                          const isSelected = featuredPlayer?.id === pid;
                          return (
                            <button
                              key={`${highlight.roundNumber}-ans-${pid}`}
                              type="button"
                              onClick={() =>
                                setSelectedPlayerIdByRound((prev) => ({
                                  ...prev,
                                  [highlight.roundNumber]: pid,
                                }))
                              }
                              className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {pl.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {reveal?.funFact && (
                    <p className="text-[11px] text-amber-200/85 bg-amber-500/5 border border-amber-400/20 rounded-xl px-2.5 py-1.5 flex items-start gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{reveal.funFact}</span>
                    </p>
                  )}

                  {!payload && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                      <span>Bu tur için soru detayı kaydedilmedi.</span>
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
