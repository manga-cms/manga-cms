import { z } from "zod";

export const TranslationBatchProviderModeSchema = z.enum(["noop", "fixture"]);

const PageNumbersSchema = z.array(z.number().int().positive()).min(1).max(10).superRefine((value, ctx) => {
    const seen = new Set<number>();
    value.forEach((pageNumber, index) => {
        if (seen.has(pageNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index],
                message: "page_numbers must not contain duplicates",
            });
        }
        seen.add(pageNumber);
    });
});

export const TranslationBatchRunInputSchema = z.object({
    series_id: z.string().min(1),
    episode_id: z.string().min(1),
    lang: z.string().min(1).max(16),
    page_numbers: PageNumbersSchema,
    source_locale: z.string().min(1).max(16).default("ja").optional(),
    provider_mode: TranslationBatchProviderModeSchema.default("noop").optional(),
    apply: z.boolean().default(true).optional(),
}).strict();

export type TranslationBatchProviderModeData = z.infer<typeof TranslationBatchProviderModeSchema>;
export type TranslationBatchRunInputData = z.infer<typeof TranslationBatchRunInputSchema>;
