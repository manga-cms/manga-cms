import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type CmsLocale, type MessageKey } from "./messages";

type Params = Record<string, string | number | undefined>;

type I18nContextValue = {
    locale: CmsLocale;
    setLocale: (locale: CmsLocale) => void;
    t: (key: MessageKey, params?: Params) => string;
};

const STORAGE_KEY = "manga-cms:ui-locale";
const DEFAULT_LOCALE: CmsLocale = "ja";

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale(): CmsLocale {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "ja" ? saved : DEFAULT_LOCALE;
}

function formatMessage(message: string, params?: Params) {
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<CmsLocale>(readInitialLocale);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.lang = locale;
    }, [locale]);

    const value = useMemo<I18nContextValue>(() => ({
        locale,
        setLocale: setLocaleState,
        t: (key, params) => formatMessage(messages[locale][key] ?? messages.ja[key], params),
    }), [locale]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useTranslation must be used within I18nProvider");
    }
    return context;
}
