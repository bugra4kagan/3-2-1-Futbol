export const THEME_COLORS = {
  bgPrimary: '#0D3822',
  bgSecondary: '#134A2D',
  bgElevated: '#185A36',
  bgNavyContrast: '#0F273E',
  footballGreen: '#168A52',
  darkGreen: '#0E3120',
  orange: '#F97316',
  gold: '#E5B94F',
  cream: '#F5F3EB',
  white: '#FFFFFF',
  textSecondary: '#C4D6CA',
  infoBlue: '#3B82F6',
  dangerRed: '#C93B32',
  correctGreen: '#22C55E',
} as const;

export const MODAL_SEMANTIC_TONES = {
  success: {
    badgeBg: 'bg-[#134A2D]',
    badgeBorder: 'border-[#22C55E]/60',
    badgeText: 'text-[#4ADE80]',
    buttonBg: 'bg-[#168A52] hover:bg-[#1fa363]',
    buttonText: 'text-[#FFFFFF]',
  },
  error: {
    badgeBg: 'bg-[#C93B32]/18',
    badgeBorder: 'border-[#C93B32]/65',
    badgeText: 'text-[#F87171]',
    buttonBg: 'bg-[#C93B32] hover:bg-[#B22F27]',
    buttonText: 'text-[#FFFFFF]',
  },
  warning: {
    badgeBg: 'bg-[#F97316]/18',
    badgeBorder: 'border-[#F97316]/60',
    badgeText: 'text-[#FB923C]',
    buttonBg: 'bg-[#F97316] hover:bg-[#fb923c]',
    buttonText: 'text-[#0D3822]',
  },
  info: {
    badgeBg: 'bg-[#0F273E]',
    badgeBorder: 'border-[#3B82F6]/60',
    badgeText: 'text-[#60A5FA]',
    buttonBg: 'bg-[#3B82F6] hover:bg-[#60a5fa]',
    buttonText: 'text-[#FFFFFF]',
  },
  reward: {
    badgeBg: 'bg-[#E5B94F]/18',
    badgeBorder: 'border-[#E5B94F]/60',
    badgeText: 'text-[#E5B94F]',
    buttonBg: 'bg-[#E5B94F] hover:bg-[#f0ca6b]',
    buttonText: 'text-[#0D3822]',
  },
} as const;
