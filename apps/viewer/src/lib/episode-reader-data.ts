import { selectPageImage, type ViewerLocale } from "./localized-metadata";

export interface ViewerReaderPage {
  id: string;
  pageNumber: number;
  displayRef?: string;
  images: Record<string, string | undefined>;
  imageLocaleFallbacks: string[];
  src: string;
  width: number;
  height: number;
  availablePacks: unknown[];
  panels: Array<{
    id: string;
    panelNumber: number;
    bbox: unknown;
    feedbackEnabled: boolean;
    shareable: boolean;
    bubbles: Array<{
      id: string;
      bubbleNumber: number;
      shortId?: string;
      bubbleType?: string;
      textOriginal?: string;
      speaker?: string;
      bbox: unknown;
      feedbackEnabled: boolean;
      shareable: boolean;
    }>;
  }>;
}

export function isSafeReaderImageSrc(src: unknown): src is string {
  if (typeof src !== "string" || src.length === 0) return false;
  if (src === "/placeholder-page.svg") return true;
  if (src.startsWith("/api/v1/deliver/") || src.startsWith("/deliver/")) return true;
  try {
    const url = new URL(src);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.pathname.includes("/contents/")) return false;
    if (/\/pages\/[^/]+\.(jpe?g|png|webp|gif)$/i.test(url.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolveReaderImageSrc(page: any, locale = "ja"): string {
  const preferred = selectPageImage(page, locale === "en" ? "en" : "ja");
  return isSafeReaderImageSrc(preferred) ? preferred : "/placeholder-page.svg";
}

function pageIdOf(page: any): string {
  return page.pageId ?? page.id;
}

function panelIdOf(panel: any): string {
  return panel.panelId ?? panel.id;
}

function bubbleIdOf(bubble: any): string {
  return bubble.bubbleId ?? bubble.id;
}

function bubblesForPanel(page: any, panel: any): any[] {
  if (Array.isArray(page.bubbles)) {
    const panelId = panelIdOf(panel);
    return page.bubbles.filter((bubble: any) => bubble.panelId === panelId);
  }
  return panel.bubbles ?? [];
}

function imageLocaleFallbacks(page: any, locale: ViewerLocale): string[] {
  const fallbacks = [
    locale,
    page?.metadata?.defaultReaderLocale,
    page?.metadata?.canonicalLocale,
    "ja",
    "en",
    ...Object.keys(page?.images ?? {}),
  ];
  return fallbacks.filter((value, index, list): value is string =>
    typeof value === "string" && value.length > 0 && list.indexOf(value) === index,
  );
}

export function toViewerReaderPages(pages: any[], locale: ViewerLocale = "ja"): ViewerReaderPage[] {
  return pages.map((page: any) => ({
    id: pageIdOf(page),
    pageNumber: page.pageNumber,
    displayRef: page.displayRef,
    images: page.images ?? {},
    imageLocaleFallbacks: imageLocaleFallbacks(page, locale),
    src: resolveReaderImageSrc(page, locale),
    width: page.width,
    height: page.height,
    availablePacks: page.availablePacks ?? [],
    panels: (page.panels ?? []).map((panel: any) => ({
      id: panelIdOf(panel),
      panelNumber: panel.panelNumber,
      bbox: panel.bbox,
      feedbackEnabled: panel.flags?.feedback_enabled !== false,
      shareable: panel.flags?.shareable !== false,
      bubbles: bubblesForPanel(page, panel).map((bubble: any) => ({
        id: bubbleIdOf(bubble),
        bubbleNumber: bubble.bubbleNumber,
        shortId: bubble.displayRef ?? bubble.shortId,
        bubbleType: bubble.bubbleType,
        textOriginal: bubble.textOriginal,
        speaker: bubble.speaker,
        bbox: bubble.bbox,
        feedbackEnabled: bubble.flags?.feedback_enabled !== false,
        shareable: bubble.flags?.shareable !== false,
      })),
    })),
  }));
}

export function safeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function resolveEpisodeOgImage(input: {
  seriesCoverUrl: string;
  seriesShareImageUrl: string;
  pageOgImage?: string;
  firstPageSrc?: string;
}): string {
  const hasPublicCoverUrl = input.seriesCoverUrl.startsWith("/") || /^https?:\/\//.test(input.seriesCoverUrl);
  const hasPublicShareImageUrl = input.seriesShareImageUrl.startsWith("/") || /^https?:\/\//.test(input.seriesShareImageUrl);
  if (input.pageOgImage) return input.pageOgImage;
  if (hasPublicShareImageUrl) return input.seriesShareImageUrl;
  if (hasPublicCoverUrl) return input.seriesCoverUrl;
  return input.firstPageSrc || "/placeholder-cover.svg";
}
