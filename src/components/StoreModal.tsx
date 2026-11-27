import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Film,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { PlayerProfile, ShopGiftItem, StoreCategory, UserProgression } from '../game/types';
import { formatPoints } from '../game/retentionEngine';
import { getFrameClasses, STORE_ITEMS } from '../game/storeCatalog';
import { CoinIcon } from './CoinIcon';
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
  onWatchAdForCoins?: () => void;
  onRestorePurchases?: () => Promise<{ ok: boolean; message: string }>;
}

const CATEGORIES: { id: StoreCategory; label: string; icon: string }[] = [
  { id: 'featured', label: 'Öne Çıkanlar', icon: '⭐' },
  { id: 'crests_frames', label: 'Arma & Çerçeve', icon: '🛡️' },
  { id: 'pp_badges', label: 'Rozet & Ünvan', icon: '🏅' },
];

const ALLOWED_STORE_ITEM_TYPES = new Set(['crest', 'frame', 'badge', 'title']);

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  progression,
  initialCategory = 'featured',
  onClose,
  onPurchaseItem,
  onEquipItem,
  onWatchAdForCoins,
}) => {
  const [activeCategory, setActiveCategory] = useState<StoreCategory>(initialCategory);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{
    item: ShopGiftItem;
    method: 'coins' | 'money';
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const normalized: StoreCategory =
        initialCategory === 'crests_frames' || initialCategory === 'pp_badges'
          ? initialCategory
          : 'featured';
      setActiveCategory(normalized);
    }
  }, [isOpen, initialCategory]);

  const visibleItems = useMemo(() => {
    const cleanPool = STORE_ITEMS.filter(
      (item) => ALLOWED_STORE_ITEM_TYPES.has(item.type) && item.costCoins > 0
    );
    if (activeCategory === 'featured') {
      return cleanPool.slice(0, 8);
    }
    if (activeCategory === 'crests_frames') {
      return cleanPool.filter((i) => i.type === 'crest' || i.type === 'frame');
    }
    return cleanPool.filter((i) => i.type === 'badge' || i.type === 'title');
  }, [activeCategory]);

  if (!isOpen) return null;

  const isPermanentOwned = (item: ShopGiftItem): boolean =>
    progression.unlockedGiftIds.includes(item.id);

  const isItemEquipped = (item: ShopGiftItem): boolean => {
    switch (item.type) {
      case 'title':
        return progression.equippedTitle === item.value;
      case 'crest':
        return progression.equippedCrest === item.value;
      case 'frame':
        return progression.equippedFrame === item.value;
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

  const executeConfirmedPurchase = () => {
    if (!pendingPurchase) return;
    const { item, method } = pendingPurchase;
    const res = onPurchaseItem(item.id, method);
    if (res.ok) {
      sounds.playVictory();
      showStatus('ok', `${item.title} satın alındı ve etkinleştirildi!`);
      setPendingPurchase(null);
    } else {
      sounds.playWrong();
      showStatus('err', res.reason || 'Satın alma tamamlanamadı.');
      setPendingPurchase(null);
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
    setPendingPurchase({ item, method: 'coins' });
  };

  return (
    <div
      data-testid="store-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-[#092316]/88 overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-2xl lg:max-w-4xl bg-[#124029] border-2 border-[#E5B94F]/45 rounded-3xl p-3.5 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F5F3EB]/15 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0F273E] border border-[#E5B94F]/55 text-[#E5B94F] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#FFFFFF] uppercase leading-tight">
                Mağaza
              </h2>
              <p className="text-[11px] text-[#C4D6CA] font-medium leading-snug">
                Coinlerinle kulüp arması, çerçeve, rozet ve ünvan aç
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="store-close-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#F5F3EB]/20 text-[#C4D6CA] hover:text-[#FFFFFF] flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Mağazayı Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance + Free Ad Coins Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-3 shrink-0">
          <div className="px-3 py-2.5 rounded-2xl bg-[#0F273E] border border-[#E5B94F]/40 flex items-center gap-2.5">
            <CoinIcon size="sm" />
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-[#C4D6CA]">
                Coin Bakiyesi
              </span>
              <span
                data-testid="store-coins-balance"
                className="block text-sm font-black font-score text-[#E5B94F] truncate"
              >
                {formatPoints(progression.coins)} Coin
              </span>
            </div>
          </div>

          {onWatchAdForCoins && (
            <button
              type="button"
              data-testid="store-watch-ad-coins-btn"
              onClick={onWatchAdForCoins}
              className="px-3 py-2.5 rounded-2xl bg-[#166D3F] hover:bg-[#1B804B] border border-[#4ADE80]/55 text-[#FFFFFF] font-black text-xs flex items-center justify-between gap-2 transition active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 text-left">
                <Film className="w-4 h-4 text-[#E5B94F] shrink-0" />
                <div className="min-w-0">
                  <span className="block text-xs font-black truncate">
                    Reklam İzle (+250 Coin)
                  </span>
                  <span className="block text-[10px] font-semibold text-[#D7E6DC] truncate">
                    Kısa ödüllü reklam ile ücretsiz Coin
                  </span>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-[#0F273E] text-[#E5B94F] text-[10px] font-black shrink-0">
                +250
              </span>
            </button>
          )}
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
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1 border transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#22C55E] text-[#080E14] border-[#22C55E]'
                    : 'bg-[#14232C] text-[#94A3B8] border-white/10 hover:text-[#F8FAFC]'
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
            className={`mb-2 px-3 py-2 rounded-xl border text-xs font-bold shrink-0 ${
              feedback.type === 'ok'
                ? 'bg-[#144D2F] border-[#4ADE80]/55 text-[#4ADE80]'
                : 'bg-[#C93B32]/20 border-[#C93B32]/65 text-[#F87171]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Items Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {visibleItems.map((item) => {
            const owned = isPermanentOwned(item);
            const equipped = owned && isItemEquipped(item);
            const framePreview = item.type === 'frame' ? getFrameClasses(item.value) : '';

            return (
              <div
                key={item.id}
                data-testid={`store-item-${item.id}`}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition ${
                  equipped
                    ? 'bg-[#123D2B]/65 border-[#22C55E]/60'
                    : owned
                    ? 'bg-[#14232C] border-white/15'
                    : 'bg-[#14232C] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl bg-[#080E14] border border-white/10 flex items-center justify-center text-xl shrink-0 ${framePreview}`}
                  >
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs sm:text-sm text-[#F8FAFC] leading-tight truncate">
                        {item.title}
                      </span>
                      {owned && (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {owned ? (
                    <button
                      type="button"
                      data-testid={`store-equip-${item.id}`}
                      onClick={() => handleEquip(item)}
                      className={`w-full py-2 rounded-xl font-black text-xs transition cursor-pointer ${
                        equipped
                          ? 'bg-[#22C55E]/20 border border-[#22C55E] text-[#22C55E]'
                          : 'bg-[#080E14] hover:bg-[#080E14]/80 border border-white/10 text-[#F8FAFC]'
                      }`}
                    >
                      {equipped ? 'Kullanılıyor ✓' : 'Kullan'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid={`store-buy-coin-${item.id}`}
                      onClick={() => setPendingPurchase({ item, method: 'coins' })}
                      className="w-full py-2 px-2 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-[#080E14] font-black text-[11px] transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <CoinIcon size="xs" />
                      <span>{formatPoints(item.costCoins)} Coin</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coin Purchase Confirmation Modal */}
        {pendingPurchase && (
          <div
            data-testid="store-purchase-confirm-modal"
            className="absolute inset-0 z-20 bg-[#080E14]/95 flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#101B24] border border-[#22C55E]/40 p-5 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#123D2B] border border-[#22C55E]/40 flex items-center justify-center text-2xl mx-auto mb-2.5">
                {pendingPurchase.item.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#22C55E]">
                SATIN ALMA ONAYI
              </span>
              <h3 className="text-lg font-black text-[#F8FAFC] mt-1">
                {pendingPurchase.item.title}
              </h3>
              <p
                data-testid="store-confirm-prompt"
                className="text-xs sm:text-sm font-bold text-[#94A3B8] mt-2 leading-relaxed"
              >
                <span className="text-[#F8FAFC]">{pendingPurchase.item.title}</span> ürününü{' '}
                <span className="text-[#FBBF24] font-black">
                  {formatPoints(pendingPurchase.item.costCoins)} Coin
                </span>{' '}
                karşılığında açmak istiyor musun?
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  data-testid="store-confirm-cancel-btn"
                  onClick={() => setPendingPurchase(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#14232C] hover:bg-[#080E14] border border-white/10 text-[#94A3B8] font-bold text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  data-testid="store-confirm-buy-btn"
                  onClick={executeConfirmedPurchase}
                  className="flex-1 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-[#080E14] font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Satın Al</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
