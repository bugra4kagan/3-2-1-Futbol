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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#092316]/88 animate-screen-fade"
    >
      <div className="relative w-full max-w-sm bg-[#124029] border-2 border-[#E5B94F]/45 rounded-3xl p-5 sm:p-6 text-center shadow-2xl overflow-hidden animate-screen-slide-up">
        {/* Theme-harmonized sports crimson badge */}
        <div className="relative mx-auto mb-3.5 w-14 h-14 rounded-2xl bg-[#C93B32]/20 border border-[#C93B32]/65 flex items-center justify-center text-[#F87171]">
          <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Crisp White Heading & Readable Description */}
        <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] tracking-wide uppercase">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#D7E6DC] mt-1.5 leading-relaxed">
          {description}
        </p>

        {/* Action Buttons: Clean Crimson Evet + Navy-Olive Vazgeç */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-testid="confirm-exit-yes-btn"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-[#C93B32] hover:bg-[#B22F27] text-[#FFFFFF] font-black text-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            aria-label="Evet"
          >
            <LogOut className="w-4 h-4" />
            <span>Evet, Çık</span>
          </button>

          <button
            type="button"
            data-testid="confirm-exit-cancel-btn"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-[#0F273E] hover:bg-[#163654] border border-[#E5B94F]/35 text-[#F5F3EB] font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
