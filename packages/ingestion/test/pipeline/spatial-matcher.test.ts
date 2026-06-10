import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { matchItemsToContainers } from "../../dist/pipeline/spatial-matcher.js";

describe("Spatial Matcher", () => {
    test("matches items to the correct container based on center point", () => {
        const panels = [
            { id: "panel_1", bbox: { x: 0, y: 0, width: 100, height: 100 } },
            { id: "panel_2", bbox: { x: 100, y: 0, width: 100, height: 100 } }
        ];

        const bubbles = [
            // Center is (50, 50) -> Inside panel 1
            { id: "bubble_1", bbox: { x: 40, y: 40, width: 20, height: 20 } },
            // Center is (150, 50) -> Inside panel 2
            { id: "bubble_2", bbox: { x: 140, y: 40, width: 20, height: 20 } },
            // Center is (50, 200) -> Outside any panel
            { id: "bubble_3", bbox: { x: 40, y: 190, width: 20, height: 20 } }
        ];

        const matches = matchItemsToContainers(bubbles, panels);

        assert.equal(matches.size, 2);
        assert.equal(matches.get("bubble_1"), "panel_1");
        assert.equal(matches.get("bubble_2"), "panel_2");
        assert.equal(matches.get("bubble_3"), undefined);
    });

    test("prefers smaller container if overlapping", () => {
        const panels = [
            { id: "panel_large", bbox: { x: 0, y: 0, width: 200, height: 200 } },
            { id: "panel_small", bbox: { x: 50, y: 50, width: 50, height: 50 } }
        ];

        const bubbles = [
            // Center is (75, 75) -> Inside both, should match panel_small
            { id: "bubble_1", bbox: { x: 70, y: 70, width: 10, height: 10 } },
            // Center is (25, 25) -> Inside only panel_large
            { id: "bubble_2", bbox: { x: 20, y: 20, width: 10, height: 10 } }
        ];

        const matches = matchItemsToContainers(bubbles, panels);

        assert.equal(matches.get("bubble_1"), "panel_small");
        assert.equal(matches.get("bubble_2"), "panel_large");
    });
});
