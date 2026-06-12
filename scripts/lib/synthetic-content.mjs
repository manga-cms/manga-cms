import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

function clampPositiveInt(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

function clampRatio(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
}

function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writePlaceholderPng(path, width, height) {
    const imageWidth = clampPositiveInt(width, 1200);
    const imageHeight = clampPositiveInt(height, 1800);
    const rowLength = imageWidth * 4 + 1;
    const raw = Buffer.alloc(rowLength * imageHeight);

    for (let y = 0; y < imageHeight; y += 1) {
        const rowStart = y * rowLength;
        raw[rowStart] = 0;
        for (let x = 0; x < imageWidth; x += 1) {
            const offset = rowStart + 1 + x * 4;
            const stripe = Math.floor((x / Math.max(1, imageWidth)) * 8) % 2;
            const shade = stripe ? 239 : 248;
            raw[offset] = shade;
            raw[offset + 1] = shade;
            raw[offset + 2] = Math.max(230, shade - 2);
            raw[offset + 3] = 255;
        }
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(imageWidth, 0);
    header.writeUInt32BE(imageHeight, 4);
    header[8] = 8;
    header[9] = 6;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]));
}

export function buildSyntheticSeries(options = {}) {
    const seriesCount = clampPositiveInt(options.seriesCount, 1);
    const episodesPerSeries = clampPositiveInt(options.episodesPerSeries, 1);
    const pagesPerEpisode = clampPositiveInt(options.pagesPerEpisode, 1);
    const panelsPerPage = clampPositiveInt(options.panelsPerPage, 1);
    const bubblesPerPage = clampPositiveInt(options.bubblesPerPage, 1);
    const pageWidth = clampPositiveInt(options.pageWidth, 1200);
    const pageHeight = clampPositiveInt(options.pageHeight, 1800);
    const pageLevelBubbleRatio = clampRatio(options.pageLevelBubbleRatio, 0.25);
    const idPrefix = options.idPrefix ?? "synthetic";
    const includeImages = Boolean(options.includeImages);

    return Array.from({ length: seriesCount }, (_, seriesIndex) => {
        const seriesNumber = seriesIndex + 1;
        const seriesId = seriesCount === 1 ? idPrefix : `${idPrefix}-${String(seriesNumber).padStart(2, "0")}`;
        const episodes = Array.from({ length: episodesPerSeries }, (_episode, episodeIndex) => {
            const episodeNumber = episodeIndex + 1;
            const episodeId = `ep${String(episodeNumber).padStart(2, "0")}`;
            const pages = Array.from({ length: pagesPerEpisode }, (_page, pageIndex) => {
                const pageNumber = pageIndex + 1;
                const pageId = `${seriesId}-${episodeId}-p${String(pageNumber).padStart(2, "0")}`;
                const panels = Array.from({ length: panelsPerPage }, (_panel, panelIndex) => {
                    const panelNumber = panelIndex + 1;
                    const columns = Math.ceil(Math.sqrt(panelsPerPage));
                    const rows = Math.ceil(panelsPerPage / columns);
                    const gap = Math.max(12, Math.round(pageWidth * 0.02));
                    const panelWidth = Math.floor((pageWidth - gap * (columns + 1)) / columns);
                    const panelHeight = Math.floor((pageHeight - gap * (rows + 1)) / rows);
                    const visualColumn = panelIndex % columns;
                    const column = columns - 1 - visualColumn;
                    const row = Math.floor(panelIndex / columns);
                    return {
                        panelId: `${pageId}-panel-${String(panelNumber).padStart(3, "0")}`,
                        panelNumber,
                        displayRef: `p${String(pageNumber).padStart(2, "0")}-k${String(panelNumber).padStart(2, "0")}`,
                        bbox: {
                            x: gap + column * (panelWidth + gap),
                            y: gap + row * (panelHeight + gap),
                            width: panelWidth,
                            height: panelHeight,
                        },
                        reactionTags: panelNumber === 1 ? ["sample"] : [],
                    };
                });
                const pageLevelCount = Math.round(bubblesPerPage * pageLevelBubbleRatio);
                const bubbles = Array.from({ length: bubblesPerPage }, (_bubble, bubbleIndex) => {
                    const bubbleNumber = bubbleIndex + 1;
                    const isPageLevel = bubbleIndex < pageLevelCount;
                    const panel = isPageLevel ? undefined : panels[(bubbleIndex - pageLevelCount) % panels.length];
                    const bubbleWidth = Math.max(60, Math.round(pageWidth * 0.12));
                    const bubbleHeight = Math.max(36, Math.round(pageHeight * 0.04));
                    const x = panel
                        ? panel.bbox.x + Math.min(panel.bbox.width - bubbleWidth, 18 + ((bubbleIndex * 31) % Math.max(1, panel.bbox.width - bubbleWidth)))
                        : pageWidth - bubbleWidth - 24;
                    const y = panel
                        ? panel.bbox.y + Math.min(panel.bbox.height - bubbleHeight, 18 + ((bubbleIndex * 47) % Math.max(1, panel.bbox.height - bubbleHeight)))
                        : 24 + bubbleIndex * (bubbleHeight + 8);
                    return {
                        bubbleId: `${pageId}-bubble-${String(bubbleNumber).padStart(3, "0")}`,
                        panelId: panel?.panelId ?? null,
                        bubbleNumber,
                        displayRef: `p${String(pageNumber).padStart(2, "0")}-f${String(bubbleNumber).padStart(2, "0")}`,
                        bubbleType: isPageLevel ? "caption" : "speech",
                        textOriginal: `Synthetic text ${seriesNumber}-${episodeNumber}-${pageNumber}-${bubbleNumber}`,
                        textDirection: bubbleNumber % 2 === 0 ? "vertical" : "horizontal",
                        bbox: { x, y, width: bubbleWidth, height: bubbleHeight },
                    };
                });
                return {
                    pageId,
                    pageNumber,
                    images: {
                        ja: includeImages ? `pages/p${String(pageNumber).padStart(3, "0")}.png` : "/synthetic/page.png",
                    },
                    width: pageWidth,
                    height: pageHeight,
                    panels,
                    bubbles,
                };
            });
            return {
                schemaVersion: 2,
                id: episodeId,
                episodeNumber,
                title: `Synthetic Episode ${episodeNumber}`,
                publishedAt: "2026-01-01T00:00:00.000Z",
                pages,
            };
        });
        return {
            manifest: {
                id: seriesId,
                title: `Placeholder Demo Content ${seriesNumber}`,
                description: "Placeholder demo content generated for local testing. Replace it with rights-cleared sample manga before public demos.",
                publicationType: episodesPerSeries === 1 ? "oneshot" : "serial",
                lifecycleStatus: "completed",
                status: "completed",
                episodes: episodes.map((episode) => episode.id),
            },
            episodes,
        };
    });
}

export function writeSyntheticContents(dir, options = {}) {
    const seriesList = buildSyntheticSeries(options);
    for (const series of seriesList) {
        const seriesDir = join(dir, series.manifest.id);
        writeJson(join(seriesDir, "series.json"), series.manifest);
        for (const episode of series.episodes) {
            const episodeDir = join(seriesDir, episode.id);
            writeJson(join(episodeDir, "episode.json"), episode);
            if (options.includeImages) {
                for (const page of episode.pages) {
                    const imagePath = page.images.ja;
                    if (typeof imagePath === "string" && !imagePath.startsWith("/")) {
                        writePlaceholderPng(join(episodeDir, imagePath), page.width, page.height);
                    }
                }
            }
        }
    }
    return seriesList;
}

export function buildSyntheticTranslationPack({ packId = "translation-en-synthetic", target } = {}) {
    const targetSeriesId = target?.seriesId ?? "synthetic";
    const targetEpisodeId = target?.episodeId ?? "ep01";
    return {
        id: packId,
        type: "TRANSLATION",
        language: "en",
        version: 1,
        title: "Synthetic translation",
        isPublished: false,
        targetSeriesId,
        targetEpisodeId,
        entries: target ? [
            {
                id: "entry-1",
                target,
                language: "en",
                text: "Synthetic translation",
            },
        ] : [],
    };
}
