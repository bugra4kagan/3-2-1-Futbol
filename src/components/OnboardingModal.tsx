import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Sparkles, Trophy, Timer, Check } from 'lucide-react';
import { CLUBS } from '../game/database';
import { ClubBadge } from './ClubBadge';
import { sounds } from '../utils/audio';

export const ONBOARDING_STORAGE_KEY = '321_onboarding_completed';

interface OnboardingModalProps {
  isOpen: boolean;
  initialClubId?: string;
  onComplete: (selectedClubId: string) => void;
}

const ALL_CLUBS = Object.values(CLUBS).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialClubId = 'galatasaray',
  onComplete,
}) => {
  const [step, setStep] = useState<number>(0);
  const [clubId, setClubId] = useState<string>(initialClubId || 'galatasaray');
  const [clubQuery, setClubQuery] = useState('');
  const touchStartXRef = useRef<number | null>(null);

  const filteredClubs = useMemo(() => {
    const q = clubQuery.trim().toLocaleLowerCase('tr');
    if (!q) return ALL_CLUBS.slice(0, 24);
    return ALL_CLUBS.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr').includes(q) ||
        c.shortName.toLocaleLowerCase('tr').includes(q) ||
        c.country.toLocaleLowerCase('tr').includes(q)
    ).slice(0, 24);
  }, [clubQuery]);

  if (!isOpen) return null;

  const selectedClub = CLUBS[clubId] || CLUBS.galatasaray;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (diff < -45 && step < 2) {
      sounds.playCorrect();
      setStep((s) => Math.min(2, s + 1));
    } else if (diff > 45 && step > 0) {
      sounds.playCorrect();
      setStep((s) => Math.max(0, s - 1));
    }
  };

  const handleFinish = () => {
    sounds.playVictory();
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onComplete(clubId);
  };

  return (
    <div
      data-testid="onboarding-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 backdrop-blur-md animate-screen-fade"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-400/45 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto">
        {/* Progress Dots + Skip */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Adım ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  step === idx ? 'w-7 bg-emerald-400' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            data-testid="onboarding-skip-btn"
            onClick={handleFinish}
            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg cursor-pointer"
          >
            Atla
          </button>
        </div>

        {/* Slide Content */}
        {step === 0 && (
          <div data-testid="onboarding-step-0" className="text-center space-y-4 py-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Timer className="w-8 h-8 stroke-[2.4]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                1 / 3 • KURALLAR
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                3-2-1 Futbol Nasıl Oynanır?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                3-2-1 geri sayımı bitince ekranda <strong>iki kulüp</strong> veya{' '}
                <strong>kariyer/silüet ipucu</strong> belirir. Süre dolmadan doğru ortak
                futbolcuyu ilk yazan raundu kazanır!
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 text-left space-y-1.5">
              <p>⚽ <strong>2.807</strong> gerçek futbolcu veritabanı (çevrimdışı da hazır!)</p>
              <p>⚡ Hızlı doğru cevaplarda seri bonusu ve ekstra puan kazanırsın.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div data-testid="onboarding-step-1" className="text-center space-y-4 py-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8 stroke-[2.4]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                2 / 3 • MODLAR &amp; ÖDÜLLER
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                5 Mini Oyun, Lig &amp; Şans Çarkı
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                Çevrimiçi 1v1 düellolar, 8 kişilik eleme turnuvaları ve internet gerektirmeyen
                Bot Antrenmanı seni bekliyor.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                <span className="block font-black text-emerald-300">🎡 Şans Çarkı</span>
                <span className="text-slate-400 text-[11px]">24 saatte bir ücretsiz çevir, Coin &amp; Joker kap!</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                <span className="block font-black text-amber-300">🏆 Haftalık Lig</span>
                <span className="text-slate-400 text-[11px]">Puan topla, üst lige yüksel ve kupa ödülü al!</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="onboarding-step-2" className="space-y-3 py-1">
            <div className="text-center">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                3 / 3 • FAVORİ KULÜP
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Takımını Seç &amp; Sahaya Çık!
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Seçtiğin kulüp profil rozetin ve skor kartında görünür.
              </p>
            </div>

            {selectedClub && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-400/50">
                <ClubBadge club={selectedClub} size="sm" />
                <div className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-black text-white truncate">
                    {selectedClub.name}
                  </span>
                  <span className="block text-[10px] text-emerald-300">Seçili Kulübün</span>
                </div>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700 focus-within:border-emerald-400">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                data-testid="onboarding-club-search"
                value={clubQuery}
                onChange={(e) => setClubQuery(e.target.value)}
                placeholder="Kulüp ara (Galatasaray, Real Madrid...)"
                className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {filteredClubs.map((club) => {
                const active = club.id === clubId;
                return (
                  <button
                    key={club.id}
                    type="button"
                    data-testid={`onboarding-club-${club.id}`}
                    onClick={() => {
                      sounds.playCorrect();
                      setClubId(club.id);
                    }}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <ClubBadge club={club} size="xs" />
                    <span className="text-[11px] font-bold leading-tight line-clamp-2 text-center w-full break-words">{club.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center gap-2 pt-1">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Geri</span>
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              data-testid="onboarding-next-btn"
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <span>İleri</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="onboarding-finish-btn"
              onClick={handleFinish}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>Oyuna Başla!</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
