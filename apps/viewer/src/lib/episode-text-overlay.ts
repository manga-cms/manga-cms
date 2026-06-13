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

const bubbleStyle = (bubble: any, page: any) => {
  const bbox = bubble.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
  return [
    `left:${pct(Number(bbox.x ?? 0), Number(page.width ?? 1))}`,
    `top:${pct(Number(bbox.y ?? 0), Number(page.height ?? 1))}`,
    `width:${pct(Number(bbox.width ?? 0), Number(page.width ?? 1))}`,
    `height:${pct(Number(bbox.height ?? 0), Number(page.height ?? 1))}`,
  ].join(";");
};

export const buildTextOverlayPages = (pages: any[], languageInput: string): OverlayPage[] => {
  const language = normalizeLanguage(languageInput);
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
        .map((bubble: any): OverlayBubble => ({
          id: bubbleIdOf(bubble),
          panelId: bubble.panelId ?? null,
          bubbleNumber: Number(bubble.bubbleNumber ?? 0),
          displayRef: bubble.displayRef ?? bubble.shortId,
          speaker: bubble.speaker ?? null,
          bubbleType: bubble.bubbleType,
          textDirection: bubble.textDirection,
          text: overlayTextForBubble(bubble, packs, language),
          bbox: bubble.bbox,
          style: bubbleStyle(bubble, page),
        }));
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
