import { isAbsolute } from "node:path";

const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafePathSegment(value: string): boolean {
    return (
        SAFE_PATH_SEGMENT_PATTERN.test(value) &&
        value !== "." &&
        value !== ".." &&
        !value.includes("/") &&
        !value.includes("\\") &&
        !value.includes("\0")
    );
}

export function isSafeRelativeAssetPath(value: string): boolean {
    if (!value || value.includes("\0") || value.includes("\\") || isAbsolute(value)) {
        return false;
    }

    const parts = value.split("/");
    return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}
