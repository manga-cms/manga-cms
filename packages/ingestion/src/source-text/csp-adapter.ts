import { normalizeSourceTextRecords } from "./normalizer.js";
import type { SourceTextAdapterSource } from "./normalizer.js";
import type { TextSourceRecord } from "../types/input.js";

/**
 * Parses a Clip Studio Paint "Story Text Export" file (.txt)
 * and groups the text blocks by page number.
 * 
 * Since there is no strict standard marker across all users,
 * this uses a heuristic approach:
 * It looks for lines that resemble "Page X", "ページ X",
 * or are surrounded by `======` dividers.
 */
export function parseCspTextExport(rawText: string, source: SourceTextAdapterSource = "csp_text_export"): Map<number, TextSourceRecord[]> {
    const pageMap = new Map<number, TextSourceRecord[]>();

    // Normalize line endings
    const lines = rawText.replace(/\r\n?/g, "\n").split("\n");

    let currentPageNumber = 1; // Default to page 1 if no markers found
    let currentLines: string[] = [];

    // Heuristic regex to detect page markers like "Page 1", "ページ: 2", "p.003", "- 4 -".
    // CSP export formats vary by locale and user workflow, so this parser is intentionally permissive.
    const pageMarkerRegex = /^(?:={2,}|-{2,})?\s*(?:page|ページ|p\.?)\s*[:：#.-]?\s*([0-9０-９]+)\s*(?:={2,}|-{2,})?$/i;
    const dividerNumberRegex = /^(?:={2,}|-{2,})\s*([0-9０-９]+)\s*(?:={2,}|-{2,})$/;

    const normalizeDigits = (value: string) =>
        value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));

    const parsePageNumber = (value: string) => {
        const parsed = Number.parseInt(normalizeDigits(value), 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    };

    const flushPage = () => {
        if (currentLines.length === 0) return;
        const records = normalizeSourceTextRecords({
            source,
            text: currentLines.join("\n"),
        });
        // Re-map IDs to include page number for uniqueness.
        const pageRecords = records.map((record, index) => ({
            ...record,
            id: `${source}:p${currentPageNumber}:${String(index + 1).padStart(3, "0")}`,
        }));

        const existing = pageMap.get(currentPageNumber) || [];
        pageMap.set(currentPageNumber, [...existing, ...pageRecords]);
        currentLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const markerMatch = line.match(pageMarkerRegex) || line.match(dividerNumberRegex);

        if (markerMatch) {
            flushPage();
            const pageNumber = parsePageNumber(markerMatch[1]);
            if (pageNumber !== null) {
                currentPageNumber = pageNumber;
            }
            continue;
        }

        // Skip empty lines or pure dividers
        if (!line || /^={3,}$/.test(line) || /^-{3,}$/.test(line)) {
            continue;
        }

        currentLines.push(line);
    }

    flushPage();

    return pageMap;
}
