import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Coins, Compass, Sparkles, Type, X } from 'lucide-react';
import {
  InitialsHint,
  JOKER_COSTS,
  NationalityPositionHint,
  getInitialsHint,
  getNationalityPositionHint,
} from '../game/jokerEngine';
import { CountryFlag } from './CountryFlag';
import { sounds } from '../utils/audio';

interface JokerControlPanelProps {
  validPlayerIds: string[];
  roundSeed: string;
  userCoins?: number;
  freeJokerTickets?: number;
  onSpendCoinsForJoker?: (costCoins: number) => { ok: boolean; reason?: string };
  disabled?: boolean;
}

export const JokerControlPanel: React.FC<JokerControlPanelProps> = ({
  validPlayerIds,
  roundSeed,
  userCoins = 0,
  freeJokerTickets = 0,
  onSpendCoinsForJoker,
  disabled = false,
}) => {
  const [natPosHint, setNatPosHint] = useState<NationalityPositionHint | null>(null);
  const [initialsHint, setInitialsHint] = useState<InitialsHint | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setNatPosHint(null);
    setInitialsHint(null);
    setErrorMsg(null);
    setModalOpen(false);
  }, [roundSeed]);

  if (!onSpendCoinsForJoker) return null;

  const hasFreeTicket = freeJokerTickets > 0;

  const showTempError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => {
      setErrorMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleNatPosClick = () => {
    if (disabled || validPlayerIds.length === 0) return;
    if (natPosHint) {
      setModalOpen(true);
      return;
    }
    const cost = JOKER_COSTS.nationality_position;
    const spend = onSpendCoinsForJoker(cost);
    if (!spend.ok) {
      sounds.playWrong();
      showTempError(
        spend.reason || `Yetersiz Coin! Uyruk & Mevki jokeri için ${cost} Coin gerekiyor.`
      );
      return;
    }
    const hint = getNationalityPositionHint(validPlayerIds, roundSeed);
    if (!hint) return;
    sounds.playCorrect();
    setNatPosHint(hint);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleInitialsClick = () => {
    if (disabled || validPlayerIds.length === 0) return;
    if (initialsHint) {
      setModalOpen(true);
      return;
    }
    const cost = JOKER_COSTS.initials;
    const spend = onSpendCoinsForJoker(cost);
    if (!spend.ok) {
      sounds.playWrong();
      showTempError(
        spend.reason || `Yetersiz Coin! Baş Harf jokeri için ${cost} Coin gerekiyor.`
      );
      return;
    }
    const hint = getInitialsHint(validPlayerIds, roundSeed);
    if (!hint) return;
    sounds.playCorrect();
    setInitialsHint(hint);
    setErrorMsg(null);
    setModalOpen(true);
  };

  return (
    <div className="w-full mt-2">
      {hasFreeTicket && (
        <div
          data-testid="joker-free-tickets-badge"
          className="mb-1.5 text-center text-[11px] font-black text-emerald-300"
        >
          🎡 Çark Hediyesi: {freeJokerTickets} Ücretsiz İpucu Hakkın Var!
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          data-testid="joker-nat-pos-btn"
          disabled={disabled || validPlayerIds.length === 0}
          onClick={handleNatPosClick}
          className={`px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            natPosHint
              ? 'bg-cyan-500/25 border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.28)]'
              : hasFreeTicket
              ? 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-400/70 text-emerald-200'
              : userCoins >= JOKER_COSTS.nationality_position
              ? 'bg-slate-900/95 hover:bg-cyan-950/60 border-cyan-500/45 text-cyan-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-400'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {natPosHint
              ? 'Uyruk & Mevki (Açık)'
              : hasFreeTicket
              ? 'Uyruk & Mevki Göster (Ücretsiz)'
              : `Uyruk & Mevki Göster (-${JOKER_COSTS.nationality_position} Coin)`}
          </span>
        </button>

        <button
          type="button"
          data-testid="joker-initials-btn"
          disabled={disabled || validPlayerIds.length === 0}
          onClick={handleInitialsClick}
          className={`px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            initialsHint
              ? 'bg-fuchsia-500/25 border-fuchsia-300 text-fuchsia-100 shadow-[0_0_14px_rgba(232,121,249,0.28)]'
              : hasFreeTicket
              ? 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-400/70 text-emerald-200'
              : userCoins >= JOKER_COSTS.initials
              ? 'bg-slate-900/95 hover:bg-fuchsia-950/60 border-fuchsia-500/45 text-fuchsia-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-400'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
          <span>
            {initialsHint
              ? 'Baş Harf (Açık)'
              : hasFreeTicket
              ? 'Baş Harf Aç (Ücretsiz)'
              : `Baş Harf Aç (-${JOKER_COSTS.initials} Coin)`}
          </span>
        </button>
      </div>

      {errorMsg && (
        <div
          data-testid="joker-error-msg"
          className="mt-2 px-3 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 text-center animate-in fade-in"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {(natPosHint || initialsHint) && (
        <div
          data-testid="joker-active-pills"
          onClick={() => setModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setModalOpen(true);
          }}
          className="mt-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-400/50 text-xs font-bold text-slate-100 flex flex-wrap items-center justify-center gap-2 shadow-[0_0_16px_rgba(6,182,212,0.2)] cursor-pointer hover:border-cyan-300 transition"
        >
          {natPosHint && (
            <span className="inline-flex items-center gap-1.5 text-cyan-200">
              <CountryFlag
                country={natPosHint.nationality}
                flag={natPosHint.flag}
                size="xs"
                variant="circle"
              />
              <span>
                {natPosHint.nationality} • {natPosHint.positionLabel}
              </span>
            </span>
          )}
          {natPosHint && initialsHint && <span className="text-slate-600">|</span>}
          {initialsHint && (
            <span className="inline-flex items-center gap-1 font-mono text-fuchsia-200 tracking-wider">
              <Sparkles className="w-3 h-3 text-fuchsia-400" />
              <span>{initialsHint.maskedName}</span>
            </span>
          )}
        </div>
      )}

      {modalOpen &&
        (natPosHint || initialsHint) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="joker-neon-card"
            className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-[#0b1328] to-slate-950 border-2 border-cyan-400/75 p-5 text-center shadow-[0_0_40px_rgba(34,211,238,0.35)] animate-card-pop"
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                aria-label="İpucunu kapat"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[10px] font-black uppercase tracking-widest mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>JOKER İPUCU KARTI</span>
              </div>

              <div className="space-y-3">
                {natPosHint && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/40 flex items-center justify-center gap-3 shadow-inner">
                    <CountryFlag
                      country={natPosHint.nationality}
                      flag={natPosHint.flag}
                      size="lg"
                      variant="circle"
                    />
                    <div className="text-left">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-400">
                        Uyruk &amp; Mevki
                      </span>
                      <span className="block text-base font-black text-white leading-tight">
                        {natPosHint.nationality}
                      </span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-xs font-extrabold text-cyan-200">
                        {natPosHint.positionLabel}
                      </span>
                    </div>
                  </div>
                )}

                {initialsHint && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-fuchsia-500/45 shadow-inner">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-fuchsia-300 mb-1">
                      Futbolcu Baş Harfleri ({initialsHint.wordCount} Kelime)
                    </span>
                    <span className="block text-xl sm:text-2xl font-mono font-black tracking-widest text-white">
                      {initialsHint.maskedName}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Kalan Bakiye: {userCoins.toLocaleString('tr-TR')} Coin</span>
              </div>

              <button
                type="button"
                data-testid="joker-card-close-btn"
                onClick={() => setModalOpen(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-lg cursor-pointer transition active:scale-95"
              >
                Tamam, Tahmin Et!
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
