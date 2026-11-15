import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AppLanguage,
  TranslationKey,
  loadSavedLanguage,
  saveLanguage,
  t as translateKey,
} from './i18n';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'tr',
  setLanguage: () => {},
  t: (key) => translateKey('tr', key),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => loadSavedLanguage());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState(nextLang);
    saveLanguage(nextLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLang;
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translateKey(language, key),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
