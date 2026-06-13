import {
    buildTranslationPageScript,
} from "./page-script.js";
import {
    convertValidatedTranslationOutputToImportRows,
    validateTranslationProviderOutput,
} from "./provider-output.js";
import type {
    TranslationBatchPageResult,
    TranslationBatchRunnerInput,
    TranslationBatchRunnerResult,
    TranslationDiagnostic,
} from "./types.js";

function pageIdOf(page: { pageId?: string; id: string }): string {
    return page.pageId ?? page.id;
}

function summarize(pages: TranslationBatchPageResult[]): TranslationBatchRunnerResult["summary"] {
    return {
        requested_pages: pages.length,
        processed_pages: pages.filter((page) => page.skippedReason !== "page_not_found").length,
        applied_pages: pages.filter((page) => page.status === "applied" || page.status === "dry_run").length,
        skipped_pages: pages.filter((page) => page.status === "skipped").length,
        generated_rows: pages.reduce((total, page) => total + page.rowCount, 0),
        error_count: pages.reduce((total, page) =>
            total + page.diagnostics.filter((diagnostic) => diagnostic.level === "error").length
            + page.validationIssues.filter((issue) => issue.severity === "error").length, 0),
        warning_count: pages.reduce((total, page) =>
            total + page.diagnostics.filter((diagnostic) => diagnostic.level === "warning").length
            + page.validationIssues.filter((issue) => issue.severity === "warning").length, 0),
    };
}

function pageNotFound(pageNumber: number): TranslationBatchPageResult {
    return {
        pageId: "",
        pageNumber,
        status: "skipped",
        rowCount: 0,
        diagnostics: [{
            level: "error",
            code: "PAGE_NOT_FOUND",
            message: `Episode does not contain pageNumber ${pageNumber}`,
        }],
        validationIssues: [],
        skippedReason: "page_not_found",
    };
}

function isNoopProviderResult(diagnostics: TranslationDiagnostic[], rowCount: number): boolean {
    return rowCount === 0 && diagnostics.some((diagnostic) => diagnostic.code === "NOOP_TRANSLATION_PROVIDER");
}

export async function runTranslationBatchToImportRows(
    input: TranslationBatchRunnerInput,
): Promise<TranslationBatchRunnerResult> {
    const rows: TranslationBatchRunnerResult["rows"] = [];
    const pages: TranslationBatchPageResult[] = [];
    const pagesByNumber = new Map(input.episode.pages.map((page) => [page.pageNumber, page]));

    for (const pageNumber of input.pageNumbers) {
        const page = pagesByNumber.get(pageNumber);
        if (!page) {
            pages.push(pageNotFound(pageNumber));
            continue;
        }

        const script = buildTranslationPageScript({
            episode: input.episode,
            page,
            sourceLocale: input.sourceLocale,
            targetLocale: input.targetLocale,
            glossary: input.glossary,
            characterVoices: input.characterVoices,
        });
        const output = await input.provider.translatePage({ script });
        const validation = validateTranslationProviderOutput(script.bubbleOrder, output);
        const convertedRows = convertValidatedTranslationOutputToImportRows({ script, output });

        if (isNoopProviderResult(output.diagnostics, convertedRows.length)) {
            pages.push({
                pageId: pageIdOf(page),
                pageNumber,
                status: "skipped",
                rowCount: 0,
                diagnostics: output.diagnostics,
                validationIssues: [],
                skippedReason: "provider_unconfigured",
            });
            continue;
        }

        if (!validation.canConvert) {
            pages.push({
                pageId: pageIdOf(page),
                pageNumber,
                status: "skipped",
                rowCount: 0,
                diagnostics: output.diagnostics,
                validationIssues: validation.issues,
                skippedReason: "provider_validation_failed",
            });
            continue;
        }

        rows.push(...convertedRows);
        pages.push({
            pageId: pageIdOf(page),
            pageNumber,
            status: "applied",
            rowCount: convertedRows.length,
            diagnostics: output.diagnostics,
            validationIssues: validation.issues,
        });
    }

    return {
        rows,
        pages,
        summary: summarize(pages),
    };
}
