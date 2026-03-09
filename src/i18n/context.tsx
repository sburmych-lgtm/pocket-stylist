import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Language } from "./types";
import { flattenTranslations } from "./types";
import { uk } from "./uk";
import { en } from "./en";

const STORAGE_KEY = "pocket_stylist_lang";

const flatUk = flattenTranslations(uk);
const flatEn = flattenTranslations(en);
const dictionaries: Record<Language, Record<string, string>> = { uk: flatUk, en: flatEn };

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getSavedLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "uk" || saved === "en") return saved;
  } catch { /* noop */ }
  return "uk";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getSavedLang);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* noop */ }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = dictionaries[lang][key] ?? dictionaries.uk[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
