export type ProfileIconId =
  | 'ball'
  | 'trophy'
  | 'crown'
  | 'medal'
  | 'boot'
  | 'glove'
  | 'target'
  | 'lightning'
  | 'shield'
  | 'star';

export interface ProfileIconDefinition {
  id: ProfileIconId;
  label: string;
  shortLabel: string;
}

export const PROFILE_ICONS: readonly ProfileIconDefinition[] = [
  { id: 'ball', label: 'Futbol Topu', shortLabel: 'Top' },
  { id: 'trophy', label: 'Kupa', shortLabel: 'Kupa' },
  { id: 'crown', label: 'Taç', shortLabel: 'Taç' },
  { id: 'medal', label: 'Madalya', shortLabel: 'Madalya' },
  { id: 'boot', label: 'Krampon', shortLabel: 'Krampon' },
  { id: 'glove', label: 'Kaleci Eldiveni', shortLabel: 'Eldiven' },
  { id: 'target', label: 'Hedef', shortLabel: 'Hedef' },
  { id: 'lightning', label: 'Şimşek', shortLabel: 'Şimşek' },
  { id: 'shield', label: 'Kalkan', shortLabel: 'Kalkan' },
  { id: 'star', label: 'Yıldız', shortLabel: 'Yıldız' },
] as const;

export const DEFAULT_PROFILE_ICON_ID: ProfileIconId = 'ball';

export const ALLOWED_PROFILE_ICON_IDS: ReadonlySet<string> = new Set(
  PROFILE_ICONS.map((icon) => icon.id)
);

export function isValidProfileIconId(value?: string | null): value is ProfileIconId {
  return typeof value === 'string' && ALLOWED_PROFILE_ICON_IDS.has(value);
}

/**
 * Only the 10 curated football icon IDs are accepted for user accounts.
 * Any legacy emoji, pp:<playerId>, anime:<...>, or invalid value falls back to 'ball'.
 */
export function normalizeProfileIconId(value?: string | null): ProfileIconId {
  if (isValidProfileIconId(value)) {
    return value;
  }
  return DEFAULT_PROFILE_ICON_ID;
}

export function getProfileIconLabel(value?: string | null): string {
  const normalized = normalizeProfileIconId(value);
  return PROFILE_ICONS.find((icon) => icon.id === normalized)?.label || 'Futbol Topu';
}
