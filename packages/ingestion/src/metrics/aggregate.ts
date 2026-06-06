import type {
    CostMetric,
    PipelineMetricsSnapshot,
    ReviewTimingMetric,
} from "./types.js";

export function summarizeMetrics(
    reviewMetrics: ReviewTimingMetric[],
    costMetrics: CostMetric[] = [],
): PipelineMetricsSnapshot {
    const pageCount = reviewMetrics.length;
    const averageReviewSeconds =
        pageCount === 0
            ? undefined
            : reviewMetrics.reduce((sum, metric) => sum + metric.reviewSeconds, 0) / pageCount;

    const totalCorrections = reviewMetrics.reduce(
        (sum, metric) => sum + metric.correctedPanels + metric.correctedBubbles,
        0,
    );
    const manualCorrectionRate = pageCount === 0 ? undefined : totalCorrections / pageCount;

    const totalCost = costMetrics.reduce((sum, metric) => sum + (metric.estimatedUsd ?? 0), 0);
    const perPageCostUsd = pageCount === 0 ? undefined : totalCost / pageCount;

    return {
        pageCount,
        averageReviewSeconds,
        manualCorrectionRate,
        perPageCostUsd,
    };
}
