import type { PublicationVisibility, SeriesLifecycleStatus, SeriesPublicationType } from "./api";

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

const LIFECYCLE_STATUSES: SeriesLifecycleStatus[] = ["ongoing", "completed", "hiatus"];

export function getSeriesLifecycleStatus(input: {
    lifecycleStatus?: SeriesLifecycleStatus;
    status?: string;
}): SeriesLifecycleStatus {
    if (input.lifecycleStatus && LIFECYCLE_STATUSES.includes(input.lifecycleStatus)) return input.lifecycleStatus;
    if (input.status && LIFECYCLE_STATUSES.includes(input.status as SeriesLifecycleStatus)) {
        return input.status as SeriesLifecycleStatus;
    }
    return "ongoing";
}

export function formatSeriesPublicationType(value?: SeriesPublicationType | string): string {
    switch (value) {
        case "oneshot":
            return "読切";
        case "serial":
        default:
            return "連載";
    }
}

export function formatSeriesLifecycleStatus(value?: SeriesLifecycleStatus | string): string {
    switch (value) {
        case "completed":
            return "完結";
        case "hiatus":
            return "休載";
        case "ongoing":
        default:
            return "連載中";
    }
}
