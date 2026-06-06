export const shouldIndexEnglishLocale = () =>
  String(import.meta.env.PUBLIC_INDEX_EN_LOCALE ?? "").toLowerCase() === "true";

export const robotsForLocale = (locale: string | undefined) =>
  locale === "en" && !shouldIndexEnglishLocale() ? "noindex,follow" : undefined;
