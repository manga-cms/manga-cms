export function clampConfidence(value: number): number {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}

export function isLowConfidence(value: number, threshold = 0.5): boolean {
    return clampConfidence(value) < threshold;
}
