import type { Bubble, Episode, Page, Panel, TranslationPackDraftImportEntryInput } from "@manga/domain";

export type TranslationDiagnosticLevel = "info" | "warning" | "error";
export type TranslationValidationIssueKind =
    | "missing_bubble"
    | "extra_bubble"
    | "duplicate_bubble"
    | "malformed_translation";

export interface TranslationDiagnostic {
    level: TranslationDiagnosticLevel;
    code: string;
    message: string;
    bubbleId?: string;
}

export interface TranslationGlossaryTerm {
    source: string;
    target: string;
    note?: string;
}

export interface TranslationCharacterVoiceNote {
    speaker: string;
    note: string;
}

export interface TranslationPageScriptBubble {
    bubbleId: string;
    panelId: string | null;
    sourceText: string;
    speaker?: string;
    bubbleType: Bubble["bubbleType"];
    textDirection?: Bubble["textDirection"];
}

export interface TranslationPageScriptPanel {
    panelId: string;
    displayRef?: string;
    bubbles: TranslationPageScriptBubble[];
}

export interface TranslationPageScript {
    episodeId: string;
    pageId: string;
    pageNumber: number;
    sourceLocale: string;
    targetLocale: string;
    promptVersion: string;
    panelOrder: string[];
    bubbleOrder: string[];
    panels: TranslationPageScriptPanel[];
    pageLevelBubbles: TranslationPageScriptBubble[];
    glossary: TranslationGlossaryTerm[];
    characterVoices: TranslationCharacterVoiceNote[];
    text: string;
}

export interface BuildTranslationPageScriptInput {
    episode: Episode;
    page: Page;
    sourceLocale?: string;
    targetLocale: string;
    promptVersion?: string;
    glossary?: TranslationGlossaryTerm[];
    characterVoices?: TranslationCharacterVoiceNote[];
}

export interface TranslationProviderInput {
    script: TranslationPageScript;
}

export interface TranslationProviderTranslation {
    bubbleId: string;
    text: string;
    confidence?: number;
}

export interface TranslationProviderOutput {
    providerId: string;
    model: string;
    promptVersion: string;
    generatedAt: string;
    diagnostics: TranslationDiagnostic[];
    translations: TranslationProviderTranslation[];
}

export interface TranslationProvider {
    readonly providerId: string;
    readonly model: string;
    readonly promptVersion: string;
    translatePage(input: TranslationProviderInput): Promise<TranslationProviderOutput>;
}

export interface TranslationValidationIssue {
    kind: TranslationValidationIssueKind;
    severity: "error" | "warning";
    bubbleId?: string;
    message: string;
}

export interface ValidatedTranslation {
    bubbleId: string;
    text: string;
    confidence?: number;
}

export interface TranslationProviderOutputValidation {
    canConvert: boolean;
    issues: TranslationValidationIssue[];
    validTranslations: ValidatedTranslation[];
}

export interface TranslationImportRowConversionInput {
    script: TranslationPageScript;
    output: TranslationProviderOutput;
}

export type TranslationScriptSource = {
    episode: Episode;
    page: Page;
    panelsById: Map<string, Panel>;
};

export type TranslationBatchPageStatus =
    | "applied"
    | "dry_run"
    | "skipped";

export interface TranslationBatchPageResult {
    pageId: string;
    pageNumber: number;
    status: TranslationBatchPageStatus;
    rowCount: number;
    diagnostics: TranslationDiagnostic[];
    validationIssues: TranslationValidationIssue[];
    skippedReason?: string;
}

export interface TranslationBatchRunnerInput {
    episode: Episode;
    pageNumbers: number[];
    targetLocale: string;
    provider: TranslationProvider;
    sourceLocale?: string;
    glossary?: TranslationGlossaryTerm[];
    characterVoices?: TranslationCharacterVoiceNote[];
}

export interface TranslationBatchRunnerResult {
    rows: TranslationPackDraftImportEntryInput[];
    pages: TranslationBatchPageResult[];
    summary: {
        requested_pages: number;
        processed_pages: number;
        applied_pages: number;
        skipped_pages: number;
        generated_rows: number;
        error_count: number;
        warning_count: number;
    };
}
