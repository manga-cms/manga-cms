import type {
    TranslationProvider,
    TranslationProviderInput,
    TranslationProviderOutput,
} from "./types.js";

export class NoopTranslationProvider implements TranslationProvider {
    readonly providerId = "noop";
    readonly model = "noop";
    readonly promptVersion = "translation-page-v1";

    async translatePage(input: TranslationProviderInput): Promise<TranslationProviderOutput> {
        const generatedAt = new Date().toISOString();
        return {
            providerId: this.providerId,
            model: this.model,
            promptVersion: input.script.promptVersion || this.promptVersion,
            generatedAt,
            diagnostics: [{
                level: "warning",
                code: "NOOP_TRANSLATION_PROVIDER",
                message: "No translation provider is configured. Configure a provider before running machine translation.",
            }],
            translations: [],
        };
    }
}
