export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type RegionKind = "panel" | "bubble" | "text_region";

export type BubbleClassification =
    | "speech"
    | "thought"
    | "narration"
    | "sfx"
    | "unknown";

export type InputSourceKind =
    | "page_image"
    | "clip_text_export"
    | "psd_text_export"
    | "ocr"
    | "manual";
