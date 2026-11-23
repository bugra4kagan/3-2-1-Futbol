import React from 'react';
import { Club } from '../game/types';
import { ClubBadge } from './ClubBadge';

interface ClubLogoProps {
  club: Club;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ClubLogo: React.FC<ClubLogoProps> = ({ club, size = 'md', className = '' }) => {
  return <ClubBadge club={club} size={size} className={className} />;
};
