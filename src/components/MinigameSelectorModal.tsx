import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Grid3X3,
  History,
  Flag,
  UserSearch,
  Globe,
  Bot,
  X,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { BotDifficulty, MinigameType } from '../game/types';
import { MINIGAME_OPTIONS, MinigameMeta } from '../game/minigameEngine';

interface MinigameSelectorModalProps {
  isOpen: boolean;
  context: 'online_match' | 'minigames';
  initialMinigame?: MinigameType;
  onClose: () => void;
  onStartOnlineMatch: (minigameType: MinigameType) => void;
  onCreatePrivateRoom: (minigameType: MinigameType) => void;
  onStartBotMatch: (minigameType: MinigameType, difficulty: BotDifficulty) => void;
}

const ACCENT_CLASSES: Record<MinigameMeta['accentColor'], string> = {
  emerald: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/45 bg-amber-500/10 text-amber-300',
  purple: 'border-purple-500/45 bg-purple-500/10 text-purple-300',
  sky: 'border-sky-500/45 bg-sky-500/10 text-sky-300',
  rose: 'border-rose-500/45 bg-rose-500/10 text-rose-300',
};

const LABEL_TEXT_CLASSES: Record<MinigameMeta['accentColor'], string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  purple: 'text-purple-300',
  sky: 'text-sky-300',
  rose: 'text-rose-300',
};

function renderMinigameIcon(type: MinigameType) {
  switch (type) {
    case 'two_clubs':
      return <Users className="w-5 h-5" />;
    case 'xox':
      return <Grid3X3 className="w-5 h-5" />;
    case 'career':
      return <History className="w-5 h-5" />;
    case 'country_club':
      return <Flag className="w-5 h-5" />;
    default:
      return <UserSearch className="w-5 h-5" />;
  }
}

export const MinigameSelectorModal: React.FC<MinigameSelectorModalProps> = ({
  isOpen,
  context,
  initialMinigame = 'two_clubs',
  onClose,
  onStartOnlineMatch,
  onCreatePrivateRoom,
  onStartBotMatch,
}) => {
  const [selected, setSelected] = useState<MinigameType>(initialMinigame);
  const [botDiff, setBotDiff] = useState<BotDifficulty>('medium');

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-testid="minigame-selector-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-400/45 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
              {context === 'online_match' ? "1'E 1 ÇEVRİM İÇİ YARIŞMA" : '4 FARKLI FUTBOL OYUNU'}
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 leading-snug">
              {context === 'online_match'
                ? 'Hangi Mini Oyunda Eşleşelim?'
                : 'Oyun Türünü Seç'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tüm oyunlarda 3-2-1 geri sayım, ilk 3 olan kazanır kuralı geçerlidir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Minigame Cards */}
        <div className="space-y-2">
          {MINIGAME_OPTIONS.map((item, idx) => {
            const isSelected = selected === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`minigame-option-${item.id}`}
                onClick={() => {
                  if (context === 'online_match') {
                    onStartOnlineMatch(item.id);
                  } else {
                    setSelected(item.id);
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition active:scale-[0.99] cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/95 border-cyan-400 ring-2 ring-cyan-500/25 shadow-lg'
                    : 'bg-slate-950/75 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                    ACCENT_CLASSES[item.accentColor]
                  }`}
                >
                  {renderMinigameIcon(item.id)}
                </div>

                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wider leading-none ${
                      LABEL_TEXT_CLASSES[item.accentColor]
                    }`}
                  >
                    {item.badgeText}
                  </span>
                  <span className="block font-black text-sm text-white leading-snug mt-0.5">
                    {idx + 1}. {item.title}
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {item.description}
                  </span>
                </div>

                {context === 'online_match' && (
                  <ArrowRight className="w-4 h-4 text-cyan-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action buttons for 'minigames' context */}
        {context === 'minigames' && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="minigame-play-online-btn"
                onClick={() => onStartOnlineMatch(selected)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs sm:text-sm transition active:scale-95 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>1v1 Çevrim İçi Eşleş</span>
              </button>

              <button
                type="button"
                data-testid="minigame-play-room-btn"
                onClick={() => onCreatePrivateRoom(selected)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm transition active:scale-95 shadow-lg shadow-purple-600/25 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Arkadaşla Özel Oda</span>
              </button>
            </div>

            {/* Solo Bot shortcut inside Minigames */}
            <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 px-1">
                  Bot:
                </span>
                {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setBotDiff(diff)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      botDiff === diff
                        ? 'bg-blue-600 text-white font-black'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {diff === 'easy'
                      ? '🌱 Çırak'
                      : diff === 'medium'
                      ? '🏆 Şampiyon'
                      : '👑 Efsane'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="minigame-play-bot-btn"
                onClick={() => onStartBotMatch(selected, botDiff)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition active:scale-95 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Bot ile Başla</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
