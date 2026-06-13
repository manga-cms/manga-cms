import type { TranslationPackDraftImportEntryInput } from "@manga/domain";
import type {
    TranslationImportRowConversionInput,
    TranslationProviderOutput,
    TranslationProviderOutputValidation,
    ValidatedTranslation,
} from "./types.js";

function isNonEmpty(value: string | undefined): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export function validateTranslationProviderOutput(
    expectedBubbleIds: string[],
    output: TranslationProviderOutput,
): TranslationProviderOutputValidation {
    const expected = new Set(expectedBubbleIds);
    const outputCounts = new Map<string, number>();
    const issues: TranslationProviderOutputValidation["issues"] = [];

    output.translations.forEach((translation, index) => {
        if (!isNonEmpty(translation.bubbleId) || !isNonEmpty(translation.text)) {
            issues.push({
                kind: "malformed_translation",
                severity: "error",
                bubbleId: translation.bubbleId || undefined,
                message: `Translation output row ${index + 1} must include non-empty bubbleId and text`,
            });
            return;
        }
        outputCounts.set(translation.bubbleId, (outputCounts.get(translation.bubbleId) ?? 0) + 1);
        if (!expected.has(translation.bubbleId)) {
            issues.push({
                kind: "extra_bubble",
                severity: "error",
                bubbleId: translation.bubbleId,
                message: "Provider returned a Bubble ID that was not in the input Page script",
            });
        }
    });

    for (const [bubbleId, count] of outputCounts) {
        if (count > 1) {
            issues.push({
                kind: "duplicate_bubble",
                severity: "error",
                bubbleId,
                message: "Provider returned multiple translations for the same Bubble ID",
            });
        }
    }

    expectedBubbleIds.forEach((bubbleId) => {
        if (!outputCounts.has(bubbleId)) {
            issues.push({
                kind: "missing_bubble",
                severity: "error",
                bubbleId,
                message: "Provider output is missing a translation for an input Bubble ID",
            });
        }
    });

    const duplicateIds = new Set([...outputCounts.entries()].filter(([, count]) => count > 1).map(([bubbleId]) => bubbleId));
    const validTranslations: ValidatedTranslation[] = output.translations
        .filter((translation) =>
            isNonEmpty(translation.bubbleId)
            && isNonEmpty(translation.text)
            && expected.has(translation.bubbleId)
            && !duplicateIds.has(translation.bubbleId),
        )
        .map((translation) => ({
            bubbleId: translation.bubbleId,
            text: translation.text,
            ...(translation.confidence !== undefined && { confidence: translation.confidence }),
        }));

    return {
        canConvert: issues.length === 0,
        issues,
        validTranslations,
    };
}

export function convertValidatedTranslationOutputToImportRows(
    input: TranslationImportRowConversionInput,
): TranslationPackDraftImportEntryInput[] {
    const validation = validateTranslationProviderOutput(input.script.bubbleOrder, input.output);
    if (!validation.canConvert) {
        return [];
    }

    const bubblesById = new Map(input.script.panels
        .flatMap((panel) => panel.bubbles)
        .concat(input.script.pageLevelBubbles)
        .map((bubble) => [bubble.bubbleId, bubble]));
    const translationsById = new Map(validation.validTranslations.map((translation) => [translation.bubbleId, translation]));

    return input.script.bubbleOrder.flatMap((bubbleId) => {
        const bubble = bubblesById.get(bubbleId);
        const translation = translationsById.get(bubbleId);
        if (!bubble || !translation) return [];
        return [{
            bubble_id: bubble.bubbleId,
            page_id: input.script.pageId,
            panel_id: bubble.panelId,
            source_text: bubble.sourceText,
            text: translation.text,
            translation_origin: "machine",
            provider: input.output.providerId,
            model: input.output.model,
            ...(translation.confidence !== undefined && { confidence: translation.confidence }),
            generated_at: input.output.generatedAt,
        }];
    });
}
