import type { BoundingBox } from "../../api";

export type DragState = {
    kind: "panel" | "bubble";
    mode: "move" | "resize";
    panelIndex: number | null;
    bubbleIndex?: number;
    startX: number;
    startY: number;
    startBox: BoundingBox;
};

export type PanelTemplate = "two-one-two" | "one-one-two" | "three-rows" | "six-plus-wide";

// ReviewDecision is the persisted editor judgment for a Panel/Bubble candidate.
// UI review warnings such as missing speaker or bbox issues are displayed as
// separate "needs review" badges and must not be stored as a decision value.
export type ReviewDecision = "pending" | "accepted" | "rejected";
export type ReviewDecisions = Record<string, ReviewDecision>;

export type ReviewSummary = Record<ReviewDecision, number>;

export type StructureViewport = {
    zoom: number;
    panX: number;
    panY: number;
    panMode: boolean;
};
