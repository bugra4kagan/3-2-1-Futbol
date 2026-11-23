import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, Play, Sparkles } from 'lucide-react';
import { BotDifficulty, MinigameType } from '../game/types';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';

interface BotSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (difficulty: BotDifficulty, minigameType: MinigameType) => void;
}

const BOT_TIERS: {
  id: BotDifficulty;
  title: string;
  subtitle: string;
  emoji: string;
}[] = [
  {
    id: 'easy',
    title: 'Çırak',
    subtitle: 'Isınma temposu (4.5-7.5 sn • %65 isabet)',
    emoji: '🌱',
  },
  {
    id: 'medium',
    title: 'Şampiyon',
    subtitle: 'Güçlü & seri rakip (2.5-4.5 sn • %82 isabet)',
    emoji: '🏆',
  },
  {
    id: 'hard',
    title: 'Efsane',
    subtitle: 'Futbol ansiklopedisi (1.5-3.0 sn • %94 isabet)',
    emoji: '👑',
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
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-slate-900 border border-blue-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Bot ile Antrenman</h3>
              <p className="text-xs text-slate-400">Bot seviyesini ve oyun türünü seç</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bot Difficulty Selection: Çırak / Şampiyon / Efsane */}
        <div className="mb-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
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
                      ? 'bg-blue-600/25 border-blue-400 ring-2 ring-blue-500/25 shadow-md'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl block mb-1">{tier.emoji}</span>
                  <span className="block font-black text-xs sm:text-sm text-white">
                    {tier.title}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {tier.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Minigame Selection */}
        <div className="mb-5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
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
                      ? 'bg-emerald-500/15 border-emerald-400 text-white'
                      : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs sm:text-sm">{mg.title}</span>
                  <span className="text-[10px] font-black uppercase text-slate-400">
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
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-blue-600/25 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Antrenmanı Başlat</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
