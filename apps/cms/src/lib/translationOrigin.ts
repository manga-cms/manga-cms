import type { PackDraftEntry, TranslationOrigin, TranslationPackDraftImportEntry } from "../api";

export function translationOriginOfEntry(entry: Pick<TranslationPackDraftImportEntry, "translation_origin"> | PackDraftEntry | undefined): TranslationOrigin {
    if (!entry) return "imported";
    if ("metadata" in entry) return entry.metadata?.translation_origin ?? "imported";
    return entry.translation_origin ?? "imported";
}

export function translationOriginLabel(origin: TranslationOrigin): string {
    switch (origin) {
        case "machine":
            return "機械翻訳・未確認";
        case "human":
            return "人間確認済み";
        case "imported":
            return "imported";
    }
}

export function translationOriginBadgeClass(origin: TranslationOrigin): string {
    switch (origin) {
        case "machine":
            return "badge-warn";
        case "human":
            return "badge-ok";
        case "imported":
            return "";
    }
}
