import type { BubbleTextLayout, BubbleTextStyle, PublishedPack, PublishedPackEntry } from "./api-client";
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

const normalizeLanguage = (value: unknown) =>
  String(value ?? "ja").trim().toLowerCase() || "ja";

const isSourceOverlayLanguage = (language: string) =>
  language === "ja" || language === "ja-jp";

const displayDirectionForBubble = (bubble: any, language: string): "horizontal" | "vertical" => {
  // Source-locale overlays preserve the canonical lettering direction. Reviewed
  // translations default to horizontal until a future Series/Episode/language
  // override is added.
  if (isSourceOverlayLanguage(language)) {
    return bubble.textDirection === "vertical" ? "vertical" : "horizontal";
  }
  return "horizontal";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAlignValue = (value: unknown): value is "start" | "center" | "end" =>
  value === "start" || value === "center" || value === "end";

const isLayoutSourceValue = (value: unknown): value is "manual" | "imported" | "ocr" =>
  value === "manual" || value === "imported" || value === "ocr";

const isFitModeValue = (value: unknown): value is "auto" | "shrink" | "fixed" =>
  value === "auto" || value === "shrink" || value === "fixed";

const numberInRange = (value: unknown, min: number, max: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : undefined;
};

const sanitizeTextLayout = (value: unknown): BubbleTextLayout | undefined => {
  if (!isRecord(value)) return undefined;
  const lines = Array.isArray(value.lines)
    ? value.lines.filter((line): line is string => typeof line === "string")
    : undefined;
  const inlineAlign = isAlignValue(value.inlineAlign) ? value.inlineAlign : undefined;
  const blockAlign = isAlignValue(value.blockAlign) ? value.blockAlign : undefined;
  const source = isLayoutSourceValue(value.source) ? value.source : undefined;
  const sanitized: BubbleTextLayout = {
    ...(lines && lines.length > 0 && { lines }),
    ...(inlineAlign && { inlineAlign }),
    ...(blockAlign && { blockAlign }),
    ...(source && { source }),
  };
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeTextStyle = (value: unknown): BubbleTextStyle | undefined => {
  if (!isRecord(value)) return undefined;
  const fontSizePx = numberInRange(value.fontSizePx, 0.01, 512);
  const fontWeight = numberInRange(value.fontWeight, 100, 900);
  const roundedWeight = fontWeight !== undefined && Number.isInteger(fontWeight) && fontWeight % 100 === 0
    ? fontWeight
    : undefined;
  const lineHeight = numberInRange(value.lineHeight, 0.01, 4);
  const letterSpacing = numberInRange(value.letterSpacing, -64, 64);
  const fitMode = isFitModeValue(value.fitMode) ? value.fitMode : undefined;
  const sanitized: BubbleTextStyle = {
    ...(fontSizePx !== undefined && { fontSizePx }),
    ...(roundedWeight !== undefined && { fontWeight: roundedWeight }),
    ...(lineHeight !== undefined && { lineHeight }),
    ...(letterSpacing !== undefined && { letterSpacing }),
    ...(fitMode && { fitMode }),
  };
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const resolvedFitMode = (style: BubbleTextStyle | undefined): "auto" | "shrink" | "fixed" => {
  if (!style) return "auto";
  const requested = style.fitMode ?? (style.fontSizePx != null ? "shrink" : "auto");
  if ((requested === "shrink" || requested === "fixed") && style.fontSizePx == null) {
    return "auto";
  }
  return requested;
};

const publishedTranslationForBubble = (packs: PublishedPack[], bubbleId: string, language: string): PublishedPackEntry | undefined => {
  for (const pack of packs) {
    if (!pack.isPublished || pack.type !== "TRANSLATION") continue;
    for (const entry of pack.entries ?? []) {
      const entryLanguage = normalizeLanguage(entry.language ?? pack.language);
      if (entryLanguage !== language) continue;
      if (entry.target?.bubbleId !== bubbleId) continue;
      if (typeof entry.text === "string" && entry.text.trim().length > 0) {
        return entry;
      }
    }
  }
  return undefined;
};

interface OverlayTextSource {
  text: string;
  textLayout?: BubbleTextLayout;
  textStyle?: BubbleTextStyle;
}

const overlayTextForBubble = (bubble: any, packs: PublishedPack[], language: string) => {
  if (language !== "ja") {
    const translated = publishedTranslationForBubble(packs, bubbleIdOf(bubble), language);
    if (translated) {
      return {
        text: translated.text ?? "",
        textLayout: sanitizeTextLayout(translated.textLayout),
        textStyle: sanitizeTextStyle(translated.textStyle),
      };
    }
  }
  return {
    text: bubble.textOriginal,
    textLayout: sanitizeTextLayout(bubble.textLayout),
    textStyle: sanitizeTextStyle(bubble.textStyle),
  };
};

const SOFT_BREAK = "\u200B";

const shouldSoftBreakAfterJapaneseSegment = (
  segment: string,
  nextSegment: string | undefined,
  phraseLength: number,
) => {
  if (!nextSegment) return false;
  if (/^[、。！？!?…]+$/u.test(segment)) return true;
  if (/^[）」』】》〉）]+$/u.test(nextSegment)) return false;
  if (/^[（「『【《〈(]+$/u.test(segment)) return false;
  if (/^(は|が|を|に|へ|で|と|も|の|から|まで|より|には|では|でも|ても)$/u.test(segment)) {
    return phraseLength >= 4;
  }
  if (/^(です|ます|だよ|だね|かい|かな|もの|こと)$/u.test(segment)) return true;
  return phraseLength >= 8;
};

const japaneseWordSegments = (line: string): string[] => {
  const Segmenter = (Intl as any).Segmenter;
  if (typeof Segmenter !== "function") {
    return line.match(/から|まで|より|には|では|でも|ても|[^\s]/gu) ?? [];
  }
  const segmenter = new Segmenter("ja", { granularity: "word" });
  return Array.from(segmenter.segment(line), (part: any) => String(part.segment ?? ""));
};

const insertJapaneseSoftBreaks = (text: string) =>
  text
    .split("\n")
    .map((line) => {
      const segments = japaneseWordSegments(line);
      let phraseLength = 0;
      return segments
        .map((segment, index) => {
          phraseLength += Array.from(segment.replace(/\s+/gu, "")).length;
          const shouldBreak = shouldSoftBreakAfterJapaneseSegment(segment, segments[index + 1], phraseLength);
          if (shouldBreak) {
            phraseLength = 0;
            return `${segment}${SOFT_BREAK}`;
          }
          return segment;
        })
        .join("");
    })
    .join("\n");

const renderTextForOverlay = (source: OverlayTextSource, options: { addJapaneseSoftBreaks: boolean; spaceAsBreak: boolean }) => {
  const layoutLines = source.textLayout?.lines;
  const normalized = (layoutLines && layoutLines.length > 0 ? layoutLines.join("\n") : source.text).replace(/\r\n?/gu, "\n");
  if (layoutLines && layoutLines.length > 0) return normalized;
  if (options.addJapaneseSoftBreaks) return insertJapaneseSoftBreaks(normalized);
  if (!options.spaceAsBreak) return normalized;
  // Display-only source-locale experiment: preserve authored/new review line
  // breaks, but do not reserve ASCII spaces as hard line breaks. Manga source
  // text may use half-width spaces as punctuation, so overlay hard breaks must
  // come from explicit "\n" review text. Natural CSS line breaking and the
  // per-Bubble refitter handle fit without changing canonical textOriginal or
  // published Pack text.
  return normalized;
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

const pct = (value: number, total: number) =>
  `${((value / Math.max(total, 1)) * 100).toFixed(4)}%`;

const countFitCharacters = (text: string) =>
  Array.from(text.replace(/[\s\u200B]+/g, "")).length;

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
  displayDirection: "horizontal" | "vertical";
  pageWidth: number;
}) => {
  const direction = input.displayDirection;
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

const styleNumberToCqw = (value: number, pageWidth: number) =>
  `${((value / Math.max(pageWidth, 1)) * 100).toFixed(4)}cqw`;

const bubbleStyle = (
  bubble: any,
  page: any,
  displayDirection: "horizontal" | "vertical",
  textStyle: BubbleTextStyle | undefined,
  fitMode: "auto" | "shrink" | "fixed",
) => {
  const bbox = bubble.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
  const text = String(bubble.__overlayText ?? bubble.textOriginal ?? "");
  const pageWidth = Number(page.width ?? 1200);
  const fit = estimateOverlayFit({
    text,
    bbox,
    displayDirection,
    pageWidth,
  });
  const initialFit = fitMode === "auto" ? fit.scale : 1;
  return [
    `left:${pct(Number(bbox.x ?? 0), Number(page.width ?? 1))}`,
    `top:${pct(Number(bbox.y ?? 0), Number(page.height ?? 1))}`,
    `width:${pct(Number(bbox.width ?? 0), Number(page.width ?? 1))}`,
    `height:${pct(Number(bbox.height ?? 0), Number(page.height ?? 1))}`,
    `--overlay-fit:${initialFit.toFixed(4)}`,
    ...(textStyle?.fontSizePx !== undefined ? [`--overlay-manual-font-size:${styleNumberToCqw(textStyle.fontSizePx, pageWidth)}`] : []),
    ...(textStyle?.fontWeight !== undefined ? [`--overlay-font-weight:${textStyle.fontWeight}`] : []),
    ...(textStyle?.lineHeight !== undefined ? [`--overlay-line-height:${textStyle.lineHeight}`] : []),
    ...(textStyle?.letterSpacing !== undefined ? [`--overlay-letter-spacing:${styleNumberToCqw(textStyle.letterSpacing, pageWidth)}`] : []),
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
          const displayDirection = displayDirectionForBubble(bubble, language);
          const source = overlayTextForBubble(bubble, packs, language);
          const fitMode = resolvedFitMode(source.textStyle);
          const text = renderTextForOverlay(source, {
            addJapaneseSoftBreaks: isSourceOverlayLanguage(language) && displayDirection === "vertical",
            spaceAsBreak: spaceAsBreak && language === "ja",
          });
          const fit = estimateOverlayFit({
            text,
            bbox: bubble.bbox ?? {},
            displayDirection,
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
            displayDirection,
            text,
            fitMode,
            inlineAlign: source.textLayout?.inlineAlign,
            blockAlign: source.textLayout?.blockAlign,
            bbox: bubble.bbox,
            style: bubbleStyle({ ...bubble, __overlayText: text }, page, displayDirection, source.textStyle, fitMode),
            fit,
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
