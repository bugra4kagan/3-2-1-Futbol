import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AppLanguage,
  TranslationKey,
  isRtlLanguage,
  loadSavedLanguage,
  saveLanguage,
  t as translateKey,
} from './i18n';

interface LanguageContextValue {
  language: AppLanguage;
  isRtl: boolean;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'tr',
  isRtl: false,
  setLanguage: () => {},
  t: (key) => translateKey('tr', key),
});

function applyDocumentDirection(lang: AppLanguage): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtlLanguage(lang) ? 'rtl' : 'ltr';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => loadSavedLanguage());

  useEffect(() => {
    applyDocumentDirection(language);
  }, [language]);

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState(nextLang);
    saveLanguage(nextLang);
    applyDocumentDirection(nextLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translateKey(language, key),
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{ language, isRtl: isRtlLanguage(language), setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
