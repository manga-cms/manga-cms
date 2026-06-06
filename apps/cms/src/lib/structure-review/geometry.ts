import type { BoundingBox, PageData } from "../../api";

export const MIN_BOX_SIZE = 18;

export function clampBox(box: BoundingBox, page: PageData): BoundingBox {
    const width = Math.max(MIN_BOX_SIZE, Math.min(box.width, page.width));
    const height = Math.max(MIN_BOX_SIZE, Math.min(box.height, page.height));
    return {
        x: Math.max(0, Math.min(box.x, page.width - width)),
        y: Math.max(0, Math.min(box.y, page.height - height)),
        width,
        height,
        imageId: box.imageId ?? page.imageId,
        coordinateSpace: box.coordinateSpace ?? page.coordinateSpace ?? "pixel",
    };
}

export function toBoxStyle(box: BoundingBox, page: PageData) {
    return {
        left: `${(box.x / page.width) * 100}%`,
        top: `${(box.y / page.height) * 100}%`,
        width: `${(box.width / page.width) * 100}%`,
        height: `${(box.height / page.height) * 100}%`,
    };
}
