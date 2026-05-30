import type { BoundingBox, PageData, PanelData } from "../../api";
import { clampBox } from "./geometry";
import { makePanelId } from "./ids";
import type { PanelTemplate } from "./types";

function templateBox(page: PageData, x: number, y: number, width: number, height: number): BoundingBox {
    return clampBox({
        x: Math.round(page.width * x),
        y: Math.round(page.height * y),
        width: Math.round(page.width * width),
        height: Math.round(page.height * height),
    }, page);
}

function makeTemplatePanel(page: PageData, panelNumber: number, bbox: BoundingBox): PanelData {
    return {
        id: makePanelId(page, panelNumber),
        panelNumber,
        bbox,
        reactionTags: [],
        bubbles: [],
    };
}

export function buildTemplatePanels(page: PageData, template: PanelTemplate): PanelData[] {
    const boxesByReadingOrder: Record<PanelTemplate, BoundingBox[]> = {
        // Japanese reading order: right panel first, then left panel.
        "two-one-two": [
            templateBox(page, 0.52, 0.06, 0.42, 0.23),
            templateBox(page, 0.06, 0.06, 0.42, 0.23),
            templateBox(page, 0.06, 0.32, 0.88, 0.28),
            templateBox(page, 0.52, 0.63, 0.42, 0.30),
            templateBox(page, 0.06, 0.63, 0.42, 0.30),
        ],
        "one-one-two": [
            templateBox(page, 0.06, 0.06, 0.88, 0.28),
            templateBox(page, 0.06, 0.37, 0.88, 0.27),
            templateBox(page, 0.52, 0.67, 0.42, 0.27),
            templateBox(page, 0.06, 0.67, 0.42, 0.27),
        ],
        "three-rows": [
            templateBox(page, 0.06, 0.06, 0.88, 0.28),
            templateBox(page, 0.06, 0.37, 0.88, 0.27),
            templateBox(page, 0.06, 0.67, 0.88, 0.27),
        ],
        "six-plus-wide": [
            templateBox(page, 0.69, 0.06, 0.25, 0.28),
            templateBox(page, 0.375, 0.06, 0.25, 0.28),
            templateBox(page, 0.06, 0.06, 0.25, 0.28),
            templateBox(page, 0.69, 0.37, 0.25, 0.27),
            templateBox(page, 0.375, 0.37, 0.25, 0.27),
            templateBox(page, 0.06, 0.37, 0.25, 0.27),
            templateBox(page, 0.06, 0.67, 0.88, 0.27),
        ],
    };

    return boxesByReadingOrder[template].map((bbox, index) => makeTemplatePanel(page, index + 1, bbox));
}
