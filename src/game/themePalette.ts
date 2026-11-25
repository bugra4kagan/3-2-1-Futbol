export const THEME_COLORS = {
  bgPrimary: '#0B1220',
  bgSecondary: '#16212E',
  bgElevated: '#1E293B',
  footballGreen: '#168A52',
  darkGreen: '#183D2B',
  orange: '#F97316',
  gold: '#E5B94F',
  cream: '#F5F3EB',
  white: '#FFFFFF',
  textSecondary: '#A8B3C2',
  infoBlue: '#3B82F6',
  dangerRed: '#DC2626',
  correctGreen: '#22C55E',
} as const;

export const MODAL_SEMANTIC_TONES = {
  success: {
    badgeBg: 'bg-[#183D2B]',
    badgeBorder: 'border-[#22C55E]/50',
    badgeText: 'text-[#22C55E]',
    buttonBg: 'bg-[#168A52] hover:bg-[#22C55E]',
    buttonText: 'text-[#FFFFFF]',
  },
  error: {
    badgeBg: 'bg-[#DC2626]/15',
    badgeBorder: 'border-[#DC2626]/55',
    badgeText: 'text-[#DC2626]',
    buttonBg: 'bg-[#DC2626] hover:bg-[#ef4444]',
    buttonText: 'text-[#FFFFFF]',
  },
  warning: {
    badgeBg: 'bg-[#F97316]/15',
    badgeBorder: 'border-[#F97316]/55',
    badgeText: 'text-[#F97316]',
    buttonBg: 'bg-[#F97316] hover:bg-[#fb923c]',
    buttonText: 'text-[#0B1220]',
  },
  info: {
    badgeBg: 'bg-[#3B82F6]/15',
    badgeBorder: 'border-[#3B82F6]/55',
    badgeText: 'text-[#3B82F6]',
    buttonBg: 'bg-[#3B82F6] hover:bg-[#60a5fa]',
    buttonText: 'text-[#FFFFFF]',
  },
  reward: {
    badgeBg: 'bg-[#E5B94F]/15',
    badgeBorder: 'border-[#E5B94F]/55',
    badgeText: 'text-[#E5B94F]',
    buttonBg: 'bg-[#E5B94F] hover:bg-[#f0ca6b]',
    buttonText: 'text-[#0B1220]',
  },
} as const;
