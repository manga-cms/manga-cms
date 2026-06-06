import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface LegacyBubble {
    id?: string;
    bubbleId?: string;
    panelId?: string | null;
    shortId?: string;
    displayRef?: string;
    stableRef?: string;
    bbox?: Record<string, unknown>;
    [key: string]: unknown;
}

interface LegacyPanel {
    id?: string;
    panelId?: string;
    stableRef?: string;
    bbox?: Record<string, unknown>;
    bubbles?: LegacyBubble[];
    [key: string]: unknown;
}

interface LegacyPage {
    id?: string;
    pageId?: string;
    stableRef?: string;
    imageId?: string;
    coordinateSpace?: string;
    bbox?: Record<string, unknown>;
    panels?: LegacyPanel[];
    bubbles?: LegacyBubble[];
    [key: string]: unknown;
}

interface EpisodeFile {
    schemaVersion?: number;
    editionId?: string;
    revisionId?: string;
    pages?: LegacyPage[];
    [key: string]: unknown;
}

function findEpisodeFiles(root: string): string[] {
    if (!existsSync(root)) return [];
    if (statSync(root).isFile()) return root.endsWith("episode.json") ? [root] : [];
    const files: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) files.push(...findEpisodeFiles(path));
        if (entry.isFile() && entry.name === "episode.json") files.push(path);
    }
    return files;
}

function withPixelBox(box: Record<string, unknown> | undefined, imageId: string): Record<string, unknown> | undefined {
    if (!box) return box;
    return {
        ...box,
        imageId: typeof box.imageId === "string" ? box.imageId : imageId,
        coordinateSpace: typeof box.coordinateSpace === "string" ? box.coordinateSpace : "pixel",
    };
}

function migratePage(page: LegacyPage): LegacyPage {
    const pageId = page.pageId ?? page.id;
    const imageId = page.imageId ?? (pageId ? `${pageId}:image:ja` : undefined);
    const panels = (page.panels ?? []).map((panel) => {
        const panelId = panel.panelId ?? panel.id;
        const { id: _id, bubbles: _bubbles, ...rest } = panel;
        return {
            ...rest,
            ...(panelId ? { panelId, stableRef: panel.stableRef ?? panelId } : {}),
            ...(imageId ? { bbox: withPixelBox(panel.bbox, imageId) } : { bbox: panel.bbox }),
        };
    });
    const liftedBubbles = (page.panels ?? []).flatMap((panel) => {
        const panelId = panel.panelId ?? panel.id ?? null;
        return (panel.bubbles ?? []).map((bubble) => {
            const bubbleId = bubble.bubbleId ?? bubble.id;
            const { id: _id, shortId, ...rest } = bubble;
            return {
                ...rest,
                ...(bubbleId ? { bubbleId, stableRef: bubble.stableRef ?? bubbleId } : {}),
                panelId: bubble.panelId ?? panelId,
                displayRef: bubble.displayRef ?? shortId,
                ...(imageId ? { bbox: withPixelBox(bubble.bbox, imageId) } : { bbox: bubble.bbox }),
            };
        });
    });
    const existingBubbles = (page.bubbles ?? []).map((bubble) => {
        const bubbleId = bubble.bubbleId ?? bubble.id;
        const { id: _id, shortId, ...rest } = bubble;
        return {
            ...rest,
            ...(bubbleId ? { bubbleId, stableRef: bubble.stableRef ?? bubbleId } : {}),
            panelId: bubble.panelId ?? null,
            displayRef: bubble.displayRef ?? shortId,
            ...(imageId ? { bbox: withPixelBox(bubble.bbox, imageId) } : { bbox: bubble.bbox }),
        };
    });
    const {
        id: _id,
        schemaVersion: _schemaVersion,
        pageId: _pageId,
        stableRef: _stableRef,
        imageId: _imageId,
        coordinateSpace: _coordinateSpace,
        panels: _panels,
        bubbles: _bubbles,
        ...restPage
    } = page;
    const bubbles = [...existingBubbles, ...liftedBubbles].map((bubble, index) => ({
        ...bubble,
        bubbleNumber: index + 1,
    }));
    return {
        schemaVersion: 2,
        ...(pageId ? { pageId, stableRef: page.stableRef ?? pageId } : {}),
        ...restPage,
        ...(imageId ? { imageId, coordinateSpace: page.coordinateSpace ?? "pixel" } : {}),
        panels,
        bubbles,
    };
}

function migrateEpisode(episode: EpisodeFile): EpisodeFile {
    const {
        schemaVersion: _schemaVersion,
        editionId: _editionId,
        revisionId: _revisionId,
        pages: _pages,
        ...restEpisode
    } = episode;
    return {
        ...restEpisode,
        schemaVersion: 2,
        editionId: episode.editionId ?? "default",
        revisionId: episode.revisionId ?? "rev-1",
        pages: (episode.pages ?? []).map(migratePage),
    };
}

const root = process.argv[2] ?? "contents";
const shouldWrite = process.argv.includes("--write");
const episodeFiles = findEpisodeFiles(root);

for (const file of episodeFiles) {
    const original = readFileSync(file, "utf-8");
    const migrated = JSON.stringify(migrateEpisode(JSON.parse(original)), null, 2) + "\n";
    if (migrated === original) continue;
    if (shouldWrite) writeFileSync(file, migrated, "utf-8");
    console.log(`${shouldWrite ? "updated" : "would update"} ${file}`);
}

if (!shouldWrite) {
    console.log("dry run only; pass --write to update files");
}
