export interface ReviewTimingMetric {
    pageId: string;
    reviewSeconds: number;
    correctedPanels: number;
    correctedBubbles: number;
}

export interface CostMetric {
    pageId: string;
    promptTokens?: number;
    responseTokens?: number;
    estimatedUsd?: number;
}

export interface PipelineMetricsSnapshot {
    pageCount: number;
    averageReviewSeconds?: number;
    manualCorrectionRate?: number;
    failedPageRate?: number;
    retryRate?: number;
    perPageCostUsd?: number;
}
