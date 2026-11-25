import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, Play, Sparkles } from 'lucide-react';
import { BotDifficulty, MinigameType } from '../game/types';
import { BOT_TIER_METADATA } from '../game/botEngine';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';

interface BotSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (difficulty: BotDifficulty, minigameType: MinigameType) => void;
}

const BOT_TIERS = [
  {
    ...BOT_TIER_METADATA.easy,
    tag: 'Kolay',
  },
  {
    ...BOT_TIER_METADATA.medium,
    tag: 'Orta',
  },
  {
    ...BOT_TIER_METADATA.hard,
    tag: 'Zor',
  },
];

export const BotSetupModal: React.FC<BotSetupModalProps> = ({
  isOpen,
  onClose,
  onStart,
}) => {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [minigameType, setMinigameType] = useState<MinigameType>('two_clubs');

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-testid="bot-setup-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-[#0B1220]/90 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-[#16212E] border-2 border-[#F97316]/60 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto text-[#F5F3EB]">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#F97316]/15 border border-[#F97316]/60 flex items-center justify-center text-[#F97316] shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] uppercase leading-tight">
                Bot ile Antrenman
              </h3>
              <p className="text-xs text-[#A8B3C2]">Bot seviyesini ve oyun türünü seç</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#A8B3C2] hover:text-[#FFFFFF] flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bot Difficulty Selection: Çırak / Şampiyon / Efsane */}
        <div className="mb-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-[#A8B3C2] mb-2">
            Bot Seviyesi
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BOT_TIERS.map((tier) => {
              const active = difficulty === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  data-testid={`bot-diff-${tier.id}`}
                  onClick={() => setDifficulty(tier.id)}
                  className={`p-3 rounded-2xl border text-center transition active:scale-95 cursor-pointer ${
                    active
                      ? 'bg-[#F97316]/20 border-[#F97316] ring-2 ring-[#F97316]/30 shadow-md'
                      : 'bg-[#0B1220] border-[#A8B3C2]/20 hover:border-[#F97316]/50'
                  }`}
                >
                  <span className="text-2xl block mb-1">{tier.emoji}</span>
                  <span className="block font-display font-extrabold text-base text-[#FFFFFF] uppercase leading-tight">
                    {tier.title}
                  </span>
                  <span className="block text-[10px] text-[#A8B3C2] mt-0.5 leading-tight">
                    {tier.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Minigame Selection */}
        <div className="mb-5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-[#A8B3C2] mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#E5B94F]" />
            <span>Oyun Çeşidi (4 Oyun)</span>
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {MINIGAME_OPTIONS.map((mg) => {
              const active = minigameType === mg.id;
              return (
                <button
                  key={mg.id}
                  type="button"
                  data-testid={`bot-minigame-${mg.id}`}
                  onClick={() => setMinigameType(mg.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? 'bg-[#183D2B] border-[#22C55E] text-[#FFFFFF]'
                      : 'bg-[#0B1220] border-[#A8B3C2]/15 text-[#A8B3C2] hover:border-[#3B82F6]/50 hover:text-[#FFFFFF]'
                  }`}
                >
                  <span className="font-bold text-xs sm:text-sm">{mg.title}</span>
                  <span className="text-[10px] font-black uppercase text-[#E5B94F]">
                    {mg.badgeText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          data-testid="bot-start-match-btn"
          onClick={() => onStart(difficulty, minigameType)}
          className="w-full py-3.5 rounded-xl bg-[#F97316] hover:bg-[#fb923c] text-[#0B1220] font-display font-extrabold text-xl tracking-wider uppercase flex items-center justify-center gap-2 transition active:scale-95 shadow-lg cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Antrenmanı Başlat</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
