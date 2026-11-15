import React, { useEffect, useState } from 'react';
import { isPhotoAvatar, resolveAvatarPhotoUrl } from '../game/avatarCatalog';
import { getFrameClasses } from '../game/storeCatalog';

interface PlayerAvatarProps {
  avatar?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'rounded' | 'circle';
  frame?: string;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatar = '⚽',
  name = 'Oyuncu',
  size = 'md',
  variant = 'rounded',
  frame,
  className = '',
}) => {
  const photoUrl = resolveAvatarPhotoUrl(avatar);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoUrl, avatar]);

  const boxSizeMap = {
    xs: 'w-6 h-6 text-sm',
    sm: 'w-8 h-8 text-base',
    md: 'w-10 h-10 text-lg',
    lg: 'w-12 h-12 sm:w-14 sm:h-14 text-2xl sm:text-3xl',
    xl: 'w-14 h-14 text-3xl',
  };

  const radiusClass =
    variant === 'circle'
      ? 'rounded-full'
      : size === 'xs'
      ? 'rounded-lg'
      : size === 'sm'
      ? 'rounded-xl'
      : 'rounded-2xl';

  const frameClasses = getFrameClasses(frame);

  if (isPhotoAvatar(avatar) && photoUrl && !imgError) {
    return (
      <div
        className={`overflow-hidden shrink-0 select-none bg-slate-800 border border-emerald-400/50 shadow-sm ${boxSizeMap[size]} ${radiusClass} ${className} ${frameClasses}`}
      >
        <img
          src={photoUrl}
          alt={`${name} profil fotoğrafı`}
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center shrink-0 select-none overflow-hidden ${boxSizeMap[size]} ${radiusClass} ${className} ${frameClasses}`}
    >
      <span className="leading-none">
        {isPhotoAvatar(avatar) ? '⭐' : avatar || '⚽'}
      </span>
    </div>
  );
};
