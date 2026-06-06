export function pageIdFromNumber(episodeId: string, pageNumber: number): string {
    return `${episodeId}-p${String(pageNumber).padStart(3, "0")}`;
}

export function panelCandidateId(pageId: string, panelNumber: number): string {
    return `${pageId}-k${String(panelNumber).padStart(3, "0")}`;
}

export function bubbleCandidateId(pageId: string, panelNumber: number, bubbleNumber: number): string {
    return `${pageId}-k${String(panelNumber).padStart(3, "0")}-f${String(bubbleNumber).padStart(3, "0")}`;
}
