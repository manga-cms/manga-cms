import type { PublishedPack } from "./api-client";
import { isSafeReaderImageSrc, resolveReaderImageSrc } from "./episode-reader-data";

export interface OverlayBubble {
  id: string;
  panelId: string | null;
  bubbleNumber: number;
  displayRef?: string;
  speaker?: string | null;
  bubbleType?: string;
  textDirection?: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  style: string;
  fit: {
    characterCount: number;
    estimatedCapacity: number;
    ratio: number;
    scale: number;
  };
}

export interface OverlayPage {
  id: string;
  pageNumber: number;
  imageSrc: string;
  width: number;
  height: number;
  bubbles: OverlayBubble[];
}

const splitEnvList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const processEnv = () =>
  typeof process !== "undefined" ? process.env : {};

const idOf = (entity: any, primary: string, fallback = "id") =>
  String(entity?.[primary] ?? entity?.[fallback] ?? "");

const normalizeStatus = (value: unknown) => String(value ?? "").toLowerCase();

const isBlockedStatus = (value: unknown) =>
  ["deleted", "draft", "hidden", "archived", "scheduled", "expired", "gated"].includes(normalizeStatus(value));

const envEnablesOverlay = (seriesId: string, episodeId: string) => {
  const env = processEnv();
  const seriesFlags = splitEnvList(env.READER_TEXT_OVERLAY_SERIES);
  const episodeFlags = splitEnvList(env.READER_TEXT_OVERLAY_EPISODES);
  const episodeKeys = new Set([
    `${seriesId}/${episodeId}`,
    `${seriesId}:${episodeId}`,
    episodeId,
  ]);
  return seriesFlags.includes(seriesId) || episodeFlags.some((item) => episodeKeys.has(item));
};

const envEnablesSpaceAsBreak = (seriesId: string, episodeId: string) => {
  const flags = splitEnvList(processEnv().READER_TEXT_OVERLAY_SPACE_AS_BREAK);
  const episodeKeys = new Set([
    "*",
    "true",
    seriesId,
    episodeId,
    `${seriesId}/${episodeId}`,
    `${seriesId}:${episodeId}`,
  ]);
  return flags.some((item) => episodeKeys.has(item.toLowerCase() === "true" ? "true" : item));
};

export const isTextOverlayEnabled = (input: {
  series: any;
  episode: any;
  seriesId: string;
  episodeId: string;
}) =>
  envEnablesOverlay(input.seriesId, input.episodeId);

const bubbleIdOf = (bubble: any) => idOf(bubble, "bubbleId");
const pageIdOf = (page: any) => idOf(page, "pageId");

const publicBubbleAllowed = (bubble: any) => {
  if (!bubble) return false;
  if (isBlockedStatus(bubble.status)) return false;
  if (bubble.flags?.shareable === false) return false;
  return typeof bubble.textOriginal === "string" && bubble.textOriginal.trim().length > 0;
};

const normalizeLanguage = (value: unknown) =>
  String(value ?? "ja").trim().toLowerCase() || "ja";

const publishedTranslationForBubble = (packs: PublishedPack[], bubbleId: string, language: string): string | undefined => {
  for (const pack of packs) {
    if (!pack.isPublished || pack.type !== "TRANSLATION") continue;
    for (const entry of pack.entries ?? []) {
      const entryLanguage = normalizeLanguage(entry.language ?? pack.language);
      if (entryLanguage !== language) continue;
      if (entry.target?.bubbleId !== bubbleId) continue;
      if (typeof entry.text === "string" && entry.text.trim().length > 0) {
        return entry.text;
      }
    }
  }
  return undefined;
};

const overlayTextForBubble = (bubble: any, packs: PublishedPack[], language: string) => {
  if (language !== "ja") {
    const translated = publishedTranslationForBubble(packs, bubbleIdOf(bubble), language);
    if (translated) return translated;
  }
  return bubble.textOriginal;
};

const renderTextForOverlay = (text: string, options: { spaceAsBreak: boolean }) => {
  if (!options.spaceAsBreak) return text;
  // Display-only source-locale experiment: preserve authored/new review line
  // breaks, but do not reserve ASCII spaces as hard line breaks. Manga source
  // text may use half-width spaces as punctuation, so overlay hard breaks must
  // come from explicit "\n" review text. Natural CSS line breaking and the
  // per-Bubble refitter handle fit without changing canonical textOriginal or
  // published Pack text.
  return text.replace(/\r\n?/gu, "\n");
};

const blankImageCandidates = (language: string) => [
  `${language}-blank`,
  `blank-${language}`,
  "blank",
  "ja-blank",
  language,
];

const overlayImageSrc = (page: any, language: string) => {
  const images = page?.images ?? {};
  for (const key of blankImageCandidates(language)) {
    const candidate = images[key];
    if (isSafeReaderImageSrc(candidate)) return candidate;
  }
  return resolveReaderImageSrc(page, language === "en" ? "en" : "ja");
};

const pct = (value: number, total: number) =>
  `${((value / Math.max(total, 1)) * 100).toFixed(4)}%`;

const countFitCharacters = (text: string) =>
  Array.from(text.replace(/\s+/g, "")).length;

const estimateOverlayCapacity = (
  bbox: { width?: number; height?: number },
  direction: "horizontal" | "vertical",
  pageWidth: number,
) => {
  const width = Math.max(1, Number(bbox.width ?? 1));
  const height = Math.max(1, Number(bbox.height ?? 1));
  // Canonical bbox coordinates are page-pixel based. Match the CMS fit
  // heuristic's 1200px baseline until textStyle.fontSizePx exists.
  const scale = Math.max(0.25, pageWidth / 1200);
  const lineStep = (direction === "horizontal" ? 24 : 26) * scale;
  const charStep = (direction === "horizontal" ? 15 : 18) * scale;
  const charsPerLine = direction === "horizontal"
    ? Math.max(4, Math.floor(width / charStep))
    : Math.max(4, Math.floor(height / charStep));
  const lines = direction === "horizontal"
    ? Math.max(1, Math.floor(height / lineStep))
    : Math.max(1, Math.floor(width / lineStep));
  return Math.max(8, charsPerLine * lines);
};

const estimateOverlayFit = (input: {
  text: string;
  bbox: { width?: number; height?: number };
  textDirection?: string;
  pageWidth: number;
}) => {
  const direction = input.textDirection === "vertical" ? "vertical" : "horizontal";
  const characterCount = countFitCharacters(input.text);
  const estimatedCapacity = estimateOverlayCapacity(input.bbox, direction, input.pageWidth);
  const ratio = estimatedCapacity === 0 ? 0 : characterCount / estimatedCapacity;
  // Initial SSR fit only avoids obviously too-large first paint. The browser
  // refitter measures actual scroll bounds and sets --overlay-refit.
  const scale = ratio <= 0.85
    ? 1
    : Math.max(0.58, Math.min(1, Math.sqrt(1 / Math.max(ratio, 0.01)) * 0.96));
  return { characterCount, estimatedCapacity, ratio, scale };
};

const bubbleStyle = (bubble: any, page: any) => {
  const bbox = bubble.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
  const text = String(bubble.__overlayText ?? bubble.textOriginal ?? "");
  const fit = estimateOverlayFit({
    text,
    bbox,
    textDirection: bubble.textDirection,
    pageWidth: Number(page.width ?? 1200),
  });
  return [
    `left:${pct(Number(bbox.x ?? 0), Number(page.width ?? 1))}`,
    `top:${pct(Number(bbox.y ?? 0), Number(page.height ?? 1))}`,
    `width:${pct(Number(bbox.width ?? 0), Number(page.width ?? 1))}`,
    `height:${pct(Number(bbox.height ?? 0), Number(page.height ?? 1))}`,
    `--overlay-fit:${fit.scale.toFixed(4)}`,
  ].join(";");
};

export const buildTextOverlayPages = (
  pages: any[],
  languageInput: string,
  options: { seriesId?: string; episodeId?: string } = {},
): OverlayPage[] => {
  const language = normalizeLanguage(languageInput);
  const spaceAsBreak = options.seriesId && options.episodeId
    ? envEnablesSpaceAsBreak(options.seriesId, options.episodeId)
    : false;
  return [...(pages ?? [])]
    .sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0))
    .map((page: any) => {
      const packs = (page.availablePacks ?? []) as PublishedPack[];
      const bubbles = [...(page.bubbles ?? [])]
        .filter(publicBubbleAllowed)
        .sort((a, b) =>
          Number(a.bubbleNumber ?? 0) - Number(b.bubbleNumber ?? 0) ||
          bubbleIdOf(a).localeCompare(bubbleIdOf(b)),
        )
        .map((bubble: any): OverlayBubble => {
          const text = renderTextForOverlay(overlayTextForBubble(bubble, packs, language), {
            spaceAsBreak: spaceAsBreak && language === "ja",
          });
          const fit = estimateOverlayFit({
            text,
            bbox: bubble.bbox ?? {},
            textDirection: bubble.textDirection,
            pageWidth: Number(page.width ?? 1200),
          });
          return {
            id: bubbleIdOf(bubble),
            panelId: bubble.panelId ?? null,
            bubbleNumber: Number(bubble.bubbleNumber ?? 0),
            displayRef: bubble.displayRef ?? bubble.shortId,
            speaker: bubble.speaker ?? null,
            bubbleType: bubble.bubbleType,
            textDirection: bubble.textDirection,
            text,
            bbox: bubble.bbox,
            style: bubbleStyle({ ...bubble, __overlayText: text }, page),
            fit,
          };
        });
      return {
        id: pageIdOf(page),
        pageNumber: Number(page.pageNumber ?? 0),
        imageSrc: overlayImageSrc(page, language),
        width: Number(page.width ?? 0),
        height: Number(page.height ?? 0),
        bubbles,
      };
    });
};
