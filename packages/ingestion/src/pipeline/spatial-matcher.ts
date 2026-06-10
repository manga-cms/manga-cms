import type { BoundingBox } from "@manga/domain";

export interface SpatialMatchable {
    id: string;
    bbox?: BoundingBox;
}

export interface SpatialContainer {
    id: string;
    bbox: BoundingBox;
}

/**
 * Checks if a point (px, py) is inside a bounding box.
 */
function isPointInside(px: number, py: number, bbox: BoundingBox): boolean {
    return (
        px >= bbox.x &&
        px <= bbox.x + bbox.width &&
        py >= bbox.y &&
        py <= bbox.y + bbox.height
    );
}

/**
 * Matches a list of items (e.g. Bubbles) to a list of containers (e.g. Panels)
 * based on whether the item's center point falls inside the container's bounding box.
 * 
 * @returns A Map from Item ID to Container ID. If no match is found, the item is not in the map.
 */
export function matchItemsToContainers<TItem extends SpatialMatchable, TContainer extends SpatialContainer>(
    items: TItem[],
    containers: TContainer[]
): Map<string, string> {
    const matches = new Map<string, string>();

    for (const item of items) {
        if (!item.bbox) continue;

        // Calculate center of the item
        const centerX = item.bbox.x + item.bbox.width / 2;
        const centerY = item.bbox.y + item.bbox.height / 2;

        let bestContainer: TContainer | null = null;
        let smallestArea = Infinity;

        // Find the smallest container that contains the item's center
        // (In case of overlapping panels, the smaller one is usually the intended target, or the innermost)
        for (const container of containers) {
            if (isPointInside(centerX, centerY, container.bbox)) {
                const area = container.bbox.width * container.bbox.height;
                if (area < smallestArea) {
                    smallestArea = area;
                    bestContainer = container;
                }
            }
        }

        if (bestContainer) {
            matches.set(item.id, bestContainer.id);
        }
    }

    return matches;
}
