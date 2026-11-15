import React, { useMemo, useState } from 'react';
import { UserCheck, Sparkles, Check, Coins, Lock, Search, Shield } from 'lucide-react';
import { CLUBS } from '../game/database';
import { PlayerProfile, UserProgression } from '../game/types';
import {
  FREE_AVATARS,
  STAR_PP_AVATARS,
  isPhotoAvatar,
} from '../game/avatarCatalog';
import { formatPoints } from '../game/retentionEngine';
import { sounds } from '../utils/audio';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubLogo } from './ClubLogo';

interface AuthModalProps {
  currentProfile: PlayerProfile;
  progression?: UserProgression;
  onSaveProfile: (profile: PlayerProfile) => void;
  onPurchaseGift?: (giftId: string) => { ok: boolean; reason?: string };
  onClose?: () => void;
  isInitialRequired?: boolean;
}

const ALL_CLUBS = Object.values(CLUBS).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

export const AuthModal: React.FC<AuthModalProps> = ({
  currentProfile,
  progression,
  onSaveProfile,
  onPurchaseGift,
  onClose,
  isInitialRequired = false,
}) => {
  const [name, setName] = useState(currentProfile.name || 'Futbol Gurmesi');
  const [avatar, setAvatar] = useState(currentProfile.avatar || '⚽');
  const [favoriteClubId, setFavoriteClubId] = useState(
    currentProfile.favoriteClubId || 'galatasaray'
  );
  const [clubSearch, setClubSearch] = useState('');
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'pp' | 'emoji'>(
    isPhotoAvatar(currentProfile.avatar) ? 'pp' : 'pp'
  );
  const [ppFeedback, setPpFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const unlockedSet = useMemo(
    () => new Set(progression?.unlockedGiftIds || []),
    [progression?.unlockedGiftIds]
  );
  const coins = progression?.coins ?? 0;

  const selectedClub = CLUBS[favoriteClubId] || CLUBS.galatasaray;

  const filteredClubs = useMemo(() => {
    const q = clubSearch.trim().toLocaleLowerCase('tr');
    if (!q) return ALL_CLUBS;
    return ALL_CLUBS.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr').includes(q) ||
        c.shortName.toLocaleLowerCase('tr').includes(q) ||
        c.country.toLocaleLowerCase('tr').includes(q)
    );
  }, [clubSearch]);

  const handleSelectOrBuyPp = (pp: (typeof STAR_PP_AVATARS)[number]) => {
    const isUnlocked = unlockedSet.has(pp.giftId);
    if (isUnlocked) {
      setAvatar(pp.avatarValue);
      setPpFeedback({ type: 'ok', text: `${pp.name} seçildi!` });
      setTimeout(() => setPpFeedback(null), 1800);
      return;
    }

    if (!onPurchaseGift) {
      setPpFeedback({ type: 'err', text: 'Coin ile PP açmak için profil mağazasını kullan.' });
      setTimeout(() => setPpFeedback(null), 2400);
      return;
    }

    const res = onPurchaseGift(pp.giftId);
    if (res.ok) {
      sounds.playVictory();
      setAvatar(pp.avatarValue);
      setPpFeedback({ type: 'ok', text: `${pp.name} açıldı ve seçildi!` });
    } else {
      sounds.playWrong();
      setPpFeedback({
        type: 'err',
        text: res.reason || 'Yetersiz Coin!',
      });
    }
    setTimeout(() => setPpFeedback(null), 2600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (savedSuccess || !name.trim()) return;

    const updatedProfile: PlayerProfile = {
      ...currentProfile,
      name: name.trim(),
      avatar,
      favoriteClubId,
      accountStats: currentProfile.accountStats || {
        totalMatches: 0,
        totalWins: 0,
        badgesEarned: [],
      },
    };

    try {
      localStorage.setItem('football_user_profile', JSON.stringify(updatedProfile));
    } catch {
      // In case localStorage is blocked
    }

    setSavedSuccess(true);
    setTimeout(() => {
      onSaveProfile(updatedProfile);
      onClose?.();
    }, 350);
  };

  return (
    <div
      data-testid="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] overflow-y-auto animate-screen-slide-up">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative text-center mb-4">
          {progression && (
            <div
              data-testid="auth-coins-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-amber-400/40 text-amber-400 text-xs font-black font-mono mb-2"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{formatPoints(coins)} Coin</span>
            </div>
          )}

          <div className="mx-auto mb-2.5 flex items-center justify-center">
            {isPhotoAvatar(avatar) ? (
              <PlayerAvatar
                avatar={avatar}
                name={name}
                size="xl"
                className="border-2 border-emerald-400 shadow-lg shadow-emerald-500/25"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25 border border-emerald-300">
                <UserCheck className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}
          </div>

          <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase px-3 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40">
            PROFİL AYARLARI
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
            Oyuncu Girişi
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            İsmini, avatarını veya Coin ile Yıldız PP’ni seç.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {/* Avatar Tab Switcher: Yıldız PP vs Ücretsiz Avatarlar */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                Avatar &amp; PP Seç
              </label>
              <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800">
                <button
                  type="button"
                  data-testid="auth-tab-pp"
                  onClick={() => setAvatarTab('pp')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    avatarTab === 'pp'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yıldız PP (Coin)
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-emoji"
                  onClick={() => setAvatarTab('emoji')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    avatarTab === 'emoji'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ücretsiz
                </button>
              </div>
            </div>

            {ppFeedback && (
              <div
                data-testid="auth-pp-feedback"
                className={`mb-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                  ppFeedback.type === 'ok'
                    ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                }`}
              >
                {ppFeedback.text}
              </div>
            )}

            {avatarTab === 'pp' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                {STAR_PP_AVATARS.map((pp) => {
                  const unlocked = unlockedSet.has(pp.giftId);
                  const isSelected = avatar === pp.avatarValue;
                  const canAfford = coins >= pp.costCoins;

                  return (
                    <button
                      key={pp.giftId}
                      type="button"
                      data-testid={`auth-pp-${pp.playerId}`}
                      onClick={() => handleSelectOrBuyPp(pp)}
                      className={`relative flex flex-col items-center p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/60'
                          : unlocked
                          ? 'bg-slate-900 border-slate-700 hover:border-emerald-400/60'
                          : canAfford
                          ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-900/60 border-slate-800 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="relative">
                        <PlayerAvatar
                          avatar={pp.avatarValue}
                          name={pp.name}
                          size="sm"
                          variant="circle"
                          className={!unlocked ? 'brightness-75' : ''}
                        />
                        {!unlocked && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-950 border border-amber-400 flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <span className="mt-1.5 text-[10px] font-black text-white leading-tight truncate w-full text-center">
                        {pp.name.replace(' PP', '')}
                      </span>
                      <span
                        className={`mt-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-emerald-400 text-slate-950'
                            : unlocked
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isSelected ? 'Seçili ✓' : unlocked ? 'Seç' : `${formatPoints(pp.costCoins)} 🪙`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                {FREE_AVATARS.map((av) => {
                  const isSelected = avatar === av;
                  return (
                    <button
                      key={av}
                      type="button"
                      data-testid={`auth-emoji-${av}`}
                      onClick={() => setAvatar(av)}
                      className={`w-full aspect-square max-w-[44px] mx-auto rounded-xl flex items-center justify-center text-xl transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950 scale-105 shadow-lg shadow-emerald-500/40 border-2 border-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800/80'
                      }`}
                    >
                      {av}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Username Input with Selected Avatar Preview */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
              Oyuncu İsminiz
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-2.5 flex items-center justify-center pointer-events-none">
                <PlayerAvatar
                  avatar={avatar}
                  name={name}
                  size="sm"
                  className="bg-emerald-500/15 border border-emerald-500/40"
                />
              </div>
              <input
                type="text"
                data-testid="auth-name-input"
                required
                maxLength={18}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: KralForvet, KadıköyBoğası..."
                className="w-full bg-slate-950 text-white font-bold pl-13 pr-4 py-3 rounded-xl border border-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none text-base shadow-inner transition"
              />
            </div>
          </div>

          {/* Favorite Club Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
              Favori Kulübün
            </label>
            <button
              type="button"
              data-testid="auth-club-toggle"
              onClick={() => setShowClubPicker((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-emerald-400/60 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedClub ? (
                  <ClubLogo club={selectedClub} size="xs" />
                ) : (
                  <Shield className="w-4 h-4 text-emerald-400" />
                )}
                <span className="font-bold text-sm text-white truncate">
                  {selectedClub ? selectedClub.name : 'Kulüp Seç'}
                </span>
              </div>
              <span className="text-[11px] font-black text-emerald-400 shrink-0">
                {showClubPicker ? 'Kapat' : 'Değiştir'}
              </span>
            </button>

            {showClubPicker && (
              <div className="mt-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clubSearch}
                    onChange={(e) => setClubSearch(e.target.value)}
                    placeholder="Kulüp ara (Fenerbahçe, Real Madrid...)"
                    className="w-full bg-slate-900 text-white text-xs font-semibold pl-8 pr-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-400 outline-none"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1 pr-0.5">
                  {filteredClubs.map((club) => {
                    const active = club.id === favoriteClubId;
                    return (
                      <button
                        key={club.id}
                        type="button"
                        data-testid={`auth-club-${club.id}`}
                        onClick={() => {
                          setFavoriteClubId(club.id);
                          setShowClubPicker(false);
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 border border-emerald-400 text-white'
                            : 'bg-slate-900/70 hover:bg-slate-800 text-slate-200 border border-transparent'
                        }`}
                      >
                        <ClubLogo club={club} size="xs" />
                        <span className="truncate flex-1">{club.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {club.country}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-1">
            <button
              type="submit"
              data-testid="auth-save-btn"
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide uppercase transition active:scale-95 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Kaydedildi!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kaydet &amp; Oyuna Başla</span>
                </>
              )}
            </button>

            {!isInitialRequired && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2 text-xs text-slate-400 hover:text-white font-semibold py-1.5 cursor-pointer"
              >
                Kapat
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
