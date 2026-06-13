import {
  buildLetteringRender,
  displayDirectionForLanguage,
  isSourceOverlayLanguage,
  normalizeOverlayLanguage,
  type LetteringTextSource,
} from "@manga/lettering";
import type { PublishedPack, PublishedPackEntry } from "./api-client";
import { isSafeReaderImageSrc } from "./episode-reader-data";

export interface OverlayBubble {
  id: string;
  panelId: string | null;
  bubbleNumber: number;
  displayRef?: string;
  speaker?: string | null;
  bubbleType?: string;
  textDirection?: string;
  displayDirection: "horizontal" | "vertical";
  text: string;
  fitMode: "auto" | "shrink" | "fixed";
  inlineAlign?: "start" | "center" | "end";
  blockAlign?: "start" | "center" | "end";
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

const publishedTranslationForBubble = (packs: PublishedPack[], bubbleId: string, language: string): PublishedPackEntry | undefined => {
  for (const pack of packs) {
    if (!pack.isPublished || pack.type !== "TRANSLATION") continue;
    for (const entry of pack.entries ?? []) {
      const entryLanguage = normalizeOverlayLanguage(entry.language ?? pack.language);
      if (entryLanguage !== language) continue;
      if (entry.target?.bubbleId !== bubbleId) continue;
      if (typeof entry.text === "string" && entry.text.trim().length > 0) {
        return entry;
      }
    }
  }
  return undefined;
};

const letteringSourceForBubble = (bubble: any, packs: PublishedPack[], language: string): LetteringTextSource => {
  if (language !== "ja") {
    const translated = publishedTranslationForBubble(packs, bubbleIdOf(bubble), language);
    if (translated) {
      return {
        text: translated.text ?? "",
        textLayout: translated.textLayout,
        textStyle: translated.textStyle,
      };
    }
  }
  return {
    text: bubble.textOriginal,
    textLayout: bubble.textLayout,
    textStyle: bubble.textStyle,
  };
};

const blankImageCandidates = (language: string) => [
  `${language}-blank`,
  `blank-${language}`,
  "blank",
  "ja-blank",
];

const overlayImageSrc = (page: any, language: string) => {
  const images = page?.images ?? {};
  for (const key of blankImageCandidates(language)) {
    const candidate = images[key];
    if (isSafeReaderImageSrc(candidate)) return candidate;
  }
  return null;
};

export const buildTextOverlayPages = (
  pages: any[],
  languageInput: string,
  options: { seriesId?: string; episodeId?: string } = {},
): OverlayPage[] => {
  const language = normalizeOverlayLanguage(languageInput);
  const spaceAsBreak = options.seriesId && options.episodeId
    ? envEnablesSpaceAsBreak(options.seriesId, options.episodeId)
    : false;
  return [...(pages ?? [])]
    .sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0))
    .flatMap((page: any) => {
      const imageSrc = overlayImageSrc(page, language);
      if (!imageSrc) return [];
      const packs = (page.availablePacks ?? []) as PublishedPack[];
      const bubbles = [...(page.bubbles ?? [])]
        .filter(publicBubbleAllowed)
        .sort((a, b) =>
          Number(a.bubbleNumber ?? 0) - Number(b.bubbleNumber ?? 0) ||
          bubbleIdOf(a).localeCompare(bubbleIdOf(b)),
        )
        .map((bubble: any): OverlayBubble => {
          const displayDirection = displayDirectionForLanguage(bubble.textDirection, language);
          const render = buildLetteringRender({
            source: letteringSourceForBubble(bubble, packs, language),
            bbox: bubble.bbox ?? {},
            page: { width: Number(page.width ?? 1200), height: Number(page.height ?? 1) },
            displayDirection,
            addJapaneseSoftBreaks: isSourceOverlayLanguage(language) && displayDirection === "vertical",
            spaceAsBreak: spaceAsBreak && language === "ja",
          });
          return {
            id: bubbleIdOf(bubble),
            panelId: bubble.panelId ?? null,
            bubbleNumber: Number(bubble.bubbleNumber ?? 0),
            displayRef: bubble.displayRef ?? bubble.shortId,
            speaker: bubble.speaker ?? null,
            bubbleType: bubble.bubbleType,
            textDirection: bubble.textDirection,
            displayDirection,
            text: render.text,
            fitMode: render.fitMode,
            inlineAlign: render.inlineAlign,
            blockAlign: render.blockAlign,
            bbox: bubble.bbox,
            style: render.style,
            fit: render.fit,
          };
        });
      return [{
        id: pageIdOf(page),
        pageNumber: Number(page.pageNumber ?? 0),
        imageSrc,
        width: Number(page.width ?? 0),
        height: Number(page.height ?? 0),
        bubbles,
      }];
    });
};
