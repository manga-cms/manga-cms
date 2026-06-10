import type { InputSourceKind } from "../types/bbox.js";
import type { TextSourceRecord } from "../types/input.js";

export type SourceTextAdapterSource = Extract<
    InputSourceKind,
    "csp_text_export" | "clip_text_export" | "psd_text_export" | "psd_text_layer"
>;

export interface SourceTextLineInput {
    text: string;
    order?: number;
    id?: string;
    layerName?: string;
    sourceLayerId?: string;
    groupPath?: string[];
}

export interface SourceTextNormalizerInput {
    source: SourceTextAdapterSource;
    text?: string;
    lines?: SourceTextLineInput[];
}

export interface SourceTextAdapter {
    readonly source: SourceTextAdapterSource;
    normalize(input: Omit<SourceTextNormalizerInput, "source">): TextSourceRecord[];
}

function normalizeText(value: string): string {
    return value.replace(/\r\n?/g, "\n").trim();
}

function splitPlainText(text: string): SourceTextLineInput[] {
    return normalizeText(text)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
            text: line,
            order: index + 1,
        }));
}

function recordIdFor(source: SourceTextAdapterSource, line: SourceTextLineInput, index: number): string {
    if (line.id?.trim()) return line.id.trim();
    if (line.sourceLayerId?.trim()) return `${source}:${line.sourceLayerId.trim()}`;
    return `${source}:${String(index + 1).padStart(4, "0")}`;
}

export function normalizeSourceTextRecords(input: SourceTextNormalizerInput): TextSourceRecord[] {
    const lines = input.lines?.length ? input.lines : input.text ? splitPlainText(input.text) : [];
    return lines
        .map((line, index): TextSourceRecord | null => {
            const text = normalizeText(line.text);
            if (!text) return null;
            return {
                id: recordIdFor(input.source, line, index),
                source: input.source,
                text,
                order: line.order ?? index + 1,
                layerName: line.layerName,
            };
        })
        .filter((record): record is TextSourceRecord => record !== null);
}

export function createSourceTextAdapter(source: SourceTextAdapterSource): SourceTextAdapter {
    return {
        source,
        normalize(input) {
            return normalizeSourceTextRecords({
                ...input,
                source,
            });
        },
    };
}
