import { XMLParser } from "fast-xml-parser";
import type { BoundingBox } from "@manga/domain";

export interface SvgPanelDraft {
    id: string;
    bbox: BoundingBox;
}

type SvgNode = Record<string, unknown>;

interface Matrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function attr(node: SvgNode, name: string): string | undefined {
    const value = node[`@_${name}`];
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function numberAttr(node: SvgNode, name: string, fallback = 0): number {
    const value = attr(node, name);
    if (value === undefined) return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function multiplyMatrix(left: Matrix, right: Matrix): Matrix {
    return {
        a: left.a * right.a + left.c * right.b,
        b: left.b * right.a + left.d * right.b,
        c: left.a * right.c + left.c * right.d,
        d: left.b * right.c + left.d * right.d,
        e: left.a * right.e + left.c * right.f + left.e,
        f: left.b * right.e + left.d * right.f + left.f,
    };
}

function transformPoint(matrix: Matrix, x: number, y: number) {
    return {
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f,
    };
}

function transformBbox(bbox: BoundingBox, matrix: Matrix): BoundingBox {
    const points = [
        transformPoint(matrix, bbox.x, bbox.y),
        transformPoint(matrix, bbox.x + bbox.width, bbox.y),
        transformPoint(matrix, bbox.x, bbox.y + bbox.height),
        transformPoint(matrix, bbox.x + bbox.width, bbox.y + bbox.height),
    ];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function parseNumberList(raw: string): number[] {
    return raw
        .split(/[\s,]+/)
        .map((value) => Number.parseFloat(value))
        .filter(Number.isFinite);
}

function parseTransform(raw: string | undefined): Matrix {
    if (!raw) return IDENTITY;
    let matrix = IDENTITY;
    const transformRegex = /([a-zA-Z]+)\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = transformRegex.exec(raw)) !== null) {
        const [, name, argsRaw] = match;
        const args = parseNumberList(argsRaw);
        let next = IDENTITY;
        if (name === "translate") {
            next = { ...IDENTITY, e: args[0] ?? 0, f: args[1] ?? 0 };
        } else if (name === "scale") {
            const scaleX = args[0] ?? 1;
            const scaleY = args[1] ?? scaleX;
            next = { ...IDENTITY, a: scaleX, d: scaleY };
        } else if (name === "rotate") {
            const angle = ((args[0] ?? 0) * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rotate: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
            if (args.length >= 3) {
                const cx = args[1];
                const cy = args[2];
                next = multiplyMatrix(
                    multiplyMatrix({ ...IDENTITY, e: cx, f: cy }, rotate),
                    { ...IDENTITY, e: -cx, f: -cy },
                );
            } else {
                next = rotate;
            }
        } else if (name === "matrix" && args.length >= 6) {
            next = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        }
        matrix = multiplyMatrix(matrix, next);
    }
    return matrix;
}

function isUsefulBbox(bbox: BoundingBox | null): bbox is BoundingBox {
    return Boolean(bbox && Number.isFinite(bbox.x) && Number.isFinite(bbox.y) && bbox.width > 0 && bbox.height > 0);
}

function extractRectBbox(rect: SvgNode, matrix: Matrix): BoundingBox | null {
    const x = numberAttr(rect, "x");
    const y = numberAttr(rect, "y");
    const width = numberAttr(rect, "width");
    const height = numberAttr(rect, "height");
    if (width <= 0 || height <= 0) return null;
    return transformBbox({ x, y, width, height }, matrix);
}

type PathToken = string | number;

function tokenizePath(path: string): PathToken[] {
    return (path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) ?? []).map((token) => {
        const numeric = Number.parseFloat(token);
        return Number.isFinite(numeric) && !/^[a-zA-Z]$/.test(token) ? numeric : token;
    });
}

function extractPathBbox(path: SvgNode, matrix: Matrix): BoundingBox | null {
    const d = attr(path, "d");
    if (!d) return null;

    const tokens = tokenizePath(d);
    const points: Array<{ x: number; y: number }> = [];
    let command = "";
    let index = 0;
    let currentX = 0;
    let currentY = 0;
    let subpathX = 0;
    let subpathY = 0;

    const hasNumber = () => typeof tokens[index] === "number";
    const readNumber = () => {
        const value = tokens[index];
        if (typeof value !== "number") return null;
        index += 1;
        return value;
    };
    const addPoint = (x: number, y: number) => {
        currentX = x;
        currentY = y;
        points.push(transformPoint(matrix, x, y));
    };
    const addReferencePoint = (x: number, y: number) => {
        points.push(transformPoint(matrix, x, y));
    };
    const readPoint = (relative: boolean) => {
        const x = readNumber();
        const y = readNumber();
        if (x === null || y === null) return false;
        addPoint(relative ? currentX + x : x, relative ? currentY + y : y);
        return true;
    };

    while (index < tokens.length) {
        const token = tokens[index];
        if (typeof token === "string") {
            command = token;
            index += 1;
        }
        if (!command) break;

        const relative = command === command.toLowerCase();
        const upper = command.toUpperCase();

        if (upper === "M") {
            if (!readPoint(relative)) break;
            subpathX = currentX;
            subpathY = currentY;
            while (hasNumber() && readPoint(relative)) {
                // Subsequent moveto pairs are implicit lineto commands.
            }
        } else if (upper === "L" || upper === "T") {
            while (hasNumber() && readPoint(relative)) {
                // Repeat until the next command.
            }
        } else if (upper === "H") {
            while (hasNumber()) {
                const x = readNumber();
                if (x === null) break;
                addPoint(relative ? currentX + x : x, currentY);
            }
        } else if (upper === "V") {
            while (hasNumber()) {
                const y = readNumber();
                if (y === null) break;
                addPoint(currentX, relative ? currentY + y : y);
            }
        } else if (upper === "C") {
            while (hasNumber()) {
                const baseX = currentX;
                const baseY = currentY;
                const values = [readNumber(), readNumber(), readNumber(), readNumber(), readNumber(), readNumber()];
                if (values.some((value) => value === null)) break;
                addReferencePoint(relative ? baseX + values[0]! : values[0]!, relative ? baseY + values[1]! : values[1]!);
                addReferencePoint(relative ? baseX + values[2]! : values[2]!, relative ? baseY + values[3]! : values[3]!);
                addPoint(relative ? baseX + values[4]! : values[4]!, relative ? baseY + values[5]! : values[5]!);
            }
        } else if (upper === "S" || upper === "Q") {
            while (hasNumber()) {
                const baseX = currentX;
                const baseY = currentY;
                const values = [readNumber(), readNumber(), readNumber(), readNumber()];
                if (values.some((value) => value === null)) break;
                addReferencePoint(relative ? baseX + values[0]! : values[0]!, relative ? baseY + values[1]! : values[1]!);
                addPoint(relative ? baseX + values[2]! : values[2]!, relative ? baseY + values[3]! : values[3]!);
            }
        } else if (upper === "A") {
            while (hasNumber()) {
                const values = [readNumber(), readNumber(), readNumber(), readNumber(), readNumber(), readNumber(), readNumber()];
                if (values.some((value) => value === null)) break;
                addPoint(relative ? currentX + values[5]! : values[5]!, relative ? currentY + values[6]! : values[6]!);
            }
        } else if (upper === "Z") {
            addPoint(subpathX, subpathY);
            command = "";
        } else {
            break;
        }
    }

    if (points.length < 2) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

export function parseSvgPanelDrafts(svgContent: string): SvgPanelDraft[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    let parsed: unknown;
    try {
        parsed = parser.parse(svgContent);
    } catch {
        return [];
    }

    const panels: SvgPanelDraft[] = [];

    function addPanel(bbox: BoundingBox | null) {
        if (!isUsefulBbox(bbox)) return;
        panels.push({ id: `panel_${panels.length + 1}`, bbox });
    }

    function traverse(node: unknown, inheritedMatrix: Matrix) {
        if (!node || typeof node !== "object") return;
        const currentNode = node as SvgNode;
        const matrix = multiplyMatrix(inheritedMatrix, parseTransform(attr(currentNode, "transform")));

        const rectValue = currentNode.rect;
        if (rectValue) {
            const rects = Array.isArray(rectValue) ? rectValue : [rectValue];
            for (const rect of rects) {
                if (rect && typeof rect === "object") {
                    const rectNode = rect as SvgNode;
                    addPanel(extractRectBbox(rectNode, multiplyMatrix(matrix, parseTransform(attr(rectNode, "transform")))));
                }
            }
        }

        const pathValue = currentNode.path;
        if (pathValue) {
            const paths = Array.isArray(pathValue) ? pathValue : [pathValue];
            for (const path of paths) {
                if (path && typeof path === "object") {
                    const pathNode = path as SvgNode;
                    addPanel(extractPathBbox(pathNode, multiplyMatrix(matrix, parseTransform(attr(pathNode, "transform")))));
                }
            }
        }

        for (const [key, child] of Object.entries(currentNode)) {
            if (key === "rect" || key === "path" || key.startsWith("@_")) continue;
            if (Array.isArray(child)) {
                child.forEach((entry) => traverse(entry, matrix));
            } else {
                traverse(child, matrix);
            }
        }
    }

    traverse(parsed, IDENTITY);

    // Sort panels top-to-bottom, right-to-left (Japanese manga reading order).
    return panels.sort((a, b) => {
        const yDiff = a.bbox.y - b.bbox.y;
        if (Math.abs(yDiff) > 50) {
            return yDiff;
        }
        return b.bbox.x - a.bbox.x;
    });
}
