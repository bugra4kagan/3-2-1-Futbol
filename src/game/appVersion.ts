import { ROSTER_DATA_VERSION } from './rosterVersion';

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '1.1.0';

export const BUILD_COMMIT: string =
  typeof __BUILD_COMMIT__ !== 'undefined' && __BUILD_COMMIT__ ? __BUILD_COMMIT__ : 'local';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__ ? __BUILD_TIME__ : '';

export interface AppVersionMetadata {
  appVersion: string;
  rosterVersion: string;
  buildCommit: string;
  buildTime: string;
}

export function getAppVersionMetadata(): AppVersionMetadata {
  return {
    appVersion: APP_VERSION,
    rosterVersion: ROSTER_DATA_VERSION,
    buildCommit: BUILD_COMMIT,
    buildTime: BUILD_TIME,
  };
}
