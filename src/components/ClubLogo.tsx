import React, { useEffect, useState } from 'react';
import { Club } from '../game/types';
import { getClubCrestUrl } from '../game/clubLogos';
import { CountryFlag } from './CountryFlag';

interface ClubLogoProps {
  club: Club;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ClubLogo: React.FC<ClubLogoProps> = ({ club, size = 'md', className = '' }) => {
  const crestUrl = getClubCrestUrl(club.id, club.name);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [crestUrl, club.id]);

  const sizeContainerMap = {
    xs: 'w-5 h-5 rounded-md p-0.5',
    sm: 'w-11 h-11 rounded-2xl p-1.5 sm:p-2',
    md: 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1.5 sm:p-2',
    lg: 'w-20 h-20 sm:w-28 sm:h-28 rounded-2xl p-1.5 sm:p-2',
    xl: 'w-28 h-28 sm:w-36 sm:h-36 rounded-2xl p-1.5 sm:p-2',
  };

  const imgSizeMap = {
    xs: 'w-4 h-4 max-h-4 max-w-4',
    sm: 'w-8 h-8 max-h-8 max-w-8',
    md: 'w-12 h-12 sm:w-16 sm:h-16 max-h-16 max-w-16',
    lg: 'w-16 h-16 sm:w-24 sm:h-24 max-h-24 max-w-24',
    xl: 'w-22 h-22 sm:w-28 sm:h-28 max-h-28 max-w-28',
  };

  const isTiny = size === 'xs';

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center bg-slate-900/90 border border-slate-700/80 shadow-2xl transition-transform duration-300 ${
        isTiny ? '' : 'hover:scale-105'
      } select-none shrink-0 ${sizeContainerMap[size]} ${className}`}
      title={`${club.name} (${club.country})`}
    >
      {/* Background glow tinted with club's primary color */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none blur-md"
        style={{ backgroundColor: club.colors.primary || '#10b981' }}
      />

      {crestUrl && !imageError ? (
        <img
          src={crestUrl}
          alt={`${club.name} arması`}
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className={`relative z-10 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all ${imgSizeMap[size]}`}
        />
      ) : (
        <div
          className={`relative z-10 w-full h-full flex flex-col items-center justify-center text-center font-black shadow-inner border border-white/10 ${
            isTiny ? 'rounded-sm p-0' : 'rounded-xl p-1'
          }`}
          style={{
            backgroundColor: club.colors.primary,
            color: club.colors.text || '#FFFFFF',
          }}
        >
          <span
            className={`tracking-tighter font-black uppercase drop-shadow-md ${
              isTiny ? 'text-[7px] leading-none' : 'text-sm sm:text-base'
            }`}
          >
            {club.shortName}
          </span>
          {size !== 'sm' && size !== 'xs' && (
            <CountryFlag country={club.country} flag={club.countryFlag} size="xs" className="mt-0.5" />
          )}
        </div>
      )}

      {/* Subtle border highlight ring */}
      <div
        className={`absolute inset-0 border border-white/15 pointer-events-none ${
          isTiny ? 'rounded-md' : 'rounded-2xl'
        }`}
      />
    </div>
  );
};
