import { CLUBS } from './database';
import { Club } from './types';

export type BadgeShape = 'shield' | 'oval' | 'circle' | 'hex' | 'diamond' | 'banner';
export type BadgePattern =
  | 'vertical-stripes'
  | 'halves'
  | 'hoops'
  | 'sash'
  | 'center-pillar'
  | 'checkered'
  | 'cross'
  | 'radial';
export type BadgeEmblem = 'none' | 'crown' | 'stars' | 'laurel';

export interface ClubBadgeMeta {
  monogram: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  name: string;
  country?: string;
  shape: BadgeShape;
  pattern: BadgePattern;
  emblem: BadgeEmblem;
}

const CLUB_ID_MONOGRAM_OVERRIDES: Record<string, string> = {
  real_madrid: 'RM',
  barcelona: 'FCB',
  galatasaray: 'GS',
  fenerbahce: 'FB',
  besiktas: 'BJK',
  trabzonspor: 'TS',
  basaksehir: 'BFK',
  manchester_city: 'MCI',
  manchester_united: 'MUN',
  liverpool: 'LIV',
  arsenal: 'ARS',
  chelsea: 'CHE',
  tottenham: 'TOT',
  aston_villa: 'AVL',
  newcastle: 'NEW',
  everton: 'EVE',
  atletico_madrid: 'ATM',
  sevilla: 'SEV',
  valencia: 'VAL',
  villarreal: 'VIL',
  inter_milan: 'INT',
  ac_milan: 'MIL',
  juventus: 'JUV',
  as_roma: 'ROM',
  napoli: 'NAP',
  lazio: 'LAZ',
  fiorentina: 'FIO',
  bayern_munich: 'BAY',
  borussia_dortmund: 'BVB',
  bayer_leverkusen: 'B04',
  rb_leipzig: 'RBL',
  psg: 'PSG',
  marseille: 'OM',
  lyon: 'OL',
  monaco: 'ASM',
  lille: 'LIL',
  ajax: 'AJX',
  psv: 'PSV',
  feyenoord: 'FEY',
  benfica: 'SLB',
  porto: 'FCP',
  sporting_cp: 'SCP',
  celtic: 'CEL',
  rangers: 'RAN',
  al_nassr: 'NSR',
  al_hilal: 'HIL',
  al_ittihad: 'ITT',
  inter_miami: 'MIA',
  flamengo: 'FLA',
  santos: 'SAN',
  boca_juniors: 'BOC',
  river_plate: 'RIV',
  goztepe: 'GÖZ',
  samsunspor: 'SAM',
  caykur_rizespor: 'RİZ',
  alanyaspor: 'ALN',
  amed_sk: 'AMD',
  gaziantep_fk: 'GFK',
  genclerbirligi: 'GB',
  kocaelispor: 'KOC',
  erzurumspor: 'ERZ',
  eyupspor: 'EYP',
  corum_fk: 'ÇOR',
  strasbourg: 'RCS',
  rennes: 'REN',
  lens: 'RCL',
  paris_fc: 'PFC',
  nice: 'OGC',
  toulouse: 'TFC',
  lorient: 'FCL',
  auxerre: 'AJA',
  brest: 'SB29',
  angers: 'SCO',
  le_havre: 'HAC',
  troyes: 'EST',
  le_mans: 'LM',
  stuttgart: 'VFB',
  eintracht_frankfurt: 'SGE',
  hoffenheim: 'TSG',
  freiburg: 'SCF',
  augsburg: 'FCA',
  mainz_05: 'M05',
  koln: 'KOE',
  hamburger_sv: 'HSV',
  borussia_monchengladbach: 'BMG',
  werder_bremen: 'SVW',
  union_berlin: 'FCU',
  schalke_04: 'S04',
  elversberg: 'SVE',
  paderborn: 'SCP',
  como_1907: 'COM',
  atalanta: 'ATA',
  bologna: 'BOL',
  sassuolo: 'SAS',
  torino: 'TOR',
  genoa: 'GEN',
  udinese: 'UDI',
  parma: 'PAR',
  cagliari: 'CAG',
  venezia: 'VEN',
  frosinone: 'FRO',
  monza: 'MON',
  lecce: 'LEC',
  brighton: 'BHA',
  brentford: 'BRE',
  bournemouth: 'BOU',
  crystal_palace: 'CRY',
  nottingham_forest: 'NFO',
  sunderland: 'SUN',
  leeds_united: 'LEE',
  fulham: 'FUL',
  ipswich_town: 'IPS',
  coventry_city: 'COV',
  hull_city: 'HUL',
  real_sociedad: 'RSO',
  real_betis: 'BET',
  athletic_bilbao: 'ATH',
  celta_vigo: 'CEL',
  espanyol: 'ESP',
  deportivo_la_coruna: 'DEP',
  racing_santander: 'RAC',
  rayo_vallecano: 'RAY',
  getafe: 'GET',
  levante: 'LEV',
  osasuna: 'OSA',
  elche: 'ELC',
  alaves: 'ALA',
  malaga: 'MAL',
  nec_nijmegen: 'NEC',
  botafogo_fr: 'BOT',
  al_ahli_saudi: 'AHL',
  al_qadsiah: 'QAD',
  bodrum_fk: 'BOD',
  boluspor: 'BOL',
  krc_genk: 'GNK',
  az_alkmaar: 'AZ',
  hnk_hajduk_split: 'HAJ',
  gnk_dinamo_zagreb: 'DZG',
  cr_vasco_da_gama: 'VAS',
  los_angeles_fc: 'LAF',
};

const CLUB_STYLE_OVERRIDES: Record<
  string,
  { shape: BadgeShape; pattern: BadgePattern; emblem: BadgeEmblem }
> = {
  galatasaray: { shape: 'oval', pattern: 'halves', emblem: 'stars' },
  fenerbahce: { shape: 'shield', pattern: 'vertical-stripes', emblem: 'laurel' },
  besiktas: { shape: 'banner', pattern: 'vertical-stripes', emblem: 'stars' },
  trabzonspor: { shape: 'hex', pattern: 'halves', emblem: 'none' },
  basaksehir: { shape: 'hex', pattern: 'sash', emblem: 'none' },
  goztepe: { shape: 'oval', pattern: 'vertical-stripes', emblem: 'stars' },
  samsunspor: { shape: 'shield', pattern: 'center-pillar', emblem: 'none' },

  real_madrid: { shape: 'circle', pattern: 'sash', emblem: 'crown' },
  barcelona: { shape: 'banner', pattern: 'vertical-stripes', emblem: 'none' },
  atletico_madrid: { shape: 'shield', pattern: 'vertical-stripes', emblem: 'stars' },
  sevilla: { shape: 'banner', pattern: 'center-pillar', emblem: 'crown' },
  valencia: { shape: 'shield', pattern: 'halves', emblem: 'crown' },
  villarreal: { shape: 'hex', pattern: 'radial', emblem: 'crown' },
  athletic_bilbao: { shape: 'banner', pattern: 'vertical-stripes', emblem: 'none' },
  real_betis: { shape: 'diamond', pattern: 'vertical-stripes', emblem: 'crown' },
  real_sociedad: { shape: 'circle', pattern: 'vertical-stripes', emblem: 'crown' },

  manchester_city: { shape: 'circle', pattern: 'sash', emblem: 'stars' },
  manchester_united: { shape: 'diamond', pattern: 'halves', emblem: 'crown' },
  liverpool: { shape: 'shield', pattern: 'center-pillar', emblem: 'laurel' },
  arsenal: { shape: 'shield', pattern: 'center-pillar', emblem: 'crown' },
  chelsea: { shape: 'circle', pattern: 'radial', emblem: 'laurel' },
  tottenham: { shape: 'oval', pattern: 'hoops', emblem: 'none' },
  newcastle: { shape: 'banner', pattern: 'vertical-stripes', emblem: 'crown' },
  aston_villa: { shape: 'shield', pattern: 'halves', emblem: 'stars' },
  everton: { shape: 'hex', pattern: 'center-pillar', emblem: 'laurel' },

  bayern_munich: { shape: 'circle', pattern: 'checkered', emblem: 'stars' },
  borussia_dortmund: { shape: 'circle', pattern: 'radial', emblem: 'stars' },
  bayer_leverkusen: { shape: 'oval', pattern: 'cross', emblem: 'laurel' },
  rb_leipzig: { shape: 'hex', pattern: 'hoops', emblem: 'none' },
  eintracht_frankfurt: { shape: 'circle', pattern: 'halves', emblem: 'none' },
  schalke_04: { shape: 'oval', pattern: 'radial', emblem: 'none' },

  inter_milan: { shape: 'circle', pattern: 'vertical-stripes', emblem: 'stars' },
  ac_milan: { shape: 'oval', pattern: 'cross', emblem: 'stars' },
  juventus: { shape: 'oval', pattern: 'vertical-stripes', emblem: 'stars' },
  as_roma: { shape: 'shield', pattern: 'hoops', emblem: 'crown' },
  napoli: { shape: 'circle', pattern: 'radial', emblem: 'none' },
  lazio: { shape: 'hex', pattern: 'hoops', emblem: 'none' },
  fiorentina: { shape: 'diamond', pattern: 'halves', emblem: 'none' },
  atalanta: { shape: 'oval', pattern: 'vertical-stripes', emblem: 'none' },

  psg: { shape: 'circle', pattern: 'center-pillar', emblem: 'none' },
  marseille: { shape: 'banner', pattern: 'sash', emblem: 'stars' },
  lyon: { shape: 'shield', pattern: 'center-pillar', emblem: 'crown' },
  monaco: { shape: 'oval', pattern: 'sash', emblem: 'crown' },
  lille: { shape: 'hex', pattern: 'sash', emblem: 'none' },

  ajax: { shape: 'circle', pattern: 'center-pillar', emblem: 'stars' },
  psv: { shape: 'oval', pattern: 'vertical-stripes', emblem: 'laurel' },
  feyenoord: { shape: 'circle', pattern: 'halves', emblem: 'none' },
  benfica: { shape: 'shield', pattern: 'sash', emblem: 'stars' },
  porto: { shape: 'oval', pattern: 'vertical-stripes', emblem: 'crown' },
  sporting_cp: { shape: 'banner', pattern: 'hoops', emblem: 'laurel' },
  celtic: { shape: 'circle', pattern: 'hoops', emblem: 'laurel' },
  rangers: { shape: 'circle', pattern: 'radial', emblem: 'stars' },
  boca_juniors: { shape: 'shield', pattern: 'hoops', emblem: 'stars' },
  river_plate: { shape: 'banner', pattern: 'sash', emblem: 'none' },
  flamengo: { shape: 'banner', pattern: 'hoops', emblem: 'stars' },
  santos: { shape: 'shield', pattern: 'sash', emblem: 'crown' },
  inter_miami: { shape: 'circle', pattern: 'center-pillar', emblem: 'none' },
  al_nassr: { shape: 'oval', pattern: 'halves', emblem: 'crown' },
  al_hilal: { shape: 'hex', pattern: 'center-pillar', emblem: 'none' },
  al_ittihad: { shape: 'banner', pattern: 'vertical-stripes', emblem: 'none' },
};

const ALL_SHAPES: BadgeShape[] = ['shield', 'oval', 'circle', 'hex', 'diamond', 'banner'];
const ALL_PATTERNS: BadgePattern[] = [
  'vertical-stripes',
  'halves',
  'hoops',
  'sash',
  'center-pillar',
  'checkered',
  'cross',
  'radial',
];
const ALL_EMBLEMS: BadgeEmblem[] = ['none', 'none', 'stars', 'laurel', 'crown'];

type ExtraClubInput = Omit<ClubBadgeMeta, 'shape' | 'pattern' | 'emblem'> & {
  shape?: BadgeShape;
  pattern?: BadgePattern;
  emblem?: BadgeEmblem;
};

export const EXTRA_CLUB_BADGE_MAP: Record<string, ExtraClubInput> = {
  'Sporting CP': { monogram: 'SCP', primaryColor: '#008057', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Sporting CP', shape: 'banner', pattern: 'hoops', emblem: 'laurel' },
  'Inter Miami': { monogram: 'MIA', primaryColor: '#F7B5CD', secondaryColor: '#231F20', accentColor: '#FFFFFF', textColor: '#231F20', name: 'Inter Miami', shape: 'circle', pattern: 'center-pillar', emblem: 'none' },
  'Ajax': { monogram: 'AJX', primaryColor: '#D2122E', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'AFC Ajax', shape: 'circle', pattern: 'center-pillar', emblem: 'stars' },
  'Sampdoria': { monogram: 'SAM', primaryColor: '#005AA7', secondaryColor: '#FFFFFF', accentColor: '#D50000', textColor: '#FFFFFF', name: 'UC Sampdoria', shape: 'shield', pattern: 'hoops', emblem: 'none' },
  'VfL Wolfsburg': { monogram: 'WOB', primaryColor: '#65B32E', secondaryColor: '#FFFFFF', accentColor: '#0F172A', textColor: '#FFFFFF', name: 'VfL Wolfsburg', shape: 'circle', pattern: 'radial', emblem: 'none' },
  'Molde FK': { monogram: 'MOL', primaryColor: '#004E98', secondaryColor: '#FFFFFF', accentColor: '#60A5FA', textColor: '#FFFFFF', name: 'Molde FK' },
  'RB Salzburg': { monogram: 'RBS', primaryColor: '#DD0741', secondaryColor: '#FFFFFF', accentColor: '#0C2340', textColor: '#FFFFFF', name: 'RB Salzburg', shape: 'hex', pattern: 'hoops' },
  'Dinamo Zagreb': { monogram: 'GNK', primaryColor: '#004696', secondaryColor: '#FFFFFF', accentColor: '#E11D48', textColor: '#FFFFFF', name: 'Dinamo Zagreb', shape: 'shield', pattern: 'checkered' },
  'FC Basel': { monogram: 'FCB', primaryColor: '#D50032', secondaryColor: '#003882', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'FC Basel', shape: 'oval', pattern: 'halves' },
  'Lech Poznań': { monogram: 'LPO', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'Lech Poznań' },
  'LA Galaxy': { monogram: 'LAG', primaryColor: '#00245D', secondaryColor: '#FFD200', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'LA Galaxy', shape: 'hex', pattern: 'sash', emblem: 'stars' },
  'LAFC': { monogram: 'LAF', primaryColor: '#111111', secondaryColor: '#C39E6D', accentColor: '#FFFFFF', textColor: '#F6E0B5', name: 'LAFC', shape: 'banner', pattern: 'center-pillar' },
  'Los Angeles FC': { monogram: 'LAF', primaryColor: '#111111', secondaryColor: '#C39E6D', accentColor: '#FFFFFF', textColor: '#F6E0B5', name: 'Los Angeles FC', shape: 'banner', pattern: 'center-pillar' },
  'Schalke 04': { monogram: 'S04', primaryColor: '#004D9D', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'FC Schalke 04', shape: 'oval', pattern: 'radial' },
  'Werder Bremen': { monogram: 'SVW', primaryColor: '#187B3C', secondaryColor: '#FFFFFF', accentColor: '#F39200', textColor: '#FFFFFF', name: 'SV Werder Bremen', shape: 'diamond', pattern: 'radial' },
  'Al-Nassr': { monogram: 'NSR', primaryColor: '#FFCC00', secondaryColor: '#0033A0', accentColor: '#FFFFFF', textColor: '#002B7F', name: 'Al-Nassr', shape: 'oval', pattern: 'halves', emblem: 'crown' },
  'Al-Hilal': { monogram: 'HIL', primaryColor: '#003DA5', secondaryColor: '#FFFFFF', accentColor: '#00A3E0', textColor: '#FFFFFF', name: 'Al-Hilal', shape: 'hex', pattern: 'center-pillar' },
  'Al-Ittihad': { monogram: 'ITT', primaryColor: '#FFD100', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Al-Ittihad', shape: 'banner', pattern: 'vertical-stripes' },
  'Al-Ahli Saudi FC': { monogram: 'AHL', primaryColor: '#006C35', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Al-Ahli Saudi FC' },
  'Al-Qadsiah': { monogram: 'QAD', primaryColor: '#E11D48', secondaryColor: '#FACC15', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Al-Qadsiah' },
  'Al-Duhail': { monogram: 'DUH', primaryColor: '#B91C1C', secondaryColor: '#1E293B', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Al-Duhail' },
  'Al-Shamal': { monogram: 'SHM', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Al-Shamal' },
  'Al-Fayha': { monogram: 'FAY', primaryColor: '#EA580C', secondaryColor: '#1D4ED8', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Al-Fayha' },
  'Al-Gharafa': { monogram: 'GHA', primaryColor: '#FACC15', secondaryColor: '#1E3A8A', accentColor: '#FFFFFF', textColor: '#1E3A8A', name: 'Al-Gharafa' },
  'Al-Jazira': { monogram: 'JAZ', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#EF4444', textColor: '#FFFFFF', name: 'Al-Jazira' },
  'Abha Club': { monogram: 'ABH', primaryColor: '#0284C7', secondaryColor: '#DC2626', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Abha Club' },
  'Santos FC': { monogram: 'SAN', primaryColor: '#F8FAFC', secondaryColor: '#111827', accentColor: '#FFD700', textColor: '#0F172A', name: 'Santos FC', shape: 'shield', pattern: 'sash', emblem: 'crown' },
  'Botafogo': { monogram: 'BOT', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#CBD5E1', textColor: '#FFFFFF', name: 'Botafogo', shape: 'shield', pattern: 'vertical-stripes', emblem: 'stars' },
  'Botafogo-SP': { monogram: 'BSP', primaryColor: '#B91C1C', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Botafogo-SP' },
  'Fluminense': { monogram: 'FLU', primaryColor: '#881337', secondaryColor: '#047857', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Fluminense', shape: 'shield', pattern: 'hoops' },
  'Fortaleza': { monogram: 'FOR', primaryColor: '#1D4ED8', secondaryColor: '#DC2626', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Fortaleza' },
  'Benfica': { monogram: 'SLB', primaryColor: '#E30613', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'SL Benfica', shape: 'shield', pattern: 'sash', emblem: 'stars' },
  'SL Benfica': { monogram: 'SLB', primaryColor: '#E30613', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'SL Benfica', shape: 'shield', pattern: 'sash', emblem: 'stars' },
  'Chicago Fire': { monogram: 'CHI', primaryColor: '#B91C1C', secondaryColor: '#1E3A8A', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Chicago Fire', shape: 'hex', pattern: 'cross' },
  'CF Montréal': { monogram: 'MTL', primaryColor: '#1E3A8A', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'CF Montréal' },
  'Orlando City SC': { monogram: 'ORL', primaryColor: '#6D28D9', secondaryColor: '#FACC15', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Orlando City SC' },
  'Górnik Zabrze': { monogram: 'GÓR', primaryColor: '#FFFFFF', secondaryColor: '#1D4ED8', accentColor: '#DC2626', textColor: '#1E3A8A', name: 'Górnik Zabrze' },
  'Znicz Pruszków': { monogram: 'ZNI', primaryColor: '#CA8A04', secondaryColor: '#DC2626', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Znicz Pruszków' },
  'CSKA Moskova': { monogram: 'CSK', primaryColor: '#DC2626', secondaryColor: '#1D4ED8', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'CSKA Moskova', shape: 'oval', pattern: 'vertical-stripes', emblem: 'stars' },
  'Spartak Moskova': { monogram: 'SPA', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Spartak Moskova', shape: 'diamond', pattern: 'sash' },
  'Olympiakos': { monogram: 'OLY', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Olympiakos', shape: 'circle', pattern: 'vertical-stripes', emblem: 'laurel' },
  'Mallorca': { monogram: 'MLL', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'RCD Mallorca', shape: 'oval', pattern: 'halves', emblem: 'crown' },
  'Monterrey': { monogram: 'MTY', primaryColor: '#002D72', secondaryColor: '#FFFFFF', accentColor: '#00A3E0', textColor: '#FFFFFF', name: 'CF Monterrey', shape: 'shield', pattern: 'vertical-stripes' },
  'Club León': { monogram: 'LEO', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Club León' },
  'CD Leganés': { monogram: 'LEG', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#16A34A', textColor: '#FFFFFF', name: 'CD Leganés' },
  'OGC Nice': { monogram: 'OGC', primaryColor: '#D00C22', secondaryColor: '#111111', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'OGC Nice', shape: 'shield', pattern: 'vertical-stripes' },
  'Malmö FF': { monogram: 'MFF', primaryColor: '#5BAFE4', secondaryColor: '#FFFFFF', accentColor: '#003366', textColor: '#FFFFFF', name: 'Malmö FF', shape: 'shield', pattern: 'radial', emblem: 'stars' },
  'Charleroi': { monogram: 'CHA', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'Charleroi' },
  'Estudiantes LP': { monogram: 'EST', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Estudiantes LP', shape: 'banner', pattern: 'vertical-stripes' },
  'Rosario Central': { monogram: 'ROS', primaryColor: '#0038A8', secondaryColor: '#FFD100', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Rosario Central' },
  'NEC Nijmegen': { monogram: 'NEC', primaryColor: '#D50000', secondaryColor: '#047857', accentColor: '#111827', textColor: '#FFFFFF', name: 'NEC Nijmegen' },
  'El Mokawloon': { monogram: 'MOK', primaryColor: '#CA8A04', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'El Mokawloon' },
  'Deportivo La Coruña': { monogram: 'DEP', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'Deportivo La Coruña' },
  'FK Željezničar': { monogram: 'ŽEL', primaryColor: '#004E98', secondaryColor: '#FFFFFF', accentColor: '#60A5FA', textColor: '#FFFFFF', name: 'FK Željezničar' },
  'Fatih Karagümrük': { monogram: 'FKG', primaryColor: '#DC2626', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Fatih Karagümrük', shape: 'oval', pattern: 'vertical-stripes' },
  'KRC Genk': { monogram: 'GNK', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#60A5FA', textColor: '#FFFFFF', name: 'KRC Genk' },
  'Southampton': { monogram: 'SOU', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Southampton', shape: 'shield', pattern: 'vertical-stripes' },
  'New York City FC': { monogram: 'NYC', primaryColor: '#6CABDD', secondaryColor: '#041E42', accentColor: '#F97316', textColor: '#FFFFFF', name: 'New York City FC', shape: 'circle', pattern: 'radial' },
  'FC Nürnberg': { monogram: 'FCN', primaryColor: '#7B1B26', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'FC Nürnberg', shape: 'circle', pattern: 'radial' },
  '1. FC Nürnberg': { monogram: 'FCN', primaryColor: '#7B1B26', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: '1. FC Nürnberg', shape: 'circle', pattern: 'radial' },
  'Brescia': { monogram: 'BRE', primaryColor: '#004B9B', secondaryColor: '#FFFFFF', accentColor: '#60A5FA', textColor: '#FFFFFF', name: 'Brescia' },
  'Corinthians': { monogram: 'COR', primaryColor: '#F8FAFC', secondaryColor: '#111827', accentColor: '#DC2626', textColor: '#0F172A', name: 'Corinthians', shape: 'oval', pattern: 'cross' },
  'São Paulo': { monogram: 'SPF', primaryColor: '#DC2626', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'São Paulo', shape: 'shield', pattern: 'hoops', emblem: 'stars' },
  'Real Valladolid': { monogram: 'VLL', primaryColor: '#6D28D9', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Real Valladolid' },
  'Vissel Kobe': { monogram: 'VIS', primaryColor: '#991B1B', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Vissel Kobe' },
  'New York Red Bulls': { monogram: 'NYR', primaryColor: '#DD0741', secondaryColor: '#FFFFFF', accentColor: '#0C2340', textColor: '#FFFFFF', name: 'New York Red Bulls' },
  'Blackburn Rovers': { monogram: 'BLB', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#DC2626', textColor: '#FFFFFF', name: 'Blackburn Rovers', shape: 'circle', pattern: 'halves' },
  'West Ham United': { monogram: 'WHU', primaryColor: '#7A263A', secondaryColor: '#1BB1E7', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'West Ham United', shape: 'shield', pattern: 'cross' },
  'Bolton Wanderers': { monogram: 'BOL', primaryColor: '#F8FAFC', secondaryColor: '#1E3A8A', accentColor: '#DC2626', textColor: '#1E3A8A', name: 'Bolton Wanderers' },
  'Bordeaux': { monogram: 'FCG', primaryColor: '#00245D', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'Bordeaux' },
  'AS Cannes': { monogram: 'CAN', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'AS Cannes' },
  'Al-Sadd': { monogram: 'SAD', primaryColor: '#F8FAFC', secondaryColor: '#111827', accentColor: '#CBD5E1', textColor: '#0F172A', name: 'Al-Sadd' },
  'Middlesbrough': { monogram: 'MID', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#1E3A8A', textColor: '#FFFFFF', name: 'Middlesbrough' },
  'Stoke City': { monogram: 'STK', primaryColor: '#E03A3E', secondaryColor: '#FFFFFF', accentColor: '#1B449C', textColor: '#FFFFFF', name: 'Stoke City' },
  'Argentinos Juniors': { monogram: 'ARG', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#002D72', textColor: '#FFFFFF', name: 'Argentinos Juniors' },
  "Newell's Old Boys": { monogram: 'NOB', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: "Newell's Old Boys", shape: 'shield', pattern: 'halves' },
  'New York Cosmos': { monogram: 'NYC', primaryColor: '#047857', secondaryColor: '#FACC15', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'New York Cosmos' },
  'AZ Alkmaar': { monogram: 'AZ', primaryColor: '#DB0029', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'AZ Alkmaar' },
  'Panathinaikos': { monogram: 'PAO', primaryColor: '#007A3D', secondaryColor: '#FFFFFF', accentColor: '#044E27', textColor: '#FFFFFF', name: 'Panathinaikos', shape: 'circle', pattern: 'radial', emblem: 'laurel' },
  'CSKA Sofia': { monogram: 'CSK', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'CSKA Sofia' },
  'Vasco da Gama': { monogram: 'VAS', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#DC2626', textColor: '#FFFFFF', name: 'Vasco da Gama', shape: 'shield', pattern: 'sash' },
  'Kashima Antlers': { monogram: 'KAS', primaryColor: '#B91C1C', secondaryColor: '#1E293B', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Kashima Antlers' },
  'Banfield': { monogram: 'BAN', primaryColor: '#007A3D', secondaryColor: '#FFFFFF', accentColor: '#044E27', textColor: '#FFFFFF', name: 'Banfield' },
  'Brøndby IF': { monogram: 'BIF', primaryColor: '#FDE100', secondaryColor: '#003399', accentColor: '#FFFFFF', textColor: '#003399', name: 'Brøndby IF' },
  'FC Nantes': { monogram: 'FCN', primaryColor: '#FACC15', secondaryColor: '#047857', accentColor: '#FFFFFF', textColor: '#064E3B', name: 'FC Nantes' },
  'Racing Club': { monogram: 'RAC', primaryColor: '#6CABDD', secondaryColor: '#FFFFFF', accentColor: '#003399', textColor: '#FFFFFF', name: 'Racing Club', shape: 'shield', pattern: 'vertical-stripes' },
  'Real Zaragoza': { monogram: 'ZAR', primaryColor: '#FFFFFF', secondaryColor: '#0055A5', accentColor: '#FACC15', textColor: '#0055A5', name: 'Real Zaragoza' },
  'NAC Breda': { monogram: 'NAC', primaryColor: '#FACC15', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#111827', name: 'NAC Breda' },
  'Vitesse': { monogram: 'VIT', primaryColor: '#FACC15', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Vitesse' },
  'MKE Ankaragücü': { monogram: 'AG', primaryColor: '#002D72', secondaryColor: '#FFD100', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'MKE Ankaragücü', shape: 'circle', pattern: 'halves' },
  'Bursaspor': { monogram: 'BUR', primaryColor: '#007A3D', secondaryColor: '#FFFFFF', accentColor: '#044E27', textColor: '#FFFFFF', name: 'Bursaspor', shape: 'shield', pattern: 'vertical-stripes', emblem: 'stars' },
  'İstanbulspor': { monogram: 'İST', primaryColor: '#FFD100', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#111827', name: 'İstanbulspor' },
  'Palmeiras': { monogram: 'PAL', primaryColor: '#006437', secondaryColor: '#FFFFFF', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'Palmeiras', shape: 'circle', pattern: 'radial', emblem: 'stars' },
  'Girona': { monogram: 'GIR', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#1E3A8A', textColor: '#FFFFFF', name: 'Girona FC' },
  'Norwich City': { monogram: 'NOR', primaryColor: '#FFF200', secondaryColor: '#00A650', accentColor: '#FFFFFF', textColor: '#065F46', name: 'Norwich City' },
  'Leicester City': { monogram: 'LEI', primaryColor: '#003090', secondaryColor: '#FDBE11', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Leicester City', shape: 'circle', pattern: 'radial' },
  'Fortuna Düsseldorf': { monogram: 'F95', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Fortuna Düsseldorf', shape: 'circle', pattern: 'radial' },
  'Athletico Paranaense': { monogram: 'CAP', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Athletico Paranaense' },
  'Sheffield United': { monogram: 'SHU', primaryColor: '#EE2737', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Sheffield United' },
  'Peñarol': { monogram: 'PEÑ', primaryColor: '#FFD100', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Peñarol', shape: 'shield', pattern: 'vertical-stripes' },
  'UD Almería': { monogram: 'ALM', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#003399', textColor: '#FFFFFF', name: 'UD Almería' },
  'Vancouver Whitecaps': { monogram: 'VAN', primaryColor: '#00245E', secondaryColor: '#9DC2EA', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Vancouver Whitecaps' },
  'Jeonbuk Hyundai Motors': { monogram: 'JEO', primaryColor: '#006B3F', secondaryColor: '#111827', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Jeonbuk Hyundai Motors' },
  'Beijing Guoan': { monogram: 'BJG', primaryColor: '#047857', secondaryColor: '#FACC15', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Beijing Guoan' },
  'Hellas Verona': { monogram: 'VER', primaryColor: '#003399', secondaryColor: '#FFD100', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Hellas Verona' },
  'Rapid Wien': { monogram: 'SCR', primaryColor: '#008542', secondaryColor: '#FFFFFF', accentColor: '#1D4ED8', textColor: '#FFFFFF', name: 'Rapid Wien' },
  'FC Twente': { monogram: 'TWE', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'FC Twente' },
  'Atlético Mineiro': { monogram: 'CAM', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Atlético Mineiro', shape: 'shield', pattern: 'vertical-stripes' },
  'Burnley': { monogram: 'BUR', primaryColor: '#6C1D45', secondaryColor: '#99D6EA', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Burnley FC' },
  'Mantova': { monogram: 'MAN', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Mantova' },
  'Budapest Honvéd': { monogram: 'HON', primaryColor: '#B91C1C', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Budapest Honvéd' },
  'Dynamo Moscow': { monogram: 'DYN', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'Dynamo Moscow' },
  'FC Nordsjælland': { monogram: 'FCN', primaryColor: '#D50032', secondaryColor: '#FFD100', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'FC Nordsjælland' },
  'FC Kopenhag': { monogram: 'FCK', primaryColor: '#FFFFFF', secondaryColor: '#003882', accentColor: '#D50032', textColor: '#003882', name: 'FC Kopenhag', shape: 'circle', pattern: 'radial' },
  'Stade Rennais': { monogram: 'SRFC', primaryColor: '#D50032', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Stade Rennais' },
  'Dijon FCO': { monogram: 'DFCO', primaryColor: '#D50032', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Dijon FCO' },
  'EA Guingamp': { monogram: 'EAG', primaryColor: '#D50032', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'EA Guingamp' },
  'Amiens SC': { monogram: 'ASC', primaryColor: '#F8FAFC', secondaryColor: '#111827', accentColor: '#CBD5E1', textColor: '#111827', name: 'Amiens SC' },
  'FC Groningen': { monogram: 'FCG', primaryColor: '#007A3D', secondaryColor: '#FFFFFF', accentColor: '#044E27', textColor: '#FFFFFF', name: 'FC Groningen' },
  'Girona FC': { monogram: 'GIR', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#1E3A8A', textColor: '#FFFFFF', name: 'Girona FC' },
  'RCD Mallorca': { monogram: 'MLL', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFD700', textColor: '#FFFFFF', name: 'RCD Mallorca' },
  'MŠK Žilina': { monogram: 'ŽIL', primaryColor: '#FACC15', secondaryColor: '#047857', accentColor: '#FFFFFF', textColor: '#064E3B', name: 'MŠK Žilina' },
  'UC Sampdoria': { monogram: 'SAM', primaryColor: '#005AA7', secondaryColor: '#FFFFFF', accentColor: '#D50000', textColor: '#FFFFFF', name: 'UC Sampdoria', shape: 'shield', pattern: 'hoops' },
  'EC Vitória': { monogram: 'ECV', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'EC Vitória' },
  'Coton Sport FC': { monogram: 'COT', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Coton Sport FC' },
  'Valenciennes FC': { monogram: 'VAFC', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Valenciennes FC' },
  'Hatayspor': { monogram: 'HAT', primaryColor: '#7A1C24', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Hatayspor' },
  'Southampton FC': { monogram: 'SOU', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Southampton FC' },
  'Wolverhampton': { monogram: 'WOL', primaryColor: '#FDB913', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#111827', name: 'Wolverhampton', shape: 'hex', pattern: 'radial' },
  '1. FC Kaiserslautern': { monogram: 'FCK', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: '1. FC Kaiserslautern', shape: 'circle', pattern: 'radial' },
  'Lyngby BK': { monogram: 'LBK', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'Lyngby BK' },
  'Alemannia Aachen': { monogram: 'AAC', primaryColor: '#FACC15', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#111827', name: 'Alemannia Aachen' },
  'Notts County': { monogram: 'NCF', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#CBD5E1', textColor: '#FFFFFF', name: 'Notts County' },
  'Estrela Amadora': { monogram: 'EST', primaryColor: '#D50000', secondaryColor: '#047857', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Estrela Amadora' },
  'Rio Ave FC': { monogram: 'RIO', primaryColor: '#007A3D', secondaryColor: '#FFFFFF', accentColor: '#044E27', textColor: '#FFFFFF', name: 'Rio Ave FC' },
  'Queens Park Rangers': { monogram: 'QPR', primaryColor: '#005CAB', secondaryColor: '#FFFFFF', accentColor: '#D50000', textColor: '#FFFFFF', name: 'Queens Park Rangers', shape: 'circle', pattern: 'hoops' },
  'Atlético Junior': { monogram: 'JUN', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#003882', textColor: '#FFFFFF', name: 'Atlético Junior' },
  'Defensa y Justicia': { monogram: 'DYJ', primaryColor: '#FACC15', secondaryColor: '#047857', accentColor: '#FFFFFF', textColor: '#064E3B', name: 'Defensa y Justicia' },
  'Aberdeen FC': { monogram: 'ABE', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Aberdeen FC' },
  'Al-Shabab': { monogram: 'SHB', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#F97316', textColor: '#FFFFFF', name: 'Al-Shabab' },
  'Hajduk Split': { monogram: 'HJD', primaryColor: '#FFFFFF', secondaryColor: '#004E98', accentColor: '#D50000', textColor: '#004E98', name: 'Hajduk Split', shape: 'circle', pattern: 'checkered' },
  'Willem II': { monogram: 'WIL', primaryColor: '#D50000', secondaryColor: '#0055A5', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Willem II' },
  'Girondins Bordeaux': { monogram: 'FCGB', primaryColor: '#00245D', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'Girondins Bordeaux' },
  'Independiente': { monogram: 'CAI', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#00245D', textColor: '#FFFFFF', name: 'Independiente', shape: 'shield', pattern: 'sash' },
  'AC Perugia': { monogram: 'PER', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'AC Perugia' },
  'US Salernitana': { monogram: 'SAL', primaryColor: '#7A1C24', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'US Salernitana' },
  'FC Sion': { monogram: 'SIO', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'FC Sion' },
  'SD Eibar': { monogram: 'EIB', primaryColor: '#8B1538', secondaryColor: '#004D98', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'SD Eibar' },
  'RSC Anderlecht': { monogram: 'RSCA', primaryColor: '#5B21B6', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'RSC Anderlecht', shape: 'oval', pattern: 'center-pillar', emblem: 'crown' },
  'FC Midtjylland': { monogram: 'FCM', primaryColor: '#111827', secondaryColor: '#D50000', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'FC Midtjylland' },
  'Esbjerg fB': { monogram: 'EFB', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#002E6D', textColor: '#FFFFFF', name: 'Esbjerg fB' },
  'SC Bastia': { monogram: 'SCB', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'SC Bastia' },
  'PAOK': { monogram: 'PAOK', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#CBD5E1', textColor: '#FFFFFF', name: 'PAOK', shape: 'oval', pattern: 'vertical-stripes' },
  'Real Oviedo': { monogram: 'OVD', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Real Oviedo' },
  'Shanghai Shenhua': { monogram: 'SHS', primaryColor: '#004E98', secondaryColor: '#D50000', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Shanghai Shenhua' },
  'Union SG': { monogram: 'USG', primaryColor: '#FACC15', secondaryColor: '#003399', accentColor: '#FFFFFF', textColor: '#003399', name: 'Union SG', shape: 'oval', pattern: 'halves' },
  'Swansea City': { monogram: 'SWA', primaryColor: '#F8FAFC', secondaryColor: '#111827', accentColor: '#0284C7', textColor: '#111827', name: 'Swansea City', shape: 'circle', pattern: 'radial' },
  'Preston North End': { monogram: 'PNE', primaryColor: '#FFFFFF', secondaryColor: '#0F172A', accentColor: '#0284C7', textColor: '#0F172A', name: 'Preston North End' },
  'Saint-Étienne': { monogram: 'ASSE', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'AS Saint-Étienne', shape: 'hex', pattern: 'center-pillar', emblem: 'stars' },
  'Montpellier HSC': { monogram: 'MHSC', primaryColor: '#003399', secondaryColor: '#EA580C', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Montpellier HSC', shape: 'circle', pattern: 'halves' },
  'Stade de Reims': { monogram: 'SDR', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Stade de Reims', shape: 'oval', pattern: 'center-pillar', emblem: 'crown' },
  'Boluspor': { monogram: 'BOL', primaryColor: '#DC2626', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Boluspor', shape: 'shield', pattern: 'vertical-stripes' },
  'Sarıyer': { monogram: 'SAR', primaryColor: '#0284C7', secondaryColor: '#FFFFFF', accentColor: '#0F172A', textColor: '#FFFFFF', name: 'Sarıyer', shape: 'circle', pattern: 'halves' },
  'Wolverhampton Wanderers': { monogram: 'WOL', primaryColor: '#FDB913', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#111827', name: 'Wolverhampton Wanderers', shape: 'hex', pattern: 'radial' },
  'Watford FC': { monogram: 'WAT', primaryColor: '#FBEE23', secondaryColor: '#ED2127', accentColor: '#111827', textColor: '#111827', name: 'Watford FC', shape: 'shield', pattern: 'halves' },
  'Burnley FC': { monogram: 'BUR', primaryColor: '#6C1D45', secondaryColor: '#99D6EA', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Burnley FC', shape: 'shield', pattern: 'halves' },
  'West Bromwich Albion': { monogram: 'WBA', primaryColor: '#122F67', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'West Bromwich Albion', shape: 'shield', pattern: 'vertical-stripes' },
  'Kayserispor': { monogram: 'KAY', primaryColor: '#FFD100', secondaryColor: '#D50000', accentColor: '#111827', textColor: '#111827', name: 'Kayserispor', shape: 'shield', pattern: 'vertical-stripes' },
  'Gaziantepspor': { monogram: 'GAZ', primaryColor: '#D50000', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Gaziantepspor', shape: 'shield', pattern: 'vertical-stripes' },
  'Bodrum FK': { monogram: 'BFK', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#064E3B', textColor: '#FFFFFF', name: 'Bodrum FK', shape: 'shield', pattern: 'halves' },
  'Denizlispor': { monogram: 'DEN', primaryColor: '#047857', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Denizlispor', shape: 'shield', pattern: 'vertical-stripes' },
  'Club Brugge': { monogram: 'CLB', primaryColor: '#0055A5', secondaryColor: '#111827', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Club Brugge', shape: 'shield', pattern: 'vertical-stripes', emblem: 'crown' },
  'Standard Liège': { monogram: 'RSCL', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#111827', textColor: '#FFFFFF', name: 'Standard Liège', shape: 'shield', pattern: 'center-pillar' },
  'KAA Gent': { monogram: 'GNT', primaryColor: '#00529F', secondaryColor: '#FFFFFF', accentColor: '#38BDF8', textColor: '#FFFFFF', name: 'KAA Gent', shape: 'circle', pattern: 'radial' },
  'Royal Antwerp': { monogram: 'RAFC', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Royal Antwerp', shape: 'circle', pattern: 'radial' },
  'SC Heerenveen': { monogram: 'HEE', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#D50000', textColor: '#FFFFFF', name: 'SC Heerenveen', shape: 'shield', pattern: 'vertical-stripes' },
  'SC Braga': { monogram: 'SCB', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'SC Braga', shape: 'shield', pattern: 'center-pillar' },
  'Boavista FC': { monogram: 'BFC', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'Boavista FC', shape: 'shield', pattern: 'checkered' },
  'Vitória de Guimarães': { monogram: 'VSC', primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#CBD5E1', textColor: '#FFFFFF', name: 'Vitória de Guimarães', shape: 'shield', pattern: 'halves' },
  'Lokomotiv Moskova': { monogram: 'LOK', primaryColor: '#047857', secondaryColor: '#D50000', accentColor: '#FFFFFF', textColor: '#FFFFFF', name: 'Lokomotiv Moskova', shape: 'shield', pattern: 'halves' },
  'Dinamo Moskova': { monogram: 'DYN', primaryColor: '#0055A5', secondaryColor: '#FFFFFF', accentColor: '#38BDF8', textColor: '#FFFFFF', name: 'Dinamo Moskova', shape: 'circle', pattern: 'radial' },
  'Zenit Saint Petersburg': { monogram: 'ZEN', primaryColor: '#009EE0', secondaryColor: '#FFFFFF', accentColor: '#003399', textColor: '#FFFFFF', name: 'Zenit Saint Petersburg', shape: 'circle', pattern: 'radial' },
  'Al-Ahli': { monogram: 'AHL', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'Al-Ahli', shape: 'shield', pattern: 'center-pillar' },
  'SC Internacional': { monogram: 'INT', primaryColor: '#D50000', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'SC Internacional', shape: 'circle', pattern: 'radial' },
  'Cruzeiro': { monogram: 'CRU', primaryColor: '#003399', secondaryColor: '#FFFFFF', accentColor: '#38BDF8', textColor: '#FFFFFF', name: 'Cruzeiro', shape: 'circle', pattern: 'radial', emblem: 'stars' },
  'Girondins de Bordeaux': { monogram: 'FCGB', primaryColor: '#00245D', secondaryColor: '#FFFFFF', accentColor: '#94A3B8', textColor: '#FFFFFF', name: 'Girondins de Bordeaux', shape: 'shield', pattern: 'sash' },
  'AS Saint-Étienne': { monogram: 'ASSE', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#FACC15', textColor: '#FFFFFF', name: 'AS Saint-Étienne', shape: 'hex', pattern: 'center-pillar', emblem: 'stars' },
  'Hibernian': { monogram: 'HIB', primaryColor: '#047857', secondaryColor: '#FFFFFF', accentColor: '#064E3B', textColor: '#FFFFFF', name: 'Hibernian', shape: 'shield', pattern: 'halves' },
  'Serbest': { monogram: 'FA', primaryColor: '#334155', secondaryColor: '#06B6D4', accentColor: '#EC4899', textColor: '#FFFFFF', name: 'Serbest Oyuncu', shape: 'hex', pattern: 'radial', emblem: 'none' },
};

export interface KnownWorldLeagueDef {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
}

/**
 * Kariyer geçmişlerinde geçebilecek 15 bilindik dünya ligi.
 * Kulüp-lig eşleşme güvencesi sağlar; hiçbir kariyer satırında tanımsız lig hatası oluşmaz.
 */
export const KNOWN_WORLD_LEAGUES: KnownWorldLeagueDef[] = [
  { id: 'super_lig', name: 'Süper Lig', country: 'Türkiye', countryFlag: '🇹🇷' },
  { id: 'premier_league', name: 'Premier League', country: 'İngiltere', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'la_liga', name: 'La Liga', country: 'İspanya', countryFlag: '🇪🇸' },
  { id: 'serie_a', name: 'Serie A', country: 'İtalya', countryFlag: '🇮🇹' },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Almanya', countryFlag: '🇩🇪' },
  { id: 'ligue_1', name: 'Ligue 1', country: 'Fransa', countryFlag: '🇫🇷' },
  { id: 'eredivisie', name: 'Eredivisie', country: 'Hollanda', countryFlag: '🇳🇱' },
  { id: 'liga_portugal', name: 'Liga Portugal', country: 'Portekiz', countryFlag: '🇵🇹' },
  { id: 'belgian_pro_league', name: 'Belçika Pro League', country: 'Belçika', countryFlag: '🇧🇪' },
  { id: 'scottish_premiership', name: 'İskoçya Premiership', country: 'İskoçya', countryFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: 'russian_premier_league', name: 'Rusya Premier Ligi', country: 'Rusya', countryFlag: '🇷🇺' },
  { id: 'saudi_pro_league', name: 'Suudi Pro Ligi', country: 'Suudi Arabistan', countryFlag: '🇸🇦' },
  { id: 'mls', name: 'MLS', country: 'ABD', countryFlag: '🇺🇸' },
  { id: 'brasileirao', name: 'Brezilya Serie A', country: 'Brezilya', countryFlag: '🇧🇷' },
  { id: 'argentina_primera', name: 'Arjantin Primera División', country: 'Arjantin', countryFlag: '🇦🇷' },
];

export function resolveWorldLeagueByFlag(countryFlag?: string): KnownWorldLeagueDef | null {
  if (!countryFlag) return null;
  return KNOWN_WORLD_LEAGUES.find((l) => l.countryFlag === countryFlag.trim()) ?? null;
}

const PALETTE_SWATCHES: [string, string, string][] = [
  ['#1E3A8A', '#38BDF8', '#FFFFFF'],
  ['#B91C1C', '#FFFFFF', '#FACC15'],
  ['#047857', '#FFFFFF', '#FDE047'],
  ['#6D28D9', '#EC4899', '#FFFFFF'],
  ['#0F172A', '#F59E0B', '#FFFFFF'],
  ['#991B1B', '#111827', '#FFFFFF'],
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function resolveStyle(key: string): {
  shape: BadgeShape;
  pattern: BadgePattern;
  emblem: BadgeEmblem;
} {
  if (CLUB_STYLE_OVERRIDES[key]) {
    return CLUB_STYLE_OVERRIDES[key];
  }
  const h = hashString(key || 'club');
  return {
    shape: ALL_SHAPES[h % ALL_SHAPES.length],
    pattern: ALL_PATTERNS[(h >> 3) % ALL_PATTERNS.length],
    emblem: ALL_EMBLEMS[(h >> 6) % ALL_EMBLEMS.length],
  };
}

function buildFallbackMonogram(rawName: string): string {
  const cleaned = rawName
    .replace(/\(.*?\)/g, '')
    .replace(/[^A-Za-z0-9ÇĞIİÖŞÜçğıöşü\s-]/g, ' ')
    .trim();
  const words = cleaned.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return 'FC';
  if (words.length === 1) {
    return words[0].slice(0, 3).toLocaleUpperCase('tr');
  }
  if (words.length === 2) {
    const [a, b] = words;
    if (a.length <= 2 && b.length >= 2) {
      return `${a.slice(0, 2)}${b.slice(0, 1)}`.toLocaleUpperCase('tr');
    }
    return `${a.slice(0, 2)}${b.slice(0, 1)}`.toLocaleUpperCase('tr');
  }
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase('tr');
}

export function resolveClubBadgeMeta(
  clubId?: string,
  clubName?: string,
  clubObj?: Club | null
): ClubBadgeMeta {
  const resolvedClub = clubObj || (clubId ? CLUBS[clubId] : undefined);
  if (resolvedClub) {
    const monogram =
      CLUB_ID_MONOGRAM_OVERRIDES[resolvedClub.id] ||
      resolvedClub.shortName ||
      buildFallbackMonogram(resolvedClub.name);
    const style = resolveStyle(resolvedClub.id);
    return {
      monogram,
      primaryColor: resolvedClub.colors.primary,
      secondaryColor: resolvedClub.colors.secondary,
      accentColor: resolvedClub.colors.accent,
      textColor: resolvedClub.colors.text || '#FFFFFF',
      name: resolvedClub.name,
      country: resolvedClub.country,
      ...style,
    };
  }

  const rawName = (clubName || 'Kulüp').trim();
  const strippedName = rawName.replace(/\s*\((Efsane|Emekli|Altyapı[^)]*)\)\s*$/i, '').trim();

  const extra = EXTRA_CLUB_BADGE_MAP[rawName] || EXTRA_CLUB_BADGE_MAP[strippedName];
  if (extra) {
    const fallbackStyle = resolveStyle(strippedName || rawName);
    return {
      ...extra,
      shape: extra.shape ?? fallbackStyle.shape,
      pattern: extra.pattern ?? fallbackStyle.pattern,
      emblem: extra.emblem ?? fallbackStyle.emblem,
    };
  }

  // Try matching by CLUBS name substring
  const clubMatch = Object.values(CLUBS).find(
    (c) =>
      c.name.toLocaleLowerCase('tr') === strippedName.toLocaleLowerCase('tr') ||
      c.shortName.toLocaleLowerCase('tr') === strippedName.toLocaleLowerCase('tr')
  );
  if (clubMatch) {
    return resolveClubBadgeMeta(clubMatch.id, clubMatch.name, clubMatch);
  }

  const key = strippedName || rawName;
  const swatch = PALETTE_SWATCHES[hashString(key) % PALETTE_SWATCHES.length];
  return {
    monogram: buildFallbackMonogram(key),
    primaryColor: swatch[0],
    secondaryColor: swatch[1],
    accentColor: swatch[2],
    textColor: '#FFFFFF',
    name: rawName,
    ...resolveStyle(key),
  };
}
