import React, { useMemo, useState } from 'react';
import { Check, Dices, Lock, Sparkles } from 'lucide-react';
import {
  ANIME_ARMBANDS,
  ANIME_AURAS,
  ANIME_EYEWEAR,
  ANIME_EYE_COLORS,
  ANIME_EYE_STYLES,
  ANIME_EXPRESSIONS,
  ANIME_HAIR_COLORS,
  ANIME_HAIR_STYLES,
  ANIME_HEADWEAR,
  ANIME_JERSEYS,
  ANIME_SKIN_TONES,
  AnimeAvatarConfig,
  AnimeOptionDef,
  loadSavedAnimeAvatarConfig,
  saveAnimeAvatarConfigDraft,
  serializeAnimeAvatar,
} from '../game/animeAvatarCatalog';
import { formatPoints } from '../game/retentionEngine';
import { useLanguage } from '../game/LanguageContext';
import { sounds } from '../utils/audio';
import { AnimeFootballerSvg } from './AnimeFootballerSvg';
import { CoinIcon } from './CoinIcon';

interface AnimeAvatarBuilderProps {
  currentAvatar: string;
  userCoins: number;
  unlockedGiftIds: string[];
  onEquipAvatar: (avatarValue: string) => void;
  onPurchaseGear: (giftId: string) => { ok: boolean; reason?: string };
}

type BuilderSection = 'base' | 'gear';

export const AnimeAvatarBuilder: React.FC<AnimeAvatarBuilderProps> = ({
  currentAvatar,
  userCoins,
  unlockedGiftIds,
  onEquipAvatar,
  onPurchaseGear,
}) => {
  const { t } = useLanguage();
  const [config, setConfig] = useState<AnimeAvatarConfig>(() =>
    loadSavedAnimeAvatarConfig(currentAvatar)
  );
  const [section, setSection] = useState<BuilderSection>('base');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const unlockedSet = useMemo(() => new Set(unlockedGiftIds), [unlockedGiftIds]);
  const serializedCurrent = serializeAnimeAvatar(config);
  const isCurrentlyEquipped = currentAvatar === serializedCurrent;

  const isOptionUnlocked = (opt: AnimeOptionDef): boolean =>
    opt.costCoins <= 0 || !opt.giftId || unlockedSet.has(opt.giftId);

  const applyUpdate = (patch: Partial<AnimeAvatarConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAnimeAvatarConfigDraft(next);
  };

  const handleEquipNow = () => {
    sounds.playCorrect();
    saveAnimeAvatarConfigDraft(config);
    onEquipAvatar(serializedCurrent);
    setFeedback({ type: 'ok', text: t('animeEquippedBadge') });
    setTimeout(() => setFeedback(null), 2200);
  };

  const handleRandomize = () => {
    const pick = <T extends AnimeOptionDef>(list: T[]): T => {
      const available = list.filter(isOptionUnlocked);
      return available[Math.floor(Math.random() * available.length)] || list[0];
    };
    const next: AnimeAvatarConfig = {
      skinToneId: pick(ANIME_SKIN_TONES).id,
      hairStyleId: pick(ANIME_HAIR_STYLES).id,
      hairColorId: pick(ANIME_HAIR_COLORS).id,
      eyeStyleId: pick(ANIME_EYE_STYLES).id,
      eyeColorId: pick(ANIME_EYE_COLORS).id,
      expressionId: pick(ANIME_EXPRESSIONS).id,
      jerseyId: pick(ANIME_JERSEYS).id,
      eyewearId: pick(ANIME_EYEWEAR).id,
      headwearId: pick(ANIME_HEADWEAR).id,
      armbandId: pick(ANIME_ARMBANDS).id,
      auraId: pick(ANIME_AURAS).id,
    };
    sounds.playCorrect();
    setConfig(next);
    saveAnimeAvatarConfigDraft(next);
  };

  const handleSelectOrBuyGear = (
    key: keyof Pick<
      AnimeAvatarConfig,
      'jerseyId' | 'eyewearId' | 'headwearId' | 'armbandId' | 'auraId'
    >,
    opt: AnimeOptionDef
  ) => {
    if (isOptionUnlocked(opt)) {
      sounds.playCorrect();
      const next = { ...config, [key]: opt.id };
      setConfig(next);
      saveAnimeAvatarConfigDraft(next);
      onEquipAvatar(serializeAnimeAvatar(next));
      return;
    }

    if (!opt.giftId) return;
    if (userCoins < opt.costCoins) {
      sounds.playWrong();
      setFeedback({
        type: 'err',
        text: `Yetersiz Coin! ${formatPoints(opt.costCoins - userCoins)} Coin daha gerekli.`,
      });
      setTimeout(() => setFeedback(null), 2600);
      return;
    }

    const res = onPurchaseGear(opt.giftId);
    if (res.ok) {
      sounds.playVictory();
      const next = { ...config, [key]: opt.id };
      setConfig(next);
      saveAnimeAvatarConfigDraft(next);
      onEquipAvatar(serializeAnimeAvatar(next));
      setFeedback({ type: 'ok', text: `${opt.label} açıldı ve kuşandı!` });
      setTimeout(() => setFeedback(null), 2400);
    } else if (res.reason) {
      sounds.playWrong();
      setFeedback({ type: 'err', text: res.reason });
      setTimeout(() => setFeedback(null), 2600);
    }
  };

  const renderGearGrid = (
    title: string,
    key: keyof Pick<
      AnimeAvatarConfig,
      'jerseyId' | 'eyewearId' | 'headwearId' | 'armbandId' | 'auraId'
    >,
    options: AnimeOptionDef[]
  ) => (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {title}
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {options.map((opt) => {
          const unlocked = isOptionUnlocked(opt);
          const selected = config[key] === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`anime-gear-${opt.id}`}
              onClick={() => handleSelectOrBuyGear(key, opt)}
              className={`p-2 rounded-xl border text-left flex flex-col justify-between gap-1 transition cursor-pointer ${
                selected
                  ? 'bg-emerald-500/20 border-emerald-400 text-white'
                  : unlocked
                  ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                  : 'bg-slate-950 border-amber-500/40 text-slate-200 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                {opt.swatch ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                    style={{ backgroundColor: opt.swatch }}
                  />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-600 bg-slate-800 shrink-0" />
                )}
                {!unlocked ? (
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                ) : selected ? (
                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : null}
              </div>
              <span className="text-[11px] font-bold leading-tight line-clamp-2">
                {opt.label}
              </span>
              {opt.costCoins > 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black font-mono ${
                    unlocked ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {unlocked ? (
                    'Açık ✓'
                  ) : (
                    <>
                      <CoinIcon size="xs" />
                      <span>{formatPoints(opt.costCoins)}</span>
                    </>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div data-testid="anime-avatar-builder" className="space-y-3">
      {/* Live Preview + Equip Header */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-lg shrink-0 bg-slate-900">
          <AnimeFootballerSvg config={config} className="w-full h-full block" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="anime-equip-btn"
              onClick={handleEquipNow}
              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${
                isCurrentlyEquipped
                  ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950'
              }`}
            >
              {isCurrentlyEquipped ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isCurrentlyEquipped ? t('animeEquippedBadge') : t('animeEquipBtn')}</span>
            </button>

            <button
              type="button"
              data-testid="anime-randomize-btn"
              onClick={handleRandomize}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Rastgele Anime Futbolcu"
            >
              <Dices className="w-3.5 h-3.5 text-cyan-300" />
              <span>Rastgele</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
            <CoinIcon size="xs" />
            <span>Bakiye: {formatPoints(userCoins)} Coin</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          data-testid="anime-builder-feedback"
          className={`px-3 py-2 rounded-xl border text-xs font-bold ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Sub-tabs: Base Appearance (Free) vs Coin Gear & Auras */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
        <button
          type="button"
          data-testid="anime-subtab-base"
          onClick={() => setSection('base')}
          className={`py-2 rounded-lg text-xs font-black transition cursor-pointer ${
            section === 'base'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Yüz &amp; Saç (Ücretsiz)
        </button>
        <button
          type="button"
          data-testid="anime-subtab-gear"
          onClick={() => setSection('gear')}
          className={`py-2 rounded-lg text-xs font-black transition cursor-pointer ${
            section === 'gear'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Forma, Aksesuar &amp; Aura
        </button>
      </div>

      {section === 'base' ? (
        <div className="space-y-3 p-3 rounded-2xl bg-slate-950/75 border border-slate-800">
          {/* Skin Tone Swatches */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Ten Rengi
            </span>
            <div className="flex flex-wrap gap-2">
              {ANIME_SKIN_TONES.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  title={sk.label}
                  onClick={() => applyUpdate({ skinToneId: sk.id })}
                  className={`w-8 h-8 rounded-full border-2 transition cursor-pointer ${
                    config.skinToneId === sk.id
                      ? 'border-emerald-400 scale-110 ring-2 ring-emerald-400/40'
                      : 'border-slate-700 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: sk.swatch }}
                />
              ))}
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Anime Saç Stili
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ANIME_HAIR_STYLES.map((hs) => (
                <button
                  key={hs.id}
                  type="button"
                  onClick={() => applyUpdate({ hairStyleId: hs.id })}
                  className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer truncate ${
                    config.hairStyleId === hs.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {hs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hair Color */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Saç Rengi
            </span>
            <div className="flex flex-wrap gap-2">
              {ANIME_HAIR_COLORS.map((hc) => (
                <button
                  key={hc.id}
                  type="button"
                  title={hc.label}
                  onClick={() => applyUpdate({ hairColorId: hc.id })}
                  className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                    config.hairColorId === hc.id
                      ? 'border-amber-400 scale-110 ring-2 ring-amber-400/40'
                      : 'border-slate-700 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: hc.swatch }}
                />
              ))}
            </div>
          </div>

          {/* Eye Style & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Göz Stili
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {ANIME_EYE_STYLES.map((es) => (
                  <button
                    key={es.id}
                    type="button"
                    onClick={() => applyUpdate({ eyeStyleId: es.id })}
                    className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer truncate ${
                      config.eyeStyleId === es.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {es.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Göz Rengi
              </span>
              <div className="flex flex-wrap gap-2">
                {ANIME_EYE_COLORS.map((ec) => (
                  <button
                    key={ec.id}
                    type="button"
                    title={ec.label}
                    onClick={() => applyUpdate({ eyeColorId: ec.id })}
                    className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                      config.eyeColorId === ec.id
                        ? 'border-cyan-400 scale-110 ring-2 ring-cyan-400/40'
                        : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: ec.swatch }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Facial Expression */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Yüz İfadesi
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ANIME_EXPRESSIONS.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => applyUpdate({ expressionId: ex.id })}
                  className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer truncate ${
                    config.expressionId === ex.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3 rounded-2xl bg-slate-950/75 border border-slate-800 max-h-[340px] overflow-y-auto">
          {renderGearGrid('Anime Formalar', 'jerseyId', ANIME_JERSEYS)}
          {renderGearGrid('Spor Vizör & Gözlük', 'eyewearId', ANIME_EYEWEAR)}
          {renderGearGrid('Saç Bandı & Şapka', 'headwearId', ANIME_HEADWEAR)}
          {renderGearGrid('Kaptanlık Pazubandı', 'armbandId', ANIME_ARMBANDS)}
          {renderGearGrid('Anime Aura & Stadyum', 'auraId', ANIME_AURAS)}
        </div>
      )}
    </div>
  );
};
