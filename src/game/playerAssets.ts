import rawPlayersData from '../data/players.json';
import { EXTRA_PLAYERS_50 } from './extraPlayers50';
import { EXTRA_PLAYERS_MORE_50 } from './extraPlayersMore50';
import { EXTRA_PLAYERS_THIRD_50 } from './extraPlayersThird50';
import { EXTRA_PLAYERS_FOURTH_100 } from './extraPlayersFourth100';
import { EXTRA_PLAYERS_FIFTH_150 } from './extraPlayersFifth150';
import { EXTRA_PLAYERS_SIXTH_100 } from './extraPlayersSixth100';
import { EXTRA_PLAYERS_SEVENTH_150 } from './extraPlayersSeventh150';
import { EXTRA_PLAYERS_EIGHTH_50 } from './extraPlayersEighth50';
import { EXTRA_PLAYERS_NINTH_50 } from './extraPlayersNinth50';
import { EXTRA_PLAYERS_TENTH_50 } from './extraPlayersTenth50';
import { EXTRA_PLAYERS_ELEVENTH_100 } from './extraPlayersEleventh100';
import { EXTRA_PLAYERS_TWELFTH_100 } from './extraPlayersTwelfth100';
import { EXTRA_PLAYERS_THIRTEENTH_100 } from './extraPlayersThirteenth100';
import { EXTRA_PLAYERS_FOURTEENTH_200 } from './extraPlayersFourteenth200';
import { EXTRA_PLAYERS_FIFTEENTH_150 } from './extraPlayersFifteenth150';
import { EXTRA_PLAYERS_SIXTEENTH_250 } from './extraPlayersSixteenth250';
import { EXTRA_PLAYERS_SEVENTEENTH_250 } from './extraPlayersSeventeenth250';
import { EXTRA_PLAYERS_EIGHTEENTH_250 } from './extraPlayersEighteenth250';
import { EXTRA_PLAYERS_NINETEENTH_250 } from './extraPlayersNineteenth250';
import { EXTRA_PLAYERS_TWENTIETH_BATCH } from './extraPlayersTwentieth';
import { Player } from './types';

export const DEFAULT_PLAYER_PHOTO = '/players/default.png';

export interface PlayerAssetMeta {
  photoUrl: string;
  age: number;
  shirtNumber: number;
  clubName: string;
  clubId?: string;
  league: string;
}

const playersList: Player[] = [
  ...(rawPlayersData as Player[]),
  ...EXTRA_PLAYERS_50,
  ...EXTRA_PLAYERS_MORE_50,
  ...EXTRA_PLAYERS_THIRD_50,
  ...EXTRA_PLAYERS_FOURTH_100,
  ...EXTRA_PLAYERS_FIFTH_150,
  ...EXTRA_PLAYERS_SIXTH_100,
  ...EXTRA_PLAYERS_SEVENTH_150,
  ...EXTRA_PLAYERS_EIGHTH_50,
  ...EXTRA_PLAYERS_NINTH_50,
  ...EXTRA_PLAYERS_TENTH_50,
  ...EXTRA_PLAYERS_ELEVENTH_100,
  ...EXTRA_PLAYERS_TWELFTH_100,
  ...EXTRA_PLAYERS_THIRTEENTH_100,
  ...EXTRA_PLAYERS_FOURTEENTH_200,
  ...EXTRA_PLAYERS_FIFTEENTH_150,
  ...EXTRA_PLAYERS_SIXTEENTH_250,
  ...EXTRA_PLAYERS_SEVENTEENTH_250,
  ...EXTRA_PLAYERS_EIGHTEENTH_250,
  ...EXTRA_PLAYERS_NINETEENTH_250,
  ...EXTRA_PLAYERS_TWENTIETH_BATCH,
];

export const PLAYER_ASSETS: Record<string, PlayerAssetMeta> = Object.fromEntries(
  playersList.map((player) => [
    player.id,
    {
      photoUrl: player.photoUrl || `/players/${player.id}.png`,
      age: player.age ?? 28,
      shirtNumber: player.shirtNumber ?? 10,
      clubName: player.clubName ?? 'Kulüp',
      ...(player.clubId ? { clubId: player.clubId } : {}),
      league: player.league ?? 'Uluslararası',
    },
  ])
);

export function getPlayerAsset(playerId: string): PlayerAssetMeta {
  return (
    PLAYER_ASSETS[playerId] || {
      photoUrl: DEFAULT_PLAYER_PHOTO,
      age: 28,
      shirtNumber: 10,
      clubName: 'Kulüp',
      league: 'Uluslararası',
    }
  );
}
