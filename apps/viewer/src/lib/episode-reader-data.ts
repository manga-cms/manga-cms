export interface ViewerReaderPage {
  id: string;
  pageNumber: number;
  displayRef?: string;
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

export function resolveReaderImageSrc(page: any): string {
  const preferred = page.images?.ja;
  return isSafeReaderImageSrc(preferred) ? preferred : "/placeholder-page.svg";
}

export function toViewerReaderPages(pages: any[]): ViewerReaderPage[] {
  return pages.map((page: any) => ({
    id: page.id,
    pageNumber: page.pageNumber,
    displayRef: page.displayRef,
    src: resolveReaderImageSrc(page),
    width: page.width,
    height: page.height,
    availablePacks: page.availablePacks ?? [],
    panels: (page.panels ?? []).map((panel: any) => ({
      id: panel.id,
      panelNumber: panel.panelNumber,
      bbox: panel.bbox,
      feedbackEnabled: panel.flags?.feedback_enabled !== false,
      shareable: panel.flags?.shareable !== false,
      bubbles: (panel.bubbles ?? []).map((bubble: any) => ({
        id: bubble.id,
        bubbleNumber: bubble.bubbleNumber,
        shortId: bubble.shortId,
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
  firstPageSrc?: string;
}): string {
  const hasPublicCoverUrl = input.seriesCoverUrl.startsWith("/") || /^https?:\/\//.test(input.seriesCoverUrl);
  const hasPublicShareImageUrl = input.seriesShareImageUrl.startsWith("/") || /^https?:\/\//.test(input.seriesShareImageUrl);
  if (hasPublicShareImageUrl) return input.seriesShareImageUrl;
  if (hasPublicCoverUrl) return input.seriesCoverUrl;
  return input.firstPageSrc || "/placeholder-cover.svg";
}
