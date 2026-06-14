export interface BubbleTextLayoutLike {
    lines?: string[];
    inlineAlign?: "start" | "center" | "end";
    blockAlign?: "start" | "center" | "end";
    offsetXPercent?: number;
    offsetYPercent?: number;
    source?: "manual" | "imported" | "ocr";
}

export interface BubbleTextStyleLike {
    fontSizePx?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
    fitMode?: "auto" | "shrink" | "fixed";
}

export interface LetteringTextSource {
    text: string;
    textLayout?: BubbleTextLayoutLike;
    textStyle?: BubbleTextStyleLike;
}

export interface LetteringBoundingBox {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export interface LetteringPageSize {
    width?: number;
    height?: number;
}

export interface LetteringFitEstimate {
    characterCount: number;
    estimatedCapacity: number;
    ratio: number;
    scale: number;
}

export interface LetteringRenderResult {
    text: string;
    fitMode: "auto" | "shrink" | "fixed";
    inlineAlign?: "start" | "center" | "end";
    blockAlign?: "start" | "center" | "end";
    offsetXPercent?: number;
    offsetYPercent?: number;
    style: string;
    fit: LetteringFitEstimate;
}

const SOFT_BREAK = "\u200B";

export const normalizeOverlayLanguage = (value: unknown) =>
    String(value ?? "ja").trim().toLowerCase() || "ja";

export const isSourceOverlayLanguage = (language: string) =>
    language === "ja" || language === "ja-jp";

export const displayDirectionForLanguage = (
    canonicalTextDirection: unknown,
    languageInput: string,
): "horizontal" | "vertical" => {
    const language = normalizeOverlayLanguage(languageInput);
    if (isSourceOverlayLanguage(language)) {
        return canonicalTextDirection === "vertical" ? "vertical" : "horizontal";
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

export const sanitizeTextLayout = (value: unknown): BubbleTextLayoutLike | undefined => {
    if (!isRecord(value)) return undefined;
    const lines = Array.isArray(value.lines)
        ? value.lines.filter((line): line is string => typeof line === "string")
        : undefined;
    const inlineAlign = isAlignValue(value.inlineAlign) ? value.inlineAlign : undefined;
    const blockAlign = isAlignValue(value.blockAlign) ? value.blockAlign : undefined;
    const offsetXPercent = numberInRange(value.offsetXPercent, -100, 100);
    const offsetYPercent = numberInRange(value.offsetYPercent, -100, 100);
    const source = isLayoutSourceValue(value.source) ? value.source : undefined;
    const sanitized: BubbleTextLayoutLike = {
        ...(lines && lines.length > 0 && { lines }),
        ...(inlineAlign && { inlineAlign }),
        ...(blockAlign && { blockAlign }),
        ...(offsetXPercent !== undefined && { offsetXPercent }),
        ...(offsetYPercent !== undefined && { offsetYPercent }),
        ...(source && { source }),
    };
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export const sanitizeTextStyle = (value: unknown): BubbleTextStyleLike | undefined => {
    if (!isRecord(value)) return undefined;
    const fontSizePx = numberInRange(value.fontSizePx, 0.01, 512);
    const fontWeight = numberInRange(value.fontWeight, 100, 900);
    const roundedWeight = fontWeight !== undefined && Number.isInteger(fontWeight) && fontWeight % 100 === 0
        ? fontWeight
        : undefined;
    const lineHeight = numberInRange(value.lineHeight, 0.01, 4);
    const letterSpacing = numberInRange(value.letterSpacing, -64, 64);
    const fitMode = isFitModeValue(value.fitMode) ? value.fitMode : undefined;
    const sanitized: BubbleTextStyleLike = {
        ...(fontSizePx !== undefined && { fontSizePx }),
        ...(roundedWeight !== undefined && { fontWeight: roundedWeight }),
        ...(lineHeight !== undefined && { lineHeight }),
        ...(letterSpacing !== undefined && { letterSpacing }),
        ...(fitMode && { fitMode }),
    };
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export const resolvedFitMode = (style: BubbleTextStyleLike | undefined): "auto" | "shrink" | "fixed" => {
    if (!style) return "auto";
    const requested = style.fitMode ?? (style.fontSizePx != null ? "shrink" : "auto");
    if ((requested === "shrink" || requested === "fixed") && style.fontSizePx == null) {
        return "auto";
    }
    return requested;
};

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

export const insertJapaneseSoftBreaks = (text: string) =>
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

export const renderTextForLettering = (
    source: LetteringTextSource,
    options: { addJapaneseSoftBreaks: boolean; spaceAsBreak: boolean },
) => {
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

const pct = (value: number, total: number) =>
    `${((value / Math.max(total, 1)) * 100).toFixed(4)}%`;

export const countFitCharacters = (text: string) =>
    Array.from(text.replace(/[\s\u200B]+/g, "")).length;

export const estimateLetteringCapacity = (
    bbox: LetteringBoundingBox,
    direction: "horizontal" | "vertical",
    pageWidth: number,
) => {
    const width = Math.max(1, Number(bbox.width ?? 1));
    const height = Math.max(1, Number(bbox.height ?? 1));
    // Canonical bbox coordinates are page-pixel based. Match the CMS fit
    // heuristic's 1200px baseline until per-font metrics are available.
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

export const estimateLetteringFit = (input: {
    text: string;
    bbox: LetteringBoundingBox;
    displayDirection: "horizontal" | "vertical";
    pageWidth: number;
}): LetteringFitEstimate => {
    const direction = input.displayDirection;
    const characterCount = countFitCharacters(input.text);
    const estimatedCapacity = estimateLetteringCapacity(input.bbox, direction, input.pageWidth);
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

export const buildLetteringStyle = (input: {
    bbox: LetteringBoundingBox;
    page: LetteringPageSize;
    text: string;
    displayDirection: "horizontal" | "vertical";
    textLayout?: BubbleTextLayoutLike;
    textStyle?: BubbleTextStyleLike;
    fitMode?: "auto" | "shrink" | "fixed";
}) => {
    const pageWidth = Number(input.page.width ?? 1200);
    const pageHeight = Number(input.page.height ?? 1);
    const bbox = input.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
    const fitMode = input.fitMode ?? resolvedFitMode(input.textStyle);
    const offsetX = Number(input.bbox.width ?? 0) * Number(input.textLayout?.offsetXPercent ?? 0) / 100;
    const offsetY = Number(input.bbox.height ?? 0) * Number(input.textLayout?.offsetYPercent ?? 0) / 100;
    const fit = estimateLetteringFit({
        text: input.text,
        bbox,
        displayDirection: input.displayDirection,
        pageWidth,
    });
    const initialFit = fitMode === "auto" ? fit.scale : 1;
    return {
        style: [
            `left:${pct(Number(bbox.x ?? 0), pageWidth)}`,
            `top:${pct(Number(bbox.y ?? 0), pageHeight)}`,
            `width:${pct(Number(bbox.width ?? 0), pageWidth)}`,
            `height:${pct(Number(bbox.height ?? 0), pageHeight)}`,
            `--overlay-fit:${initialFit.toFixed(4)}`,
            `--overlay-manual-offset-x:${styleNumberToCqw(offsetX, pageWidth)}`,
            `--overlay-manual-offset-y:${styleNumberToCqw(offsetY, pageWidth)}`,
            ...(input.textStyle?.fontSizePx !== undefined ? [`--overlay-manual-font-size:${styleNumberToCqw(input.textStyle.fontSizePx, pageWidth)}`] : []),
            ...(input.textStyle?.fontWeight !== undefined ? [`--overlay-font-weight:${input.textStyle.fontWeight}`] : []),
            ...(input.textStyle?.lineHeight !== undefined ? [`--overlay-line-height:${input.textStyle.lineHeight}`] : []),
            ...(input.textStyle?.letterSpacing !== undefined ? [`--overlay-letter-spacing:${styleNumberToCqw(input.textStyle.letterSpacing, pageWidth)}`] : []),
        ].join(";"),
        fit,
    };
};

export const buildLetteringRender = (input: {
    source: LetteringTextSource;
    bbox: LetteringBoundingBox;
    page: LetteringPageSize;
    displayDirection: "horizontal" | "vertical";
    addJapaneseSoftBreaks: boolean;
    spaceAsBreak: boolean;
}): LetteringRenderResult => {
    const textStyle = sanitizeTextStyle(input.source.textStyle);
    const textLayout = sanitizeTextLayout(input.source.textLayout);
    const source = { ...input.source, textLayout, textStyle };
    const fitMode = resolvedFitMode(textStyle);
    const text = renderTextForLettering(source, {
        addJapaneseSoftBreaks: input.addJapaneseSoftBreaks,
        spaceAsBreak: input.spaceAsBreak,
    });
    const { style, fit } = buildLetteringStyle({
        bbox: input.bbox,
        page: input.page,
        text,
        displayDirection: input.displayDirection,
        textLayout,
        textStyle,
        fitMode,
    });
    return {
        text,
        fitMode,
        inlineAlign: textLayout?.inlineAlign,
        blockAlign: textLayout?.blockAlign,
        offsetXPercent: textLayout?.offsetXPercent,
        offsetYPercent: textLayout?.offsetYPercent,
        style,
        fit,
    };
};
