import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { ImportedBubbleDraft, PageImportResult } from "@manga/domain";
import { PageImportResultSchema } from "@manga/schemas";
import { buildImportedBubbleStableRef } from "./stable-ref.js";

interface WebtoonPsdModule {
    default?: WebtoonPsdConstructor;
    Psd?: WebtoonPsdConstructor;
}

interface WebtoonPsdConstructor {
    parse(buffer: ArrayBuffer): WebtoonPsdDocument;
}

type WebtoonPsdNode = WebtoonPsdDocument | WebtoonPsdGroup | WebtoonPsdLayer;

interface WebtoonPsdDocument {
    type: "Psd";
    name: string;
    width: number;
    height: number;
    children: WebtoonPsdNode[];
}

interface WebtoonPsdGroup {
    type: "Group";
    name: string;
    children: WebtoonPsdNode[];
}

interface WebtoonPsdLayer {
    type: "Layer";
    name: string;
    width: number;
    height: number;
    top: number;
    left: number;
    isHidden: boolean;
    text?: string;
    additionalProperties?: {
        lyid?: { value?: number };
    };
}

export interface ParsePsdTextLayerDraftsInput {
    sourceFile: string;
    pageNumber?: number;
    displayRef?: string;
}

const importDynamic = new Function("specifier", "return import(specifier)") as (
    specifier: string,
) => Promise<WebtoonPsdModule>;

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    return copy.buffer;
}

function normalizeLayerText(text: string | undefined): string {
    return (text ?? "").replace(/\r\n?/g, "\n").trim();
}

function layerBounds(layer: WebtoonPsdLayer): ImportedBubbleDraft["bbox"] | undefined {
    if (layer.width <= 0 || layer.height <= 0) return undefined;
    return {
        x: layer.left,
        y: layer.top,
        width: layer.width,
        height: layer.height,
    };
}

function sourceLayerId(layer: WebtoonPsdLayer): string | undefined {
    const value = layer.additionalProperties?.lyid?.value;
    return typeof value === "number" ? String(value) : undefined;
}

function collectTextLayers(node: WebtoonPsdNode, sourceFile: string, groupPath: string[]): ImportedBubbleDraft[] {
    if (node.type === "Psd") {
        return node.children.flatMap((child) => collectTextLayers(child, sourceFile, groupPath));
    }

    if (node.type === "Group") {
        const nextPath = node.name ? [...groupPath, node.name] : groupPath;
        return node.children.flatMap((child) => collectTextLayers(child, sourceFile, nextPath));
    }

    const textOriginal = normalizeLayerText(node.text);
    if (!textOriginal) return [];

    const bbox = layerBounds(node);
    const layerId = sourceLayerId(node);
    return [
        {
            stableRef: buildImportedBubbleStableRef({
                sourceFile,
                groupPath,
                layerName: node.name,
                textOriginal,
                bbox,
                sourceLayerId: layerId,
            }),
            source: "psd_text_layer",
            textOriginal,
            layerName: node.name,
            groupPath,
            visible: !node.isHidden,
            ...(bbox && { bbox }),
            ...(layerId && { sourceLayerId: layerId }),
            bubbleType: "speech",
            speakerConfidence: "unknown",
            notes: ["Imported from a PSD/PSB text layer; reviewer must confirm panel, bubble type, bbox, and speaker."],
        },
    ];
}

export async function parsePsdTextLayerDrafts(
    input: ParsePsdTextLayerDraftsInput,
): Promise<PageImportResult> {
    const psdModule = await importDynamic("@webtoon/psd");
    const Psd = psdModule.Psd ?? psdModule.default;
    if (!Psd) {
        throw new Error("@webtoon/psd did not expose Psd.parse");
    }

    const buffer = await readFile(input.sourceFile);
    const psd = Psd.parse(toArrayBuffer(buffer));
    const bubbles = collectTextLayers(psd, input.sourceFile, []);
    const result: PageImportResult = {
        sourceFile: input.sourceFile,
        parser: "@webtoon/psd",
        parserVersion: "0.4.0",
        ...(input.pageNumber !== undefined && { pageNumber: input.pageNumber }),
        ...(input.displayRef !== undefined && { displayRef: input.displayRef }),
        width: psd.width,
        height: psd.height,
        bubbles,
        warnings: bubbles.length === 0 ? [`No text layers found in ${basename(input.sourceFile)}`] : [],
        unsupported: [
            "Panel extraction is intentionally not attempted.",
            "OCR, VLM, OpenCV, and CLIP parsing are intentionally not attempted.",
            "Group visibility is not exposed by the @webtoon/psd typed node API; layer visibility is captured.",
        ],
    };

    return PageImportResultSchema.parse(result);
}
