import React from 'react';
import { AlertTriangle, LogOut, X } from 'lucide-react';

interface ConfirmExitModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export const ConfirmExitModal: React.FC<ConfirmExitModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Çıkmak istediğinize emin misiniz?',
  description = 'Devam eden maçınız sonlanacak ve kaydedilmemiş tur puanları sıfırlanacaktır.',
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="confirm-exit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/92 animate-screen-fade"
    >
      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-rose-500/40 rounded-3xl p-5 sm:p-6 text-center shadow-2xl overflow-hidden animate-screen-slide-up">

        {/* Warning Icon Badge */}
        <div className="relative mx-auto mb-3.5 w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
          <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Heading */}
        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
          {description}
        </p>

        {/* Action Buttons: "Evet" ve "Vazgeç" */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm transition active:scale-95 shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
            aria-label="Evet"
          >
            <LogOut className="w-4 h-4" />
            <span>Evet</span>
          </button>

          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            aria-label="Vazgeç"
          >
            <X className="w-4 h-4" />
            <span>Vazgeç</span>
          </button>
        </div>
      </div>
    </div>
  );
};
