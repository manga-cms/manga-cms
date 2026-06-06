import { createHash } from "node:crypto";
import type { ImportedBubbleDraft } from "@manga/domain";

export interface ImportedBubbleStableRefInput {
    sourceFile: string;
    groupPath: string[];
    layerName: string;
    textOriginal: string;
    bbox?: ImportedBubbleDraft["bbox"];
    sourceLayerId?: string;
}

export function buildImportedBubbleStableRef(input: ImportedBubbleStableRefInput): string {
    const sourceIdentity = input.sourceLayerId
        ? { sourceFile: input.sourceFile, sourceLayerId: input.sourceLayerId }
        : {
            sourceFile: input.sourceFile,
            groupPath: input.groupPath,
            layerName: input.layerName,
            textOriginal: input.textOriginal,
            bbox: input.bbox,
        };

    return `psd-layer:${createHash("sha256")
        .update(JSON.stringify(sourceIdentity))
        .digest("base64url")
        .slice(0, 20)}`;
}
