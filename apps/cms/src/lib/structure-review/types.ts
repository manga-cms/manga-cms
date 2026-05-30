import type { BoundingBox } from "../../api";

export type DragState = {
    kind: "panel" | "bubble";
    mode: "move" | "resize";
    panelIndex: number;
    bubbleIndex?: number;
    startX: number;
    startY: number;
    startBox: BoundingBox;
};

export type PanelTemplate = "two-one-two" | "one-one-two" | "three-rows" | "six-plus-wide";
export type ReviewDecision = "pending" | "accepted" | "rejected";
export type ReviewDecisions = Record<string, ReviewDecision>;

export type ReviewSummary = Record<ReviewDecision, number>;

export type StructureViewport = {
    zoom: number;
    panX: number;
    panY: number;
    panMode: boolean;
};
