import { useTranslation } from "./I18nProvider";
import type { CmsLocale } from "./messages";

const LOCALES: CmsLocale[] = ["ja", "en"];

export function LocaleSwitcher() {
    const { locale, setLocale, t } = useTranslation();

    return (
        <div className="locale-switcher" aria-label="UI language">
            {LOCALES.map((item) => (
                <button
                    key={item}
                    type="button"
                    className={item === locale ? "is-active" : ""}
                    onClick={() => setLocale(item)}
                    aria-pressed={item === locale}
                >
                    {t(item === "ja" ? "app.locale.ja" : "app.locale.en")}
                </button>
            ))}
        </div>
    );
}
