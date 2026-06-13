import { z } from "zod";

export const TranslationImportSourceFormatSchema = z.enum(["json", "csv"]);
export const TranslationOriginSchema = z.enum(["machine", "human", "imported"]);

const TranslationGeneratedAtSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a parseable date-time",
});

export const TranslationPackDraftImportEntrySchema = z.object({
    bubble_id: z.string().min(1),
    text: z.string().min(1).max(4000).optional(),
    suggested_text: z.string().min(1).max(4000).optional(),
    source_text: z.string().max(4000).optional(),
    current_translation: z.string().max(4000).optional(),
    page_id: z.string().min(1).optional(),
    panel_id: z.string().min(1).nullable().optional(),
    row_number: z.number().int().positive().optional(),
    row_ref: z.string().max(120).optional(),
    comment: z.string().max(2000).optional(),
    translation_origin: TranslationOriginSchema.optional(),
    provider: z.string().min(1).max(120).optional(),
    model: z.string().min(1).max(200).optional(),
    confidence: z.number().min(0).max(1).optional(),
    generated_at: TranslationGeneratedAtSchema.optional(),
}).strict().superRefine((value, ctx) => {
    if (!value.text && !value.suggested_text) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["text"],
            message: "text or suggested_text is required",
        });
    }
});

export const TranslationPackDraftImportInputSchema = z.object({
    series_id: z.string().min(1),
    episode_id: z.string().min(1),
    lang: z.string().min(1).max(16),
    source_format: TranslationImportSourceFormatSchema,
    entries: z.array(TranslationPackDraftImportEntrySchema).min(1),
    apply: z.boolean().default(false).optional(),
}).strict();

export const TranslationImportIssueKindSchema = z.enum([
    "unmatched_bubble",
    "duplicate_bubble",
    "missing_bubble",
    "source_text_mismatch",
    "existing_entry_conflict",
    "invalid_pack_draft",
]);

export const TranslationImportIssueSeveritySchema = z.enum(["error", "warning"]);

export const TranslationImportIssueSchema = z.object({
    kind: TranslationImportIssueKindSchema,
    severity: TranslationImportIssueSeveritySchema,
    bubble_id: z.string().min(1).optional(),
    page_id: z.string().min(1).optional(),
    panel_id: z.string().min(1).nullable().optional(),
    row_number: z.number().int().positive().optional(),
    row_ref: z.string().max(120).optional(),
    message: z.string().min(1),
}).strict();

export const TranslationImportSummarySchema = z.object({
    total_canonical_bubbles: z.number().int().nonnegative(),
    total_import_rows: z.number().int().nonnegative(),
    matched_rows: z.number().int().nonnegative(),
    planned_entries: z.number().int().nonnegative(),
    unmatched_bubbles: z.number().int().nonnegative(),
    duplicate_bubbles: z.number().int().nonnegative(),
    missing_bubbles: z.number().int().nonnegative(),
    existing_entry_conflicts: z.number().int().nonnegative(),
    error_count: z.number().int().nonnegative(),
    warning_count: z.number().int().nonnegative(),
}).strict();

export type TranslationImportSourceFormatData = z.infer<typeof TranslationImportSourceFormatSchema>;
export type TranslationOriginData = z.infer<typeof TranslationOriginSchema>;
export type TranslationPackDraftImportEntryData = z.infer<typeof TranslationPackDraftImportEntrySchema>;
export type TranslationPackDraftImportInputData = z.infer<typeof TranslationPackDraftImportInputSchema>;
export type TranslationImportIssueData = z.infer<typeof TranslationImportIssueSchema>;
export type TranslationImportSummaryData = z.infer<typeof TranslationImportSummarySchema>;
