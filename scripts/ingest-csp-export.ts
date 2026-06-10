import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import {
    matchItemsToContainers,
    parseCspTextExport,
    parsePsdTextLayerDrafts,
    parseSvgPanelDrafts,
} from "../packages/ingestion/dist/index.js";

interface Bbox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface MatchableBubble {
    id: string;
    bbox?: Bbox;
}

interface Args {
    svg?: string;
    text?: string;
    psd?: string;
    bubbles?: string;
    out?: string;
    pageNumber?: number;
}

function usage(): string {
    return [
        "Usage:",
        "  node --experimental-strip-types scripts/ingest-csp-export.ts [options]",
        "",
        "Options:",
        "  --svg <file.svg>       Read CSP/SVG panel frame export and extract panel bbox candidates.",
        "  --text <story.txt>     Read CSP story text export and group text by page markers.",
        "  --psd <file.psd>       Optionally read PSD text layers via @webtoon/psd if installed.",
        "  --bubbles <file.json>  Optional JSON bubble bbox list for spatial matching.",
        "  --page <number>        Page number metadata for PSD output.",
        "  --out <file.json>      Write JSON summary to a file instead of stdout.",
        "",
        "Notes:",
        "  Build ingestion first: pnpm --filter @manga/ingestion build",
        "  Do not commit private CSP/PSD/image/text files or generated summaries from private samples.",
    ].join("\n");
}

function parseArgs(argv: string[]): Args {
    const args: Args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        const value = argv[i + 1];
        if (flag === "--help" || flag === "-h") {
            console.log(usage());
            process.exit(0);
        }
        if (!flag.startsWith("--")) {
            throw new Error(`Unexpected positional argument: ${flag}`);
        }
        if (!value || value.startsWith("--")) {
            throw new Error(`Missing value for ${flag}`);
        }
        i += 1;
        if (flag === "--svg") args.svg = value;
        else if (flag === "--text") args.text = value;
        else if (flag === "--psd") args.psd = value;
        else if (flag === "--bubbles") args.bubbles = value;
        else if (flag === "--out") args.out = value;
        else if (flag === "--page") {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--page must be a positive integer");
            args.pageNumber = parsed;
        } else {
            throw new Error(`Unknown option: ${flag}`);
        }
    }
    if (!args.svg && !args.text && !args.psd) {
        throw new Error("Provide at least one of --svg, --text, or --psd.\n\n" + usage());
    }
    return args;
}

function normalizeBubbleInput(raw: unknown): MatchableBubble[] {
    const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { bubbles?: unknown }).bubbles)
            ? (raw as { bubbles: unknown[] }).bubbles
            : [];
    return list
        .map((item, index): MatchableBubble | null => {
            if (!item || typeof item !== "object") return null;
            const candidate = item as { id?: unknown; bubbleId?: unknown; stableRef?: unknown; bbox?: unknown };
            const id = candidate.id ?? candidate.bubbleId ?? candidate.stableRef ?? `bubble_${index + 1}`;
            const bbox = candidate.bbox as Partial<Bbox> | undefined;
            if (typeof id !== "string" || !bbox) return null;
            if (
                typeof bbox.x !== "number" ||
                typeof bbox.y !== "number" ||
                typeof bbox.width !== "number" ||
                typeof bbox.height !== "number"
            ) {
                return null;
            }
            return { id, bbox: bbox as Bbox };
        })
        .filter((item): item is MatchableBubble => item !== null);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const warnings: string[] = [];
    const output: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        inputs: {
            ...(args.svg && { svg: basename(args.svg) }),
            ...(args.text && { text: basename(args.text) }),
            ...(args.psd && { psd: basename(args.psd) }),
            ...(args.bubbles && { bubbles: basename(args.bubbles) }),
        },
    };

    let panels: ReturnType<typeof parseSvgPanelDrafts> = [];
    if (args.svg) {
        panels = parseSvgPanelDrafts(await readFile(args.svg, "utf8"));
        output.panels = panels;
        if (panels.length === 0) warnings.push("No panel candidates were parsed from the SVG.");
    }

    if (args.text) {
        const textPages = parseCspTextExport(await readFile(args.text, "utf8"));
        output.textPages = Array.from(textPages.entries()).map(([pageNumber, records]) => ({
            pageNumber,
            records,
        }));
        if (textPages.size === 0) warnings.push("No source text records were parsed from the text export.");
    }

    if (args.psd) {
        try {
            output.psd = await parsePsdTextLayerDrafts({
                sourceFile: args.psd,
                ...(args.pageNumber !== undefined && { pageNumber: args.pageNumber }),
            });
        } catch (error) {
            warnings.push(`PSD text-layer parse skipped or failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (args.bubbles) {
        const bubbles = normalizeBubbleInput(JSON.parse(await readFile(args.bubbles, "utf8")));
        output.bubbles = bubbles;
        if (panels.length > 0 && bubbles.length > 0) {
            const matches = matchItemsToContainers(bubbles, panels);
            output.panelMatches = Array.from(matches.entries()).map(([bubbleId, panelId]) => ({ bubbleId, panelId }));
            const unmatched = bubbles.filter((bubble) => !matches.has(bubble.id)).map((bubble) => bubble.id);
            if (unmatched.length > 0) {
                output.unmatchedBubbleIds = unmatched;
                warnings.push(`${unmatched.length} bubble(s) were not contained by any parsed panel bbox.`);
            }
        }
    }

    output.warnings = warnings;
    const json = `${JSON.stringify(output, null, 2)}\n`;
    if (args.out) {
        await writeFile(args.out, json, "utf8");
        console.error(`Wrote ${args.out}`);
    } else {
        process.stdout.write(json);
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
