import test from "node:test";
import assert from "node:assert/strict";

import {
    AlignmentArtifactSchema,
    BubbleDraftSchema,
    buildCanonicalDraft,
    buildPreparedDirectoryDraft,
    CanonicalDraftPayloadSchema,
    GeminiProvider,
    OCRArtifactSchema,
    PageDraftSchema,
    PanelDraftSchema,
    RegionArtifactSchema,
} from "../dist/index.js";
import type { DraftPayload } from "@manga/domain";
import { createEpisodeInput, createPageInput } from "./fixtures.ts";

test("artifact schemas require metadata, confidence, and provider info", async () => {
    const provider = new GeminiProvider();
    const page = createPageInput();

    const regionArtifact = await provider.detectRegions({ page });
    const alignmentArtifact = await provider.alignText({
        page,
        regionArtifact,
    });
    const ocrArtifacts = regionArtifact.payload.ocrCandidates ?? [];

    assert.ok(regionArtifact.payload.candidates.length > 0);
    assert.ok(alignmentArtifact.payload.alignments.length > 0);
    assert.ok(ocrArtifacts.length > 0);

    for (const artifact of regionArtifact.payload.candidates) {
        const parsed = RegionArtifactSchema.parse(artifact);
        assert.equal(parsed.metadata.provider, "gemini");
        assert.equal(typeof parsed.confidence, "number");
        assert.ok(parsed.metadata.model.length > 0);
    }

    for (const artifact of alignmentArtifact.payload.alignments) {
        const parsed = AlignmentArtifactSchema.parse(artifact);
        assert.equal(parsed.metadata.provider, "gemini");
        assert.equal(typeof parsed.confidence, "number");
        assert.ok(parsed.metadata.model.length > 0);
    }

    for (const artifact of ocrArtifacts) {
        const parsed = OCRArtifactSchema.parse(artifact);
        assert.equal(parsed.metadata.provider, "gemini");
        assert.equal(typeof parsed.confidence, "number");
        assert.ok(parsed.metadata.model.length > 0);
    }
});

test("prepared directory draft keeps source assets outside canonical image path", () => {
    const draft = buildPreparedDirectoryDraft({
        seriesId: "rain-world",
        seriesTitle: "Rain World",
        episodeId: "ep01",
        episodeNumber: 1,
        episodeTitle: "Rain Ruins",
        pages: [
            {
                imagePath: "pages/p001.png",
                sourceImagePath: "job-123/pages/p001.png",
                width: 768,
                height: 1024,
                displayRef: "P1",
            },
        ],
    });

    assert.equal(draft.pages[0]?.imagePath, "pages/p001.png");
    assert.equal(draft.pages[0]?.sourceImagePath, "job-123/pages/p001.png");
    assert.equal(draft.pages[0]?.displayRef, "P1");
    assert.deepEqual(draft.pages[0]?.panels, []);
    assert.doesNotThrow(() => CanonicalDraftPayloadSchema.parse(draft));
});

test("prepared directory draft requires explicit or default page dimensions", () => {
    assert.throws(() => buildPreparedDirectoryDraft({
        seriesId: "rain-world",
        seriesTitle: "Rain World",
        episodeId: "ep01",
        episodeNumber: 1,
        episodeTitle: "Rain Ruins",
        pages: [
            {
                imagePath: "pages/p001.png",
            },
        ],
    }), /page width is required/);
});

test("canonical drafts exclude artifact metadata and confidence while matching DraftPayload", async () => {
    const provider = new GeminiProvider();
    const page = createPageInput();
    const episode = createEpisodeInput({ pages: [page] });

    const regionArtifact = await provider.detectRegions({ page });
    const alignmentArtifact = await provider.alignText({
        page,
        regionArtifact,
    });
    const draftArtifact = await provider.buildDraft({
        page,
        regionArtifact,
        alignmentArtifact,
    });

    const canonical = buildCanonicalDraft(episode, [
        {
            layer: "artifact",
            pageId: page.page.pageId,
            regionDetection: regionArtifact,
            textAlignment: alignmentArtifact,
            draftBuild: draftArtifact,
        },
    ]);

    const parsedDraft = CanonicalDraftPayloadSchema.parse(canonical.draft);
    const typedDraft: DraftPayload = parsedDraft;
    assert.ok(typedDraft.pages.length > 0);

    const firstPage = PageDraftSchema.parse(parsedDraft.pages[0]);
    const firstPanel = PanelDraftSchema.parse(firstPage.panels[0]);
    const firstBubble = BubbleDraftSchema.parse(firstPanel.bubbles[0]);

    assert.equal("confidence" in firstPage, false);
    assert.equal("metadata" in firstPage, false);
    assert.equal("provider" in firstPage, false);
    assert.equal("confidence" in firstPanel, false);
    assert.equal("metadata" in firstPanel, false);
    assert.equal("confidence" in firstBubble, false);
    assert.equal("metadata" in firstBubble, false);
});

test("canonical draft builder assigns panel numbers by RTL reading order", () => {
    const page = createPageInput();
    const episode = createEpisodeInput({ pages: [page] });
    const leftPanelId = `${page.page.pageId}-k001`;
    const rightPanelId = `${page.page.pageId}-k002`;
    const metadata = {
        artifact_version: "test-v1",
        provider: "test",
        model: "fixture",
        created_at: "2026-01-01T00:00:00.000Z",
    };

    const canonical = buildCanonicalDraft(episode, [
        {
            layer: "artifact",
            pageId: page.page.pageId,
            regionDetection: {
                layer: "artifact",
                stage: "detect_regions",
                pageId: page.page.pageId,
                metadata,
                diagnostics: [],
                payload: {
                    candidates: [
                        {
                            artifact_id: leftPanelId,
                            artifact_type: "region",
                            page_id: page.page.pageId,
                            region_kind: "panel",
                            bbox: { x: 0, y: 0, width: 700, height: 900 },
                            confidence: 0.9,
                            source: "page_image",
                            metadata,
                        },
                        {
                            artifact_id: rightPanelId,
                            artifact_type: "region",
                            page_id: page.page.pageId,
                            region_kind: "panel",
                            bbox: { x: 850, y: 0, width: 700, height: 900 },
                            confidence: 0.9,
                            source: "page_image",
                            metadata,
                        },
                    ],
                },
            },
            draftBuild: {
                layer: "artifact",
                stage: "build_draft",
                pageId: page.page.pageId,
                metadata,
                diagnostics: [],
                payload: {
                    pageImagePath: page.page.imagePath,
                    width: page.page.width,
                    height: page.page.height,
                    panels: [
                        {
                            panelCandidateId: leftPanelId,
                            panelConfidence: 0.9,
                            reactionTags: [],
                            bubbles: [],
                        },
                        {
                            panelCandidateId: rightPanelId,
                            panelConfidence: 0.9,
                            reactionTags: [],
                            bubbles: [],
                        },
                    ],
                },
            },
        },
    ]);

    const panels = canonical.draft.pages[0]?.panels ?? [];
    assert.equal(panels[0]?.panelNumber, 1);
    assert.equal(panels[0]?.bbox.x, 850);
    assert.equal(panels[1]?.panelNumber, 2);
    assert.equal(panels[1]?.bbox.x, 0);
});

test("GeminiProvider returns valid artifacts and buildDraft output converts to canonical draft", async () => {
    const provider = new GeminiProvider();
    const page = createPageInput();
    const episode = createEpisodeInput({ pages: [page] });

    const regionArtifact = await provider.detectRegions({ page });
    const alignmentArtifact = await provider.alignText({
        page,
        regionArtifact,
    });
    const draftArtifact = await provider.buildDraft({
        page,
        regionArtifact,
        alignmentArtifact,
    });

    assert.ok(regionArtifact.payload.candidates.length >= 2);
    assert.ok(alignmentArtifact.payload.alignments.length >= 1);
    assert.ok(draftArtifact.payload.panels.length >= 1);

    const canonical = buildCanonicalDraft(episode, [
        {
            layer: "artifact",
            pageId: page.page.pageId,
            regionDetection: regionArtifact,
            textAlignment: alignmentArtifact,
            draftBuild: draftArtifact,
        },
    ]);

    const parsed = CanonicalDraftPayloadSchema.parse(canonical.draft);
    assert.equal(parsed.pages[0]?.pageNumber, 1);
    assert.ok((parsed.pages[0]?.panels.length ?? 0) > 0);
    assert.ok(
        (parsed.pages[0]?.panels[0]?.bbox.x ?? 0) > (parsed.pages[0]?.panels[1]?.bbox.x ?? 0),
        "Gemini fixture should number the right panel first",
    );
});

test("malformed artifact and invalid draft are rejected", async () => {
    assert.throws(
        () =>
            RegionArtifactSchema.parse({
                artifact_id: "bad-region",
                artifact_type: "region",
                page_id: "page-1",
                region_kind: "panel",
                bbox: { x: 0, y: 0, width: 10, height: 10 },
                source: "page_image",
                // missing confidence and metadata
            }),
        /confidence|metadata/,
    );

    assert.throws(
        () =>
            CanonicalDraftPayloadSchema.parse({
                seriesId: "rain-world",
                seriesTitle: "Rain World",
                episodeId: "ep01",
                episodeNumber: 1,
                episodeTitle: "Rain Ruins",
                pages: [
                    {
                        pageNumber: 1,
                        imagePath: "pages/p001.jpg",
                        width: 1600,
                        height: 2400,
                        confidence: 0.9,
                        panels: [],
                    },
                ],
            }),
        /Unrecognized key|confidence/,
    );
});
