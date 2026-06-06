import { useTranslation } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import type { StructureChangeField, StructureChangeSummary as StructureChangeSummaryData } from "../../lib/structure-review/changeSummary";

type StructureChangeSummaryProps = {
    summary: StructureChangeSummaryData;
};

const FIELD_LABELS: Record<StructureChangeField, MessageKey> = {
    pageDisplayRef: "structure.changes.field.pageDisplayRef",
    panelAdded: "structure.changes.field.panelAdded",
    panelRemoved: "structure.changes.field.panelRemoved",
    panelBbox: "structure.changes.field.panelBbox",
    panelReadingOrder: "structure.changes.field.panelReadingOrder",
    bubbleAdded: "structure.changes.field.bubbleAdded",
    bubbleRemoved: "structure.changes.field.bubbleRemoved",
    bubbleBbox: "structure.changes.field.bubbleBbox",
    sourceText: "structure.changes.field.sourceText",
    speaker: "structure.changes.field.speaker",
    bubbleType: "structure.changes.field.bubbleType",
    textDirection: "structure.changes.field.textDirection",
    readingOrder: "structure.changes.field.readingOrder",
    reviewDecision: "structure.changes.field.reviewDecision",
};

export function StructureChangeSummary({ summary }: StructureChangeSummaryProps) {
    const { t } = useTranslation();
    const visibleChanges = summary.changes.slice(0, 8);
    const overflowCount = Math.max(0, summary.total - visibleChanges.length);

    return (
        <section className="structure-change-summary card" aria-label={t("structure.changes.title")}>
            <div className="structure-change-summary-header">
                <div>
                    <h2>{t("structure.changes.title")}</h2>
                    <p>{t("structure.changes.description")}</p>
                </div>
                <span className={`badge ${summary.total ? "badge-warn" : "badge-ok"}`}>
                    {t("structure.changes.count", { count: summary.total })}
                </span>
            </div>
            {visibleChanges.length === 0 ? (
                <p className="card-meta">{t("structure.changes.empty")}</p>
            ) : (
                <div className="structure-change-list">
                    {visibleChanges.map((change) => (
                        <div key={change.key} className="structure-change-row">
                            <div>
                                <strong>{change.label}</strong>
                                <span>{t(FIELD_LABELS[change.field])}</span>
                            </div>
                            <small>
                                {change.before !== undefined && <code>{change.before || t("structure.changes.unset")}</code>}
                                {change.before !== undefined || change.after !== undefined ? <span>→</span> : null}
                                {change.after !== undefined && <code>{change.after || t("structure.changes.unset")}</code>}
                            </small>
                        </div>
                    ))}
                    {overflowCount > 0 && (
                        <div className="structure-change-row is-overflow">
                            <strong>{t("structure.changes.more", { count: overflowCount })}</strong>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
