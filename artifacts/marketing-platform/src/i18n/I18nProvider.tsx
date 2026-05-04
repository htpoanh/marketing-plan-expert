/**
 * Minimal i18n provider.
 *
 * Why a custom provider instead of react-i18next / lingui / next-intl:
 *   - we need ~50 strings, not thousands → no need for plural rules,
 *     ICU MessageFormat, or backend negotiation
 *   - single-bundle (no async loading) keeps dev fast
 *   - zero runtime deps
 *
 * Usage:
 *   const { t, lang, setLang } = useTranslation();
 *   <Button>{t("ads.audience.generate")}</Button>
 *
 * Strings are dot-keyed and live in src/messages/{vi,de,en}.ts. Missing
 * keys fall back to the key string itself (visible in dev — flag for
 * translator).
 *
 * Phase 4 scope: applied to /strategy/ads/* only. Other pages stay
 * Vietnamese for now; widening the coverage is a separate task.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import vi from "../messages/vi";
import de from "../messages/de";
import en from "../messages/en";

export type Locale = "vi" | "de" | "en";

const DICTIONARIES: Record<Locale, Record<string, string>> = { vi, de, en };

const STORAGE_KEY = "ai-marketer.locale";

type I18nContextValue = {
  lang: Locale;
  setLang: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "vi";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "vi" || stored === "de" || stored === "en") return stored;
  return "vi"; // default — matches the pre-Phase-4 hardcoded language
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
      window.document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: Locale) => setLangState(l), []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[lang] ?? DICTIONARIES.vi;
      let value = dict[key];
      if (value == null) {
        // Last resort: try Vietnamese dictionary; if still missing, return key
        value = DICTIONARIES.vi[key] ?? key;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <I18nProvider>");
  }
  return ctx;
}
