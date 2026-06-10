import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseSvgPanelDrafts } from "../../dist/svg/svg-panel-parser.js";

describe("SVG Panel Parser", () => {
    test("parses rects into bounding boxes", () => {
        const svg = `
        <svg>
            <rect x="10" y="20" width="100" height="200" />
            <rect x="150" y="20" width="50" height="50" />
        </svg>
        `;

        const panels = parseSvgPanelDrafts(svg);
        assert.equal(panels.length, 2);

        // Sorted correctly (y similar, so right-to-left)
        // panel 2 is at x=150, so it should be first
        assert.equal(panels[0].bbox.x, 150);
        assert.equal(panels[0].bbox.width, 50);

        assert.equal(panels[1].bbox.x, 10);
        assert.equal(panels[1].bbox.width, 100);
    });

    test("parses paths into bounding boxes", () => {
        const svg = `
        <svg>
            <path d="M 10 10 L 110 10 L 110 110 L 10 110 Z" />
            <path d="M 200 10 L 300 10 L 300 110 L 200 110 Z" />
        </svg>
        `;

        const panels = parseSvgPanelDrafts(svg);
        assert.equal(panels.length, 2);

        // Sorted right-to-left
        assert.equal(panels[0].bbox.x, 200);
        assert.equal(panels[0].bbox.width, 100);

        assert.equal(panels[1].bbox.x, 10);
        assert.equal(panels[1].bbox.width, 100);
        assert.equal(panels[1].bbox.height, 100);
    });

    test("parses relative paths and group transforms into bounding boxes", () => {
        const svg = `
        <svg>
            <g transform="translate(100, 50)">
                <path d="m 10 10 h 80 v 40 h -80 z" />
            </g>
            <g transform="scale(2)">
                <rect x="10" y="100" width="20" height="30" />
            </g>
        </svg>
        `;

        const panels = parseSvgPanelDrafts(svg);
        assert.equal(panels.length, 2);

        assert.deepEqual(panels[0].bbox, { x: 110, y: 60, width: 80, height: 40 });
        assert.deepEqual(panels[1].bbox, { x: 20, y: 200, width: 40, height: 60 });
    });

    test("applies rotate transform around an origin", () => {
        const svg = `
        <svg>
            <rect x="0" y="0" width="10" height="20" transform="rotate(90)" />
        </svg>
        `;

        const panels = parseSvgPanelDrafts(svg);
        assert.equal(panels.length, 1);
        assert.equal(Math.round(panels[0].bbox.x), -20);
        assert.equal(Math.round(panels[0].bbox.y), 0);
        assert.equal(Math.round(panels[0].bbox.width), 20);
        assert.equal(Math.round(panels[0].bbox.height), 10);
    });

    test("ignores invalid or empty paths", () => {
        const svg = `
        <svg>
            <path d="M 10" />
            <rect x="0" y="0" width="0" height="0" />
            <path d="invalid data" />
        </svg>
        `;

        const panels = parseSvgPanelDrafts(svg);
        assert.equal(panels.length, 0);
    });

    test("returns an empty list for malformed SVG", () => {
        const panels = parseSvgPanelDrafts("<svg><path");
        assert.equal(panels.length, 0);
    });
});
