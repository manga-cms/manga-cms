import test from "node:test";
import assert from "node:assert/strict";

import { parseImageDimensions } from "../dist/index.js";

function png(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    bytes[16] = (width >>> 24) & 0xff;
    bytes[17] = (width >>> 16) & 0xff;
    bytes[18] = (width >>> 8) & 0xff;
    bytes[19] = width & 0xff;
    bytes[20] = (height >>> 24) & 0xff;
    bytes[21] = (height >>> 16) & 0xff;
    bytes[22] = (height >>> 8) & 0xff;
    bytes[23] = height & 0xff;
    return bytes;
}

function gif(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(10);
    bytes.set(Buffer.from("GIF89a", "ascii"), 0);
    bytes[6] = width & 0xff;
    bytes[7] = (width >>> 8) & 0xff;
    bytes[8] = height & 0xff;
    bytes[9] = (height >>> 8) & 0xff;
    return bytes;
}

function webpVp8x(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(30);
    bytes.set(Buffer.from("RIFF", "ascii"), 0);
    bytes.set([0x12, 0x00, 0x00, 0x00], 4);
    bytes.set(Buffer.from("WEBP", "ascii"), 8);
    bytes.set(Buffer.from("VP8X", "ascii"), 12);
    bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
    const widthMinusOne = width - 1;
    const heightMinusOne = height - 1;
    bytes[24] = widthMinusOne & 0xff;
    bytes[25] = (widthMinusOne >>> 8) & 0xff;
    bytes[26] = (widthMinusOne >>> 16) & 0xff;
    bytes[27] = heightMinusOne & 0xff;
    bytes[28] = (heightMinusOne >>> 8) & 0xff;
    bytes[29] = (heightMinusOne >>> 16) & 0xff;
    return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
    return Uint8Array.from([
        0xff, 0xd8,
        0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
        0xff, 0xc0, 0x00, 0x11, 0x08,
        (height >>> 8) & 0xff, height & 0xff,
        (width >>> 8) & 0xff, width & 0xff,
        0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    ]);
}

test("parses PNG image dimensions", () => {
    assert.deepEqual(parseImageDimensions(png(1448, 2048), "page.png"), { width: 1448, height: 2048 });
});

test("parses JPEG image dimensions", () => {
    assert.deepEqual(parseImageDimensions(jpeg(1200, 1800), "page.jpg"), { width: 1200, height: 1800 });
});

test("parses WebP VP8X image dimensions", () => {
    assert.deepEqual(parseImageDimensions(webpVp8x(900, 1300), "page.webp"), { width: 900, height: 1300 });
});

test("parses GIF image dimensions", () => {
    assert.deepEqual(parseImageDimensions(gif(320, 240), "page.gif"), { width: 320, height: 240 });
});

test("rejects unsupported image bytes", () => {
    assert.throws(() => parseImageDimensions(Uint8Array.from([1, 2, 3]), "page.bin"), /Unsupported image format/);
});
