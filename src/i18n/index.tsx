import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, type Messages } from "./en";
import { ja } from "./ja";
import { zhHans } from "./zh-Hans";
import { zhHant } from "./zh-Hant";

export const LOCALES = ["en", "zh-Hant", "zh-Hans", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_META: Record<Locale, { native: string; html: string; key: "en" | "zhHant" | "zhHans" | "ja" }> = {
  en: { native: "English", html: "en", key: "en" },
  "zh-Hant": { native: "繁體中文", html: "zh-Hant", key: "zhHant" },
  "zh-Hans": { native: "简体中文", html: "zh-Hans", key: "zhHans" },
  ja: { native: "日本語", html: "ja", key: "ja" },
};

const CATALOG: Record<Locale, Messages> = {
  en,
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
  ja,
};

const STORAGE_KEY = "tc-locale";

type Leaves<T, P extends string = ""> = T extends string
  ? P
  : {
      [K in keyof T & string]: Leaves<T[K], P extends "" ? K : `${P}.${K}`>;
    }[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = messages;
  for (const part of parts) {
    if (!node || typeof node !== "object" || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] === undefined || params[name] === null ? `{${name}}` : String(params[name]),
  );
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const raw = lookup(CATALOG[locale], key) ?? lookup(en, key) ?? key;
  return interpolate(raw, params);
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch {
    /* ignore */
  }
  const nav = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("zh")) {
    if (nav.includes("hans") || nav.includes("cn") || nav.includes("sg")) return "zh-Hans";
    return "zh-Hant";
  }
  return "en";
}

export function intlLocale(locale: Locale): string {
  if (locale === "zh-Hant") return "zh-HK";
  if (locale === "zh-Hans") return "zh-CN";
  if (locale === "ja") return "ja-JP";
  return "en-GB";
}

type I18nValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = LOCALE_META[locale].html;
    document.documentElement.dataset.locale = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      setLocale: () => undefined,
      t: (key, params) => translate("en", key, params),
    };
  }
  return ctx;
}
