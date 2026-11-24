import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Flame, Trophy, X } from 'lucide-react';
import { ToastItem } from '../game/types';
import { PlayerAvatar } from './PlayerAvatar';

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onAction?: (toast: ToastItem) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss, onAction }) => {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs || 6500);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, paused, onDismiss]);

  const isTournament = toast.type === 'tournament_started';
  const accentBorder = isTournament
    ? 'border-amber-400/60 shadow-amber-500/15'
    : 'border-emerald-400/60 shadow-emerald-500/15';
  const badgeStyle = isTournament
    ? 'bg-amber-500/20 text-amber-300 border-amber-400/35'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/35';
  const actionStyle = isTournament
    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950';

  return (
    <div
      role="status"
      data-testid={`toast-item-${toast.type}`}
      data-toast-id={toast.id}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-slate-900/96 p-3.5 shadow-2xl transition-all animate-screen-slide ${accentBorder}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 pt-0.5">
          <PlayerAvatar
            avatar={toast.actorAvatar}
            name={toast.actorName}
            size="sm"
          />
          <span
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md border border-slate-950 flex items-center justify-center ${
              isTournament
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {isTournament ? (
              <Trophy className="w-3 h-3" />
            ) : (
              <Flame className="w-3 h-3" />
            )}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${badgeStyle}`}
            >
              {toast.badgeLabel}
            </span>
            <button
              type="button"
              data-testid={`toast-dismiss-${toast.id}`}
              onClick={() => onDismiss(toast.id)}
              aria-label={`${toast.actorName} bildirimini kapat`}
              className="p-1 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/90 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-sm font-black text-white leading-snug truncate">
            {toast.title}
          </p>
          <p className="text-xs font-semibold text-slate-300 mt-0.5 leading-snug line-clamp-2">
            {toast.message}
          </p>

          {onAction && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                data-testid={`toast-action-${toast.type}`}
                onClick={() => {
                  onAction(toast);
                  onDismiss(toast.id);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${actionStyle}`}
              >
                <span>
                  {isTournament
                    ? toast.tournamentCode
                      ? `Katıl (${toast.tournamentCode})`
                      : 'Turnuvaya Bak'
                    : 'Profili Gör'}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-70 ${
          isTournament
            ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
            : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
        }`}
      />
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onAction?: (toast: ToastItem) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onAction,
}) => {
  if (toasts.length === 0) return null;

  return (
    <section
      aria-label="Canlı arkadaş bildirimleri"
      aria-live="polite"
      data-testid="toast-container"
      className="pointer-events-none fixed top-3 inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 sm:w-[376px] z-[90] flex flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onAction={onAction}
        />
      ))}
    </section>
  );
};
