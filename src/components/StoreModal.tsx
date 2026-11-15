import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Coins,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { PlayerProfile, ShopGiftItem, StoreCategory, UserProgression } from '../game/types';
import { formatPoints } from '../game/retentionEngine';
import { formatTry, getFrameClasses, STORE_ITEMS } from '../game/storeCatalog';
import { isPhotoAvatar } from '../game/avatarCatalog';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/audio';

interface StoreModalProps {
  isOpen: boolean;
  playerProfile: PlayerProfile;
  progression: UserProgression;
  initialCategory?: StoreCategory;
  onClose: () => void;
  onPurchaseItem: (
    itemId: string,
    method: 'coins' | 'money'
  ) => { ok: boolean; reason?: string; gift?: ShopGiftItem };
  onEquipItem?: (itemId: string) => { ok: boolean; reason?: string };
}

const CATEGORIES: { id: StoreCategory; label: string; icon: string }[] = [
  { id: 'featured', label: 'Öne Çıkanlar', icon: '⭐' },
  { id: 'ads_coins', label: 'Reklam & Coin', icon: '💎' },
  { id: 'crests_frames', label: 'Arma & Çerçeve', icon: '🛡️' },
  { id: 'themes_effects', label: 'Saha & Efekt', icon: '🏟️' },
  { id: 'pp_badges', label: 'PP & Rozet', icon: '🖼️' },
];

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  playerProfile,
  progression,
  initialCategory = 'featured',
  onClose,
  onPurchaseItem,
  onEquipItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<StoreCategory>(initialCategory);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<ShopGiftItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_google'>('apple_google');

  const visibleItems = useMemo(() => {
    if (activeCategory === 'featured') {
      const featuredIds = new Set([
        'store_ad_free',
        'store_energy_1',
        'store_energy_3',
        'store_mult_2x_5',
        'pack_coin_6000',
        'frame_gold',
        'crest_gold_crown',
        'pitch_ucl_night',
        'effect_gold_fireworks',
        'badge_king_crown',
      ]);
      return STORE_ITEMS.filter(
        (item) => item.category === 'featured' || featuredIds.has(item.id)
      );
    }
    return STORE_ITEMS.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  if (!isOpen) return null;

  const isPermanentOwned = (item: ShopGiftItem): boolean => {
    if (item.type === 'ad_free') return Boolean(progression.adFree);
    if (item.type === 'multiplier_2x' && item.value === 'forever') {
      return Boolean(progression.permanentMultiplier2x);
    }
    if (
      item.type === 'coin_pack' ||
      item.type === 'energy_pack' ||
      item.type === 'multiplier_2x'
    ) {
      return false;
    }
    return progression.unlockedGiftIds.includes(item.id);
  };

  const isItemEquipped = (item: ShopGiftItem): boolean => {
    switch (item.type) {
      case 'title':
        return progression.equippedTitle === item.value;
      case 'avatar':
        return playerProfile.avatar === item.value;
      case 'crest':
        return progression.equippedCrest === item.value;
      case 'frame':
        return progression.equippedFrame === item.value;
      case 'pitch_theme':
        return progression.equippedPitchTheme === item.value;
      case 'goal_effect':
        return progression.equippedGoalEffect === item.value;
      case 'badge':
        return progression.equippedBadge === item.value;
      default:
        return false;
    }
  };

  const showStatus = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleCoinPurchase = (item: ShopGiftItem) => {
    const res = onPurchaseItem(item.id, 'coins');
    if (res.ok) {
      sounds.playVictory();
      showStatus('ok', `${item.title} satın alındı ve etkinleştirildi!`);
    } else {
      sounds.playWrong();
      showStatus('err', res.reason || 'Satın alma tamamlanamadı.');
    }
  };

  const handleEquip = (item: ShopGiftItem) => {
    if (onEquipItem) {
      const res = onEquipItem(item.id);
      if (res.ok) {
        sounds.playCorrect();
        showStatus('ok', `${item.title} kullanılıyor!`);
        return;
      }
    }
    handleCoinPurchase(item);
  };

  const handleConfirmMoneyPurchase = () => {
    if (!checkoutItem) return;
    const res = onPurchaseItem(checkoutItem.id, 'money');
    if (res.ok) {
      sounds.playVictory();
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#fbbf24', '#10b981', '#38bdf8'],
        });
      } catch {
        // ignore
      }
      showStatus('ok', `${checkoutItem.title} hesabına tanımlandı! 🎉`);
      setCheckoutItem(null);
    } else {
      sounds.playWrong();
      showStatus('err', res.reason || 'Ödeme başarısız.');
      setCheckoutItem(null);
    }
  };

  return (
    <div
      data-testid="store-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-400/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <ShoppingBag className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white leading-tight truncate">
                Şampiyonlar Mağazası
              </h2>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Coin veya Mağaza Ödemesi (₺) ile güçlendiriciler &amp; kozmetikler
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="store-close-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Mağazayı Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inventory & Balance Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 shrink-0">
          <div className="px-2.5 py-2 rounded-xl bg-slate-950/90 border border-amber-500/30 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-slate-400">Coin</span>
              <span
                data-testid="store-coins-balance"
                className="block text-xs sm:text-sm font-black font-mono text-amber-400 truncate"
              >
                {formatPoints(progression.coins)}
              </span>
            </div>
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex items-center gap-2">
            <span className="text-base shrink-0">🥤</span>
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-slate-400">
                Enerji İçeceği
              </span>
              <span
                data-testid="store-energy-count"
                className="block text-xs sm:text-sm font-black font-mono text-cyan-300"
              >
                {progression.energyDrinks ?? 0} Adet
              </span>
            </div>
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-slate-400">
                2x Katlayıcı
              </span>
              <span
                data-testid="store-multiplier-status"
                className="block text-xs sm:text-sm font-black text-emerald-300 truncate"
              >
                {progression.permanentMultiplier2x
                  ? 'Kalıcı Aktif'
                  : (progression.multiplier2xMatches ?? 0) > 0
                  ? `${progression.multiplier2xMatches} Maç`
                  : 'Pasif'}
              </span>
            </div>
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950/90 border border-purple-500/30 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-slate-400">
                Reklam Durumu
              </span>
              <span
                data-testid="store-adfree-status"
                className="block text-xs sm:text-sm font-black text-purple-300 truncate"
              >
                {progression.adFree ? 'VIP Reklamsız' : 'Standart'}
              </span>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center sm:flex-wrap sm:justify-center gap-1.5 overflow-x-auto pb-2 shrink-0">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`store-cat-${cat.id}`}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1 border transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            data-testid="store-feedback"
            className={`my-1.5 px-3 py-2 rounded-xl border text-xs font-bold shrink-0 ${
              feedback.type === 'ok'
                ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Store Items Grid */}
        <div className="flex-1 overflow-y-auto pr-0.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {visibleItems.map((item) => {
            const owned = isPermanentOwned(item);
            const equipped = isItemEquipped(item);
            const isFrame = item.type === 'frame';
            const framePreview = isFrame ? getFrameClasses(item.value) : '';

            return (
              <div
                key={item.id}
                data-testid={`store-item-${item.id}`}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition ${
                  equipped
                    ? 'bg-emerald-950/35 border-emerald-400/60'
                    : owned
                    ? 'bg-slate-900/95 border-slate-700'
                    : 'bg-slate-950/85 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {item.type === 'avatar' && isPhotoAvatar(item.value) ? (
                    <PlayerAvatar
                      avatar={item.value}
                      name={item.title}
                      size="md"
                      className="border border-slate-700 bg-slate-900 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0 ${framePreview}`}
                    >
                      {item.icon}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs sm:text-sm text-white leading-tight truncate">
                        {item.title}
                      </span>
                      {owned && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  {owned ? (
                    item.type === 'ad_free' || item.type === 'multiplier_2x' ? (
                      <div className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 font-black text-xs text-center">
                        Aktif ✓
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`store-equip-${item.id}`}
                        onClick={() => handleEquip(item)}
                        className={`w-full py-2 rounded-xl font-black text-xs transition cursor-pointer ${
                          equipped
                            ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-white'
                        }`}
                      >
                        {equipped ? 'Kullanılıyor ✓' : 'Kullan'}
                      </button>
                    )
                  ) : (
                    <div className="w-full flex flex-col gap-1.5">
                      {item.costCoins <= 0 && item.type !== 'coin_pack' && (
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/40 text-purple-200 font-black text-[10px] uppercase tracking-wide">
                          💳 Sadece Gerçek Para (₺)
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 w-full">
                        {item.costCoins > 0 && (
                          <button
                            type="button"
                            data-testid={`store-buy-coin-${item.id}`}
                            onClick={() => handleCoinPurchase(item)}
                            className="flex-1 py-2 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span>🪙 {formatPoints(item.costCoins)}</span>
                          </button>
                        )}
                        {item.priceTry && item.priceTry > 0 && (
                          <button
                            type="button"
                            data-testid={`store-buy-money-${item.id}`}
                            onClick={() => setCheckoutItem(item)}
                            className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[11px] transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <CreditCard className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatTry(item.priceTry)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-Money Checkout Confirmation Sheet */}
        {checkoutItem && (
          <div
            data-testid="store-checkout-sheet"
            className="absolute inset-0 z-20 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          >
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-400/50 p-5 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl mx-auto mb-2.5">
                {checkoutItem.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                GÜVENLİ MAĞAZA ÖDEMESİ
              </span>
              <h3 className="text-lg font-black text-white mt-1">{checkoutItem.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{checkoutItem.description}</p>

              <div className="my-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Toplam Tutar</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatTry(checkoutItem.priceTry)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('apple_google')}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-black cursor-pointer ${
                    paymentMethod === 'apple_google'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  📱 App / Play Pay
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-black cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  💳 Kredi / Banka Kartı
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="store-checkout-cancel"
                  onClick={() => setCheckoutItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  data-testid="store-checkout-confirm"
                  onClick={handleConfirmMoneyPurchase}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ödemeyi Onayla</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
