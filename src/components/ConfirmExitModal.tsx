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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1220]/90 animate-screen-fade"
    >
      <div className="relative w-full max-w-sm bg-[#16212E] border border-[#A8B3C2]/25 rounded-3xl p-5 sm:p-6 text-center shadow-2xl overflow-hidden animate-screen-slide-up">
        {/* Strong Red Warning Badge (Zero muddied neon glow) */}
        <div className="relative mx-auto mb-3.5 w-14 h-14 rounded-2xl bg-[#DC2626]/15 border border-[#DC2626]/60 flex items-center justify-center text-[#DC2626]">
          <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Crisp White Heading & Readable Description */}
        <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] tracking-wide uppercase">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#A8B3C2] mt-1.5 leading-relaxed">
          {description}
        </p>

        {/* Action Buttons: Strong Red Evet + Dark Neutral Vazgeç */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-testid="confirm-exit-yes-btn"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-[#FFFFFF] font-black text-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            aria-label="Evet"
          >
            <LogOut className="w-4 h-4" />
            <span>Evet, Çık</span>
          </button>

          <button
            type="button"
            data-testid="confirm-exit-cancel-btn"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#A8B3C2]/25 text-[#F5F3EB] font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
