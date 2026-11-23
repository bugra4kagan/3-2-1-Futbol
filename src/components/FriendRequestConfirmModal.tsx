import React from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, X } from 'lucide-react';
import { FriendTargetCandidate, formatPoints } from '../game/retentionEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface FriendRequestConfirmModalProps {
  isOpen: boolean;
  target: FriendTargetCandidate | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FriendRequestConfirmModal: React.FC<FriendRequestConfirmModalProps> = ({
  isOpen,
  target,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !target) return null;

  const modalContent = (
    <div
      data-testid="friend-request-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-req-confirm-title"
      aria-describedby="friend-req-confirm-desc"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-screen-fade"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/45 p-5 sm:p-6 shadow-2xl text-center animate-screen-slide-up">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Kapat"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mb-3 shadow-inner">
          <PlayerAvatar
            avatar={target.avatar}
            name={target.name}
            size="md"
            variant="circle"
            className="bg-slate-800 border border-emerald-400/50"
          />
        </div>

        <h3
          id="friend-req-confirm-title"
          className="text-base sm:text-lg font-black text-white leading-snug"
        >
          Arkadaşlık İsteği Gönder
        </h3>

        <p
          id="friend-req-confirm-desc"
          data-testid="friend-request-confirm-message"
          className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed"
        >
          <strong className="text-emerald-300 font-black">{target.name}</strong> adlı oyuncuyu arkadaş olarak eklemek ister misin?
        </p>

        {(target.friendCode || target.totalPoints > 0) && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-bold text-slate-300">
            {target.friendCode && (
              <span className="font-mono text-emerald-300">#{target.friendCode}</span>
            )}
            {target.totalPoints > 0 && (
              <span className="text-amber-300">{formatPoints(target.totalPoints)} puan</span>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            data-testid="cancel-send-friend-request-btn"
            onClick={onCancel}
            className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            data-testid="confirm-send-friend-request-btn"
            onClick={onConfirm}
            className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg shadow-emerald-500/25 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Evet, İstek Gönder</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
