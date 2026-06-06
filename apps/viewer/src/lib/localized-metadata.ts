export type ViewerLocale = "ja" | "en";

export const normalizeViewerLocale = (locale: unknown): ViewerLocale => locale === "en" ? "en" : "ja";

const normalizeText = (value: unknown, maxLength = 180) => {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

const localizedEntry = (entity: any, locale: ViewerLocale) => {
  const metadata = entity?.metadata;
  return metadata?.localized?.[locale] ?? metadata?.localized?.[locale.toUpperCase()] ?? {};
};

export const localizedTitle = (entity: any, locale: ViewerLocale, maxLength = 90) => {
  const entry = localizedEntry(entity, locale);
  return normalizeText(entry.shareTitle ?? entry.title, maxLength);
};

export const localizedDescription = (entity: any, locale: ViewerLocale, maxLength = 180) => {
  const entry = localizedEntry(entity, locale);
  return normalizeText(entry.shareDescription ?? entry.description, maxLength);
};

export const canonicalTitle = (entity: any, maxLength = 90) => normalizeText(entity?.title ?? "", maxLength);
export const canonicalDescription = (entity: any, maxLength = 180) => normalizeText(entity?.description ?? "", maxLength);

export const seriesDisplayTitle = (series: any, locale: ViewerLocale) =>
  localizedTitle(series, locale) || canonicalTitle(series);

const comparableTitle = (title: unknown) => String(title ?? "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase();

export const samePublicTitle = (a: unknown, b: unknown) => {
  const left = comparableTitle(a);
  const right = comparableTitle(b);
  return left.length > 0 && left === right;
};

const isGenericEpisodeTitle = (title: unknown, episodeNumber: unknown) => {
  const normalized = String(title ?? "").trim().toLowerCase();
  const number = Number(episodeNumber);
  return normalized === `episode ${number}` || normalized === `ep ${number}` || normalized === `ep.${number}`;
};

export const episodeDisplayTitle = (input: {
  series: any;
  episode: any;
  locale: ViewerLocale;
  publicationType?: string;
  isSingleEpisode?: boolean;
}) => {
  const localizedEpisodeTitle = localizedTitle(input.episode, input.locale);
  const seriesTitle = seriesDisplayTitle(input.series, input.locale) || canonicalTitle(input.series);
  if (localizedEpisodeTitle) {
    return (
      input.publicationType === "oneshot"
      && input.isSingleEpisode
      && isGenericEpisodeTitle(localizedEpisodeTitle, input.episode?.episodeNumber)
    )
      ? seriesTitle || localizedEpisodeTitle
      : localizedEpisodeTitle;
  }

  if (
    input.publicationType === "oneshot"
    && input.isSingleEpisode
    && isGenericEpisodeTitle(input.episode?.title, input.episode?.episodeNumber)
  ) {
    return seriesTitle || canonicalTitle(input.episode);
  }

  return canonicalTitle(input.episode) || seriesTitle;
};

export const joinedSeriesEpisodeTitle = (input: {
  seriesTitle: string;
  episodeTitle: string;
  publicationType?: string;
  isSingleEpisode?: boolean;
  separator?: string;
}) => {
  const seriesTitle = normalizeText(input.seriesTitle, 90);
  const episodeTitle = normalizeText(input.episodeTitle, 90);
  if (!seriesTitle) return episodeTitle;
  if (!episodeTitle || samePublicTitle(seriesTitle, episodeTitle)) return seriesTitle;
  if (input.publicationType === "oneshot" && input.isSingleEpisode) return episodeTitle;
  return [seriesTitle, episodeTitle].filter(Boolean).join(input.separator ?? " — ");
};

export const publicAuthorLabel = (series: any, locale: ViewerLocale) => {
  const localizedAuthor = normalizeText(localizedEntry(series, locale).authorLabel, 90);
  if (localizedAuthor) return localizedAuthor;
  const metadataAuthor = normalizeText(series?.metadata?.authorLabel, 90);
  if (metadataAuthor) return metadataAuthor;
  const credits = Array.isArray(series?.metadata?.creatorCredits) ? [...series.metadata.creatorCredits] : [];
  credits.sort((a: any, b: any) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));
  for (const credit of credits) {
    const localizedName = normalizeText(credit?.localizedDisplayNames?.[locale], 90);
    if (localizedName) return localizedName;
  }
  for (const credit of credits) {
    const displayName = normalizeText(credit?.displayName, 90);
    if (displayName) return displayName;
  }
  return "";
};

export const descriptionWithTitleAndAuthor = (input: {
  title?: unknown;
  authorLabel?: unknown;
  description?: unknown;
  locale: ViewerLocale;
  maxLength?: number;
}) => {
  const maxLength = input.maxLength ?? 220;
  const title = normalizeText(input.title, 90);
  const author = normalizeText(input.authorLabel, 90);
  const base = normalizeText(input.description, maxLength);
  const authorText = author ? (input.locale === "en" ? `Author: ${author}` : `作者: ${author}`) : "";
  const prefix = [title, authorText].filter(Boolean).join(" | ");
  if (!prefix) return base;
  if (!base) return normalizeText(prefix, maxLength);

  const separator = " | ";
  const availableBaseLength = Math.max(40, maxLength - prefix.length - separator.length);
  const shortenedBase = normalizeText(base, availableBaseLength);
  return normalizeText(`${prefix}${separator}${shortenedBase}`, maxLength);
};

export const descriptionWithAuthor = (
  description: unknown,
  authorLabel: unknown,
  locale: ViewerLocale,
  maxLength = 220,
) => {
  const author = normalizeText(authorLabel, 90);
  const base = normalizeText(description, maxLength);
  if (!author) return base;

  const authorSuffix = locale === "en" ? `Author: ${author}` : `作者: ${author}`;
  if (!base) return authorSuffix;

  const separator = locale === "en" && !/[.!?]$/.test(base) ? ". " : " ";
  const availableBaseLength = Math.max(40, maxLength - authorSuffix.length - separator.length);
  const shortenedBase = normalizeText(base, availableBaseLength);
  return normalizeText(`${shortenedBase}${separator}${authorSuffix}`, maxLength);
};

export const localeFallbacksFor = (entity: any, requestedLocale: ViewerLocale): string[] => {
  const metadata = entity?.metadata ?? {};
  return [
    requestedLocale,
    metadata.defaultReaderLocale,
    metadata.canonicalLocale,
    "ja",
    "en",
  ].filter((value, index, list): value is string => {
    if (typeof value !== "string" || value.length === 0) return false;
    return list.indexOf(value) === index;
  });
};

export const selectPageImage = (page: any, requestedLocale: ViewerLocale): string => {
  const images = page?.images ?? {};
  for (const locale of localeFallbacksFor(page, requestedLocale)) {
    if (images[locale]) return images[locale];
  }
  return Object.values(images).find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
};
