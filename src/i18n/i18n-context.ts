import { createContext, useContext } from "react";
import type { Language } from "./types";

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within LanguageProvider");
  return context;
}
