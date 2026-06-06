import assert from "node:assert/strict";
import test from "node:test";
import { serializeEpisodeTextToMarkdown, serializeEpisodeTextToTsv } from "./text-export.ts";
import type { EpisodeData } from "../api.ts";

const episode: EpisodeData = {
    id: "ep01",
    episodeNumber: 1,
    title: "Episode One",
    publishedAt: "2026-06-05",
    pages: [
        {
            id: "page-empty",
            pageNumber: 3,
            displayRef: "p03",
            images: {},
            width: 100,
            height: 100,
            panels: [],
            bubbles: [],
        },
        {
            id: "page-main",
            pageNumber: 1,
            displayRef: "p01",
            images: {},
            width: 100,
            height: 100,
            panels: [
                {
                    id: "panel-late",
                    panelNumber: 2,
                    displayRef: "p01-k02",
                    bbox: { x: 0, y: 0, width: 100, height: 50 },
                    reactionTags: [],
                    bubbles: [],
                },
                {
                    id: "panel-first",
                    panelNumber: 1,
                    displayRef: "p01-k01",
                    bbox: { x: 0, y: 50, width: 100, height: 50 },
                    reactionTags: [],
                    bubbles: [],
                },
            ],
            bubbles: [
                {
                    id: "bubble-unknown",
                    panelId: "panel-first",
                    bubbleNumber: 2,
                    displayRef: "p01-k01-f02",
                    shortId: "f02",
                    bubbleType: "speech",
                    speaker: "unknown",
                    textDirection: "vertical",
                    textOriginal: "unknown speaker text",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
                {
                    id: "bubble-speaker-empty",
                    panelId: "panel-first",
                    bubbleNumber: 1,
                    displayRef: "p01-k01-f01",
                    shortId: "f01",
                    bubbleType: "speech",
                    speaker: "uta",
                    textDirection: "vertical",
                    textOriginal: "",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
                {
                    id: "bubble-unresolved",
                    panelId: "missing-panel",
                    bubbleNumber: 3,
                    displayRef: "p01-x-f03",
                    shortId: "f03",
                    bubbleType: "narration",
                    textDirection: "horizontal",
                    textOriginal: "line with\ttab\nbreak",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
                {
                    id: "bubble-null-panel",
                    panelId: null,
                    bubbleNumber: 4,
                    displayRef: "p01-free-f04",
                    shortId: "f04",
                    bubbleType: "caption",
                    speaker: "Narrator",
                    textDirection: "horizontal",
                    textOriginal: "free bubble",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
                {
                    id: "bubble-late",
                    panelId: "panel-late",
                    bubbleNumber: 5,
                    displayRef: "p01-k02-f05",
                    shortId: "f05",
                    bubbleType: "speech",
                    speaker: "hero",
                    textDirection: "vertical",
                    textOriginal: "late panel text",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
            ],
        },
        {
            id: "page-no-number",
            pageNumber: Number.NaN,
            displayRef: "p99",
            images: {},
            width: 100,
            height: 100,
            panels: [],
            bubbles: [
                {
                    id: "bubble-no-order-b",
                    panelId: null,
                    bubbleNumber: Number.NaN,
                    displayRef: "b",
                    bubbleType: "speech",
                    textOriginal: "B",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
                {
                    id: "bubble-no-order-a",
                    panelId: null,
                    bubbleNumber: Number.NaN,
                    displayRef: "a",
                    bubbleType: "speech",
                    textOriginal: "A",
                    bbox: { x: 0, y: 0, width: 10, height: 10 },
                },
            ],
        },
    ],
};

test("serializeEpisodeTextToMarkdown groups by resolved panel and preserves edge cases", () => {
    const markdown = serializeEpisodeTextToMarkdown({ seriesId: "series-a", seriesTitle: "Series A", episode });

    assert.match(markdown, /^# Series A \/ Episode One/);
    assert.match(markdown, /## p01\n\n### p01-k01\n- p01-k01-f01: uta: \[textOriginal未入力\]\n- p01-k01-f02: 「unknown speaker text」/);
    assert.match(markdown, /### p01-k02\n- p01-k02-f05: hero「late panel text」/);
    assert.match(markdown, /### Panel未設定\n- p01-x-f03: 「line with\ttab\nbreak」\n- p01-free-f04: Narrator「free bubble」/);
    assert.match(markdown, /## p03\n\nテキストなし/);
    assert.ok(markdown.indexOf("- a: 「A」") < markdown.indexOf("- b: 「B」"));
});

test("serializeEpisodeTextToTsv emits stable rows and escapes tabs and line breaks", () => {
    const tsv = serializeEpisodeTextToTsv({ seriesId: "series-a", episode });
    const rows = tsv.trimEnd().split("\n");

    assert.equal(rows[0], [
        "series_id",
        "episode_id",
        "page_id",
        "panel_id",
        "bubble_id",
        "page_display_ref",
        "panel_display_ref",
        "bubble_display_ref",
        "bubble_short_id",
        "page_number",
        "panel_number",
        "bubble_number",
        "reading_order",
        "speaker",
        "text_direction",
        "bubble_type",
        "text_original",
    ].join("\t"));
    assert.ok(rows.some((row) => row.includes("bubble-unresolved") && row.includes("line with\\ttab\\nbreak")));
    assert.ok(rows.some((row) => row.includes("bubble-null-panel") && row.includes("\t\tbubble-null-panel\t")));
    assert.ok(rows.findIndex((row) => row.includes("bubble-no-order-a")) < rows.findIndex((row) => row.includes("bubble-no-order-b")));
});
