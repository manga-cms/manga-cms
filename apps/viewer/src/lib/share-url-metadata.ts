import { fetchEpisode } from "./api-client";
import {
  canonicalDescription,
  canonicalTitle,
  descriptionWithTitleAndAuthor,
  episodeDisplayTitle,
  joinedSeriesEpisodeTitle,
  localizedDescription,
  localizedTitle,
  publicAuthorLabel,
} from "./localized-metadata";
import { OGP_CANVAS_HEIGHT, OGP_CANVAS_WIDTH } from "./og-image";
import { siteConfig } from "./site-config";

export type ShareTargetKind = "episode" | "page" | "panel" | "bubble";
export type ShareLocale = "ja" | "en";

export interface ShareRouteInput {
  seriesId: string;
  episodeId: string;
  pageNumber?: number;
  panelRef?: string;
  bubbleRef?: string;
  locale: ShareLocale;
  origin: string;
}

export interface ShareRouteResolution {
  kind: ShareTargetKind;
  series: any;
  episode: any;
  page?: any;
  panel?: any;
  bubble?: any;
  title: string;
  description: string;
  canonicalUrl: string;
  currentShareUrl: string;
  englishUrl: string;
  readerUrl: string;
  targetLabel: string;
  authorLabel?: string;
  ogImageUrl?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
}

const DEFAULT_DESCRIPTION = "Manga CMSで公開されているマンガを読む、共有する、翻訳や修正につなげるための共有ページです。";

const normalizeText = (value: unknown, maxLength = 180) => {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

const isBlockedStatus = (value: unknown) => {
  const status = String(value ?? "").toLowerCase();
  return ["deleted", "draft", "hidden", "archived", "scheduled", "expired", "gated"].includes(status);
};

const isPublicEntity = (entity: any) => {
  if (!entity) return false;
  if (entity.gated === true) return false;
  if (entity.visibility && entity.visibility !== "public") return false;
  if (isBlockedStatus(entity.status) || isBlockedStatus(entity.lifecycleStatus)) return false;
  if (entity.flags?.shareable === false) return false;
  if (entity.metadata?.publicSafety?.hidden === true) return false;
  if (entity.metadata?.publicSafety?.archived === true) return false;
  if (entity.metadata?.publicSafety?.rightsClearedForPreview === false) return false;
  return true;
};

const pageId = (page: any) => page?.pageId ?? page?.id ?? "";
const panelId = (panel: any) => panel?.panelId ?? panel?.id ?? "";
const bubbleId = (bubble: any) => bubble?.bubbleId ?? bubble?.id ?? "";

const candidatesForPanel = (panel: any, page: any) => {
  const pageNumber = Number(page?.pageNumber);
  const panelNumber = Number(panel?.panelNumber);
  const paddedPanel = Number.isFinite(panelNumber) ? String(panelNumber).padStart(2, "0") : "";
  return [
    panel?.displayRef,
    panel?.shortId,
    panel?.stableRef,
    panel?.panelId,
    panel?.id,
    Number.isFinite(panelNumber) ? String(panelNumber) : "",
    paddedPanel ? `k${paddedPanel}` : "",
    Number.isFinite(pageNumber) && Number.isFinite(panelNumber) ? `p${pageNumber}-${panelNumber}` : "",
    Number.isFinite(pageNumber) && paddedPanel ? `p${String(pageNumber).padStart(2, "0")}-k${paddedPanel}` : "",
  ].filter(Boolean).map(String);
};

const candidatesForBubble = (bubble: any, panel: any, page: any) => {
  const pageNumber = Number(page?.pageNumber);
  const panelNumber = Number(panel?.panelNumber ?? bubble?.panelNumber);
  const bubbleNumber = Number(bubble?.bubbleNumber);
  const paddedBubble = Number.isFinite(bubbleNumber) ? String(bubbleNumber).padStart(2, "0") : "";
  return [
    bubble?.displayRef,
    bubble?.shortId,
    bubble?.stableRef,
    bubble?.bubbleId,
    bubble?.id,
    Number.isFinite(bubbleNumber) ? String(bubbleNumber) : "",
    paddedBubble ? `f${paddedBubble}` : "",
    Number.isFinite(pageNumber) && Number.isFinite(panelNumber) && Number.isFinite(bubbleNumber)
      ? `p${pageNumber}-${panelNumber}-${bubbleNumber}`
      : "",
    Number.isFinite(pageNumber) && Number.isFinite(panelNumber) && paddedBubble
      ? `p${String(pageNumber).padStart(2, "0")}-k${String(panelNumber).padStart(2, "0")}-f${paddedBubble}`
      : "",
  ].filter(Boolean).map(String);
};

const refMatches = (candidate: string, requested: string) =>
  candidate.toLowerCase() === requested.toLowerCase();

const findPanel = (page: any, panelRef: string) =>
  (page?.panels ?? []).find((panel: any) => candidatesForPanel(panel, page).some((candidate) => refMatches(candidate, panelRef)));

const findBubble = (page: any, bubbleRef: string) => {
  for (const panel of page?.panels ?? []) {
    const bubble = (panel.bubbles ?? []).find((item: any) =>
      candidatesForBubble(item, panel, page).some((candidate) => refMatches(candidate, bubbleRef)),
    );
    if (bubble) return { bubble, panel };
  }

  for (const bubble of page?.bubbles ?? []) {
    const panel = (page?.panels ?? []).find((item: any) => panelId(item) === bubble.panelId) ?? null;
    if (candidatesForBubble(bubble, panel, page).some((candidate) => refMatches(candidate, bubbleRef))) {
      return { bubble, panel };
    }
  }

  return null;
};

const publicPanelRef = (panel: any) => panel?.displayRef ?? panel?.shortId ?? `Panel ${panel?.panelNumber ?? ""}`;
const publicBubbleRef = (bubble: any) => bubble?.displayRef ?? bubble?.shortId ?? `Bubble ${bubble?.bubbleNumber ?? ""}`;

const localizedBubbleText = (bubble: any, page: any, locale: ShareLocale) => {
  if (!bubble) return "";
  if (locale === "en") {
    for (const pack of page?.availablePacks ?? []) {
      if (pack?.type !== "TRANSLATION" || pack?.language !== "en") continue;
      const entry = (pack.entries ?? []).find((item: any) => item?.target?.bubbleId === bubbleId(bubble));
      const text = normalizeText(entry?.text, 80);
      if (text) return text;
    }
  }
  return normalizeText(bubble?.textOriginal, 80);
};

const panelBubbles = (panel: any, page: any) => {
  const nested = (panel?.bubbles ?? []).filter(Boolean);
  if (nested.length > 0) return nested;
  const id = panelId(panel);
  return (page?.bubbles ?? []).filter((bubble: any) => String(bubble?.panelId ?? "") === String(id));
};

const quotedBubbleText = (bubble: any, page: any, locale: ShareLocale) => {
  const text = localizedBubbleText(bubble, page, locale);
  return text ? `「${text}」` : "";
};

const panelTextSummary = (panel: any, page: any, locale: ShareLocale) =>
  panelBubbles(panel, page)
    .map((bubble: any) => quotedBubbleText(bubble, page, locale))
    .filter(Boolean)
    .join(" ");

const sharePathFor = (input: ShareRouteInput) => {
  let path = `/s/${encodeURIComponent(input.seriesId)}/${encodeURIComponent(input.episodeId)}`;
  if (input.pageNumber) path += `/p/${input.pageNumber}`;
  if (input.panelRef) path += `/k/${encodeURIComponent(input.panelRef)}`;
  if (input.bubbleRef) path += `/f/${encodeURIComponent(input.bubbleRef)}`;
  return path;
};

const pageOgImagePathFor = (input: ShareRouteInput) =>
  `/og/${encodeURIComponent(input.seriesId)}/${encodeURIComponent(input.episodeId)}/p/${encodeURIComponent(String(input.pageNumber))}.png`;

const panelOgImagePathFor = (input: ShareRouteInput) =>
  `/og/${encodeURIComponent(input.seriesId)}/${encodeURIComponent(input.episodeId)}/p/${encodeURIComponent(String(input.pageNumber))}/k/${encodeURIComponent(String(input.panelRef))}/card.png`;

const withLang = (url: URL, locale: ShareLocale) => {
  if (locale === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  return url.href;
};

const readerUrlFor = (input: ShareRouteInput, page: any | undefined, panel: any | undefined, bubble: any | undefined) => {
  const url = new URL(`/works/${encodeURIComponent(input.seriesId)}/episodes/${encodeURIComponent(input.episodeId)}`, input.origin);
  if (bubble) url.searchParams.set("focus", bubbleId(bubble));
  else if (panel) url.searchParams.set("focus", panelId(panel));
  else if (page && Number(page.pageNumber) > 1) url.searchParams.set("page", pageId(page));
  if (input.locale === "en") url.searchParams.set("lang", "en");
  return url.href;
};

const titleFor = (
  kind: ShareTargetKind,
  input: ShareRouteInput,
  series: any,
  episode: any,
  isSingleEpisode: boolean,
  page?: any,
  panel?: any,
  bubble?: any,
) => {
  const target = bubble ?? panel ?? page ?? episode;
  const targetTitle = localizedTitle(target, input.locale);
  if (targetTitle) return targetTitle;

  const episodeTitle = episodeDisplayTitle({
    series,
    episode,
    locale: input.locale,
    publicationType: series?.publicationType ?? episode?.publicationType,
    isSingleEpisode,
  }) || input.episodeId;
  const seriesTitle = localizedTitle(series, input.locale) || canonicalTitle(series) || input.seriesId;
  const shareEpisodeTitle = joinedSeriesEpisodeTitle({
    seriesTitle,
    episodeTitle,
    publicationType: series?.publicationType ?? episode?.publicationType,
    isSingleEpisode,
    separator: " - ",
  });
  if (kind === "episode") return shareEpisodeTitle;
  if (kind === "page") return `${shareEpisodeTitle} - Page ${page?.pageNumber}`;
  if (kind === "panel" || kind === "bubble") return shareEpisodeTitle;
  return shareEpisodeTitle;
};

const descriptionFor = (kind: ShareTargetKind, input: ShareRouteInput, series: any, episode: any, page?: any, panel?: any, bubble?: any) => {
  const target = bubble ?? panel ?? page ?? episode;
  const localizedTargetDescription = localizedDescription(target, input.locale);
  if (localizedTargetDescription) return localizedTargetDescription;

  const baseDescription = localizedDescription(episode, input.locale)
    || localizedDescription(series, input.locale)
    || canonicalDescription(series)
    || DEFAULT_DESCRIPTION;
  if (kind === "episode") return baseDescription;
  if (kind === "page") return normalizeText(`${baseDescription} Page ${page?.pageNumber} の共有ページです。`);
  if (kind === "panel") {
    const panelText = panelTextSummary(panel, page, input.locale);
    if (panelText) return normalizeText(panelText);
    return baseDescription;
  }

  const quote = quotedBubbleText(bubble, page, input.locale);
  if (quote) {
    return normalizeText(quote);
  }
  return baseDescription;
};

const targetLabelFor = (kind: ShareTargetKind, page?: any, panel?: any, bubble?: any) => {
  if (kind === "episode") return "エピソード";
  if (kind === "page") return `Page ${page?.pageNumber}`;
  if (kind === "panel") return `Page ${page?.pageNumber} / ${publicPanelRef(panel)}`;
  return `Page ${page?.pageNumber} / ${publicBubbleRef(bubble)}`;
};

export async function resolveShareRoute(input: ShareRouteInput): Promise<ShareRouteResolution | null> {
  if (
    siteConfig.mode === "official"
    && siteConfig.content.demoSeriesIds.length > 0
    && !siteConfig.content.demoSeriesIds.includes(input.seriesId)
  ) return null;

  const response = await fetchEpisode(input.seriesId, input.episodeId);
  if (!response.data) return null;
  if ((response.data as any).gated === true) return null;

  const series = response.data.series;
  const episode = response.data.episode;
  if (!isPublicEntity(series) || !isPublicEntity(episode)) return null;
  if (!episode.pages?.length) return null;

  let kind: ShareTargetKind = "episode";
  let page: any | undefined;
  let panel: any | undefined;
  let bubble: any | undefined;

  if (input.pageNumber) {
    page = episode.pages.find((item: any) => Number(item.pageNumber) === input.pageNumber);
    if (!page || !isPublicEntity(page)) return null;
    kind = "page";
  }

  if (input.panelRef) {
    if (!page) return null;
    panel = findPanel(page, input.panelRef);
    if (!panel || !isPublicEntity(panel)) return null;
    kind = "panel";
  }

  if (input.bubbleRef) {
    if (!page) return null;
    const resolved = findBubble(page, input.bubbleRef);
    if (!resolved?.bubble || !isPublicEntity(resolved.bubble)) return null;
    bubble = resolved.bubble;
    panel = resolved.panel ?? panel;
    if (panel && !isPublicEntity(panel)) return null;
    kind = "bubble";
  }

  const canonicalUrl = new URL(sharePathFor({ ...input, locale: "ja" }), input.origin);
  canonicalUrl.searchParams.delete("lang");
  const currentShareUrl = new URL(canonicalUrl.href);
  const englishUrl = new URL(canonicalUrl.href);
  const ogImageSourceUrl = kind === "panel" && page?.pageNumber && input.panelRef
    ? new URL(panelOgImagePathFor(input), input.origin)
    : kind === "page" && page?.pageNumber
      ? new URL(pageOgImagePathFor(input), input.origin)
      : null;
  const ogImageUrl = ogImageSourceUrl
    ? withLang(ogImageSourceUrl, input.locale)
    : undefined;
  const ogImageWidth = ogImageUrl ? OGP_CANVAS_WIDTH : undefined;
  const ogImageHeight = ogImageUrl ? OGP_CANVAS_HEIGHT : undefined;

  const isSingleEpisode = !response.data.prev && !response.data.next;
  const title = titleFor(kind, input, series, episode, isSingleEpisode, page, panel, bubble);
  const authorLabel = publicAuthorLabel(series, input.locale);
  const description = descriptionWithTitleAndAuthor({
    title,
    authorLabel,
    description: descriptionFor(kind, input, series, episode, page, panel, bubble),
    locale: input.locale,
  });

  return {
    kind,
    series,
    episode,
    page,
    panel,
    bubble,
    title,
    description,
    canonicalUrl: canonicalUrl.href,
    currentShareUrl: withLang(currentShareUrl, input.locale),
    englishUrl: withLang(englishUrl, "en"),
    readerUrl: readerUrlFor(input, page, panel, bubble),
    targetLabel: targetLabelFor(kind, page, panel, bubble),
    authorLabel,
    ogImageUrl,
    ogImageWidth,
    ogImageHeight,
    ogImageAlt: ogImageUrl
      ? [
          canonicalTitle(series) || input.seriesId,
          canonicalTitle(episode) || input.episodeId,
          `Page ${page?.pageNumber}`,
          kind === "panel" ? `Panel ${publicPanelRef(panel)}` : "",
        ].filter(Boolean).join(" ")
      : undefined,
  };
}
