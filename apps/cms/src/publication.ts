import type { PublicationVisibility } from "./api";

export interface PublicationFormState {
    visibility: PublicationVisibility;
    publishStartAt: string;
    publishEndAt: string;
}

export function toLocalDateTimeInput(value?: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromLocalDateTimeInput(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
}

export function publicationInputPayload(state: PublicationFormState) {
    return {
        visibility: state.visibility,
        publishStartAt: fromLocalDateTimeInput(state.publishStartAt),
        publishEndAt: fromLocalDateTimeInput(state.publishEndAt),
    };
}

export function getPublicationState(input: {
    visibility?: PublicationVisibility;
    publishStartAt?: string;
    publishEndAt?: string;
}, now = new Date()): "public" | "hidden" | "archived" | "scheduled" | "expired" {
    if (input.visibility === "hidden") return "hidden";
    if (input.visibility === "archived") return "archived";

    const nowMs = now.getTime();
    if (input.publishStartAt) {
        const startMs = Date.parse(input.publishStartAt);
        if (!Number.isNaN(startMs) && nowMs < startMs) return "scheduled";
    }
    if (input.publishEndAt) {
        const endMs = Date.parse(input.publishEndAt);
        if (!Number.isNaN(endMs) && nowMs >= endMs) return "expired";
    }
    return "public";
}

export function formatPublicationDate(value?: string): string {
    if (!value) return "not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}
