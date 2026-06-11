import { readFileSync } from "node:fs";

export interface ImageDimensions {
    width: number;
    height: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function u16be(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

function u16le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function u24le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32be(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u32le(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function assertDimensions(dimensions: ImageDimensions, sourceName: string): ImageDimensions {
    if (
        Number.isInteger(dimensions.width) &&
        Number.isInteger(dimensions.height) &&
        dimensions.width > 0 &&
        dimensions.height > 0
    ) {
        return dimensions;
    }
    throw new Error(`Invalid image dimensions in ${sourceName}`);
}

function parsePngDimensions(bytes: Uint8Array, sourceName: string): ImageDimensions | undefined {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !pngSignature.every((value, index) => bytes[index] === value)) return undefined;
    if (ascii(bytes, 12, 4) !== "IHDR") {
        throw new Error(`PNG IHDR chunk not found in ${sourceName}`);
    }
    return assertDimensions({ width: u32be(bytes, 16), height: u32be(bytes, 20) }, sourceName);
}

function parseGifDimensions(bytes: Uint8Array, sourceName: string): ImageDimensions | undefined {
    if (bytes.length < 10) return undefined;
    const header = ascii(bytes, 0, 6);
    if (header !== "GIF87a" && header !== "GIF89a") return undefined;
    return assertDimensions({ width: u16le(bytes, 6), height: u16le(bytes, 8) }, sourceName);
}

function parseWebpDimensions(bytes: Uint8Array, sourceName: string): ImageDimensions | undefined {
    if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return undefined;

    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const chunkType = ascii(bytes, offset, 4);
        const chunkSize = u32le(bytes, offset + 4);
        const payload = offset + 8;
        if (payload + chunkSize > bytes.length) {
            throw new Error(`Truncated WebP chunk in ${sourceName}`);
        }

        if (chunkType === "VP8X") {
            if (chunkSize < 10) throw new Error(`Invalid WebP VP8X chunk in ${sourceName}`);
            return assertDimensions({
                width: u24le(bytes, payload + 4) + 1,
                height: u24le(bytes, payload + 7) + 1,
            }, sourceName);
        }

        if (chunkType === "VP8L") {
            if (chunkSize < 5 || bytes[payload] !== 0x2f) throw new Error(`Invalid WebP VP8L chunk in ${sourceName}`);
            const packed = u32le(bytes, payload + 1);
            return assertDimensions({
                width: (packed & 0x3fff) + 1,
                height: ((packed >> 14) & 0x3fff) + 1,
            }, sourceName);
        }

        if (chunkType === "VP8 ") {
            if (chunkSize < 10 || bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a) {
                throw new Error(`Invalid WebP VP8 chunk in ${sourceName}`);
            }
            return assertDimensions({
                width: u16le(bytes, payload + 6) & 0x3fff,
                height: u16le(bytes, payload + 8) & 0x3fff,
            }, sourceName);
        }

        offset = payload + chunkSize + (chunkSize % 2);
    }

    throw new Error(`WebP image dimensions not found in ${sourceName}`);
}

function isSofMarker(marker: number): boolean {
    return (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
    );
}

function parseJpegDimensions(bytes: Uint8Array, sourceName: string): ImageDimensions | undefined {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;

    let offset = 2;
    while (offset + 4 <= bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) break;

        const marker = bytes[offset];
        offset += 1;

        if (marker === 0xd9 || marker === 0xda) break;
        if (marker >= 0xd0 && marker <= 0xd7) continue;

        if (offset + 2 > bytes.length) throw new Error(`Truncated JPEG segment in ${sourceName}`);
        const segmentLength = u16be(bytes, offset);
        if (segmentLength < 2 || offset + segmentLength > bytes.length) {
            throw new Error(`Invalid JPEG segment length in ${sourceName}`);
        }

        if (isSofMarker(marker)) {
            if (segmentLength < 7) throw new Error(`Invalid JPEG SOF segment in ${sourceName}`);
            return assertDimensions({
                width: u16be(bytes, offset + 5),
                height: u16be(bytes, offset + 3),
            }, sourceName);
        }

        offset += segmentLength;
    }

    throw new Error(`JPEG image dimensions not found in ${sourceName}`);
}

export function parseImageDimensions(bytes: Uint8Array, sourceName = "image"): ImageDimensions {
    const dimensions =
        parsePngDimensions(bytes, sourceName) ??
        parseGifDimensions(bytes, sourceName) ??
        parseWebpDimensions(bytes, sourceName) ??
        parseJpegDimensions(bytes, sourceName);

    if (!dimensions) {
        throw new Error(`Unsupported image format for ${sourceName}`);
    }

    return dimensions;
}

export function readImageDimensionsFromFile(path: string): ImageDimensions {
    return parseImageDimensions(readFileSync(path), path);
}
