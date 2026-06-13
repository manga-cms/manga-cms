import type {
    TranslationProvider,
    TranslationProviderInput,
    TranslationProviderOutput,
} from "./types.js";

function sourceTextForBubble(input: TranslationProviderInput, bubbleId: string): string {
    const bubbles = input.script.panels
        .flatMap((panel) => panel.bubbles)
        .concat(input.script.pageLevelBubbles);
    return bubbles.find((bubble) => bubble.bubbleId === bubbleId)?.sourceText ?? bubbleId;
}

export class FixtureTranslationProvider implements TranslationProvider {
    readonly providerId = "fixture";
    readonly model = "fixture-deterministic";
    readonly promptVersion = "translation-page-v1";

    async translatePage(input: TranslationProviderInput): Promise<TranslationProviderOutput> {
        const generatedAt = new Date().toISOString();
        return {
            providerId: this.providerId,
            model: this.model,
            promptVersion: input.script.promptVersion || this.promptVersion,
            diagnostics: [{
                level: "info",
                code: "FIXTURE_TRANSLATION_PROVIDER",
                message: "Fixture provider generated deterministic test translations. Do not use as a real translation provider.",
            }],
            generatedAt,
            translations: input.script.bubbleOrder.map((bubbleId) => ({
                bubbleId,
                text: `[${input.script.targetLocale}] ${sourceTextForBubble(input, bubbleId)}`,
                confidence: 0.5,
            })),
        };
    }
}
