import React, { useEffect, useState } from 'react';

const COUNTRY_OR_FLAG_TO_ISO: Record<string, string> = {
  // Turkish country / nationality names
  'Türkiye': 'tr',
  'İngiltere': 'gb-eng',
  'Galler': 'gb-wls',
  'İskoçya': 'gb-sct',
  'İspanya': 'es',
  'İtalya': 'it',
  'Almanya': 'de',
  'Fransa': 'fr',
  'Portekiz': 'pt',
  'Brezilya': 'br',
  'Arjantin': 'ar',
  'Hollanda': 'nl',
  'Belçika': 'be',
  'Hırvatistan': 'hr',
  'İsveç': 'se',
  'Norveç': 'no',
  'Danimarka': 'dk',
  'Polonya': 'pl',
  'Uruguay': 'uy',
  'Kolombiya': 'co',
  'Şili': 'cl',
  'Senegal': 'sn',
  'Gabon': 'ga',
  'Fildişi Sahili': 'ci',
  'Kamerun': 'cm',
  'Mısır': 'eg',
  'Fas': 'ma',
  'Nijerya': 'ng',
  'Gana': 'gh',
  'Togo': 'tg',
  'Çekya': 'cz',
  'Bosna-Hersek': 'ba',
  'Romanya': 'ro',
  'Slovakya': 'sk',
  'Surinam': 'sr',
  'Kosova': 'xk',
  'Sırbistan': 'rs',
  'ABD': 'us',
  'Avusturya': 'at',
  'İsviçre': 'ch',
  'Suudi Arabistan': 'sa',
  'Katar': 'qa',
  'Rusya': 'ru',
  'Yunanistan': 'gr',
  'BAE': 'ae',
  'Meksika': 'mx',
  'Güney Kore': 'kr',
  'Gürcistan': 'ge',
  'Slovenya': 'si',
  'Macaristan': 'hu',
  'Ekvador': 'ec',
  'Gine': 'gn',
  'Kanada': 'ca',
  'Bulgaristan': 'bg',
  'Kuzey Makedonya': 'mk',
  'Makedonya': 'mk',
  'Ukrayna': 'ua',
  'Cezayir': 'dz',
  'Azerbaycan': 'az',
  'Endonezya': 'id',
  'Hindistan': 'in',
  'Avustralya': 'au',
  'Çin': 'cn',
  'Japonya': 'jp',
  'Kuzey İrlanda': 'gb-nir',
  'İrlanda': 'ie',
  'Mozambik': 'mz',
  'Venezuela': 've',
  'Liberya': 'lr',
  'Kongo DC': 'cd',

  // Emoji flags
  '🇹🇷': 'tr',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿': 'gb-eng',
  '🏴󠁧󠁢󠁷󠁬󠁳󠁿': 'gb-wls',
  '🏴󠁧󠁢󠁳󠁣󠁴󠁿': 'gb-sct',
  '🇪🇸': 'es',
  '🇮🇹': 'it',
  '🇩🇪': 'de',
  '🇫🇷': 'fr',
  '🇵🇹': 'pt',
  '🇧🇷': 'br',
  '🇦🇷': 'ar',
  '🇳🇱': 'nl',
  '🇧🇪': 'be',
  '🇭🇷': 'hr',
  '🇸🇪': 'se',
  '🇳🇴': 'no',
  '🇩🇰': 'dk',
  '🇵🇱': 'pl',
  '🇺🇾': 'uy',
  '🇨🇴': 'co',
  '🇨🇱': 'cl',
  '🇸🇳': 'sn',
  '🇬🇦': 'ga',
  '🇨🇮': 'ci',
  '🇨🇲': 'cm',
  '🇪🇬': 'eg',
  '🇲🇦': 'ma',
  '🇳🇬': 'ng',
  '🇬🇭': 'gh',
  '🇹🇬': 'tg',
  '🇨🇿': 'cz',
  '🇧🇦': 'ba',
  '🇷🇴': 'ro',
  '🇸🇰': 'sk',
  '🇸🇷': 'sr',
  '🇽🇰': 'xk',
  '🇷🇸': 'rs',
  '🇺🇸': 'us',
  '🇦🇹': 'at',
  '🇨🇭': 'ch',
  '🇸🇦': 'sa',
  '🇶🇦': 'qa',
  '🇷🇺': 'ru',
  '🇬🇷': 'gr',
  '🇦🇪': 'ae',
  '🇲🇽': 'mx',
  '🇰🇷': 'kr',
  '🇬🇪': 'ge',
  '🇸🇮': 'si',
  '🇭🇺': 'hu',
  '🇪🇨': 'ec',
  '🇬🇳': 'gn',
  '🇨🇦': 'ca',
  '🇧🇬': 'bg',
  '🇲🇰': 'mk',
  '🇺🇦': 'ua',
  '🇩🇿': 'dz',
  '🇦🇿': 'az',
  '🇮🇩': 'id',
  '🇮🇳': 'in',
  '🇦🇺': 'au',
  '🇨🇳': 'cn',
  '🇯🇵': 'jp',
  '🇮🇪': 'ie',
  '🇬🇧': 'gb',
  '🇲🇿': 'mz',
  '🇻🇪': 've',
  '🇱🇷': 'lr',
  '🇨🇩': 'cd',
  '🇨🇾': 'cy',
};

export function resolveCountryIsoCode(country?: string, flag?: string): string | null {
  if (country && COUNTRY_OR_FLAG_TO_ISO[country]) {
    return COUNTRY_OR_FLAG_TO_ISO[country];
  }
  if (flag && COUNTRY_OR_FLAG_TO_ISO[flag]) {
    return COUNTRY_OR_FLAG_TO_ISO[flag];
  }
  return null;
}

interface CountryFlagProps {
  country?: string;
  flag?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'rounded';
  className?: string;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  country,
  flag,
  size = 'sm',
  variant = 'rounded',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const iso = resolveCountryIsoCode(country, flag);

  useEffect(() => {
    setImgError(false);
  }, [iso, country, flag]);

  const sizeMap = {
    xs: variant === 'circle' ? 'w-4 h-4' : 'w-5 h-3.5',
    sm: variant === 'circle' ? 'w-6 h-6' : 'w-7 h-5',
    md: variant === 'circle' ? 'w-8 h-8' : 'w-9 h-6',
    lg: variant === 'circle' ? 'w-11 h-11' : 'w-12 h-8',
    xl: variant === 'circle' ? 'w-16 h-16' : 'w-20 h-14',
  };

  if (!iso || imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center font-black uppercase bg-slate-800 text-slate-200 border border-slate-700 shrink-0 ${
          variant === 'circle' ? 'rounded-full' : 'rounded'
        } ${sizeMap[size]} ${className}`}
        title={country || 'Ülke'}
      >
        <span className="text-[10px] leading-none">
          {iso ? iso.replace('gb-', '').toUpperCase() : flag || '🌍'}
        </span>
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      alt={country ? `${country} bayrağı` : 'Ülke bayrağı'}
      title={country || iso.toUpperCase()}
      loading="eager"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`object-cover shrink-0 shadow-sm border border-white/15 select-none ${
        variant === 'circle' ? 'rounded-full' : 'rounded-md'
      } ${sizeMap[size]} ${className}`}
    />
  );
};
