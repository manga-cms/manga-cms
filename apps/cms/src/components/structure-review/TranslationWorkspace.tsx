import { useEffect, useMemo, useState } from "react";
import { createProposal, type BubbleData, type PageData, type PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import { getBubbleSourceText } from "../../lib/structure-review/bubbleDraft";
import {
    buildBubbleTranslationContext,
    getBubbleCurrentTranslation,
    makeTranslationProposalDraftInput,
    storeLocalTranslationProposalDraft,
} from "../../lib/structure-review/translationWorkspace";

type TranslationWorkspaceProps = {
    seriesId?: string;
    episodeId?: string;
    page: PageData;
    selectedPanel: PanelData;
    selectedBubble: BubbleData;
};

export function TranslationWorkspace({
    seriesId,
    episodeId,
    page,
    selectedPanel,
    selectedBubble,
}: TranslationWorkspaceProps) {
    const { t } = useTranslation();
    const [suggestedText, setSuggestedText] = useState("");
    const [comment, setComment] = useState("");
    const [submittedMessage, setSubmittedMessage] = useState("");
    const [submitMode, setSubmitMode] = useState<"api" | "local" | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const context = useMemo(() => buildBubbleTranslationContext(page, selectedBubble), [page, selectedBubble]);
    const sourceText = getBubbleSourceText(selectedBubble);
    const currentTranslation = getBubbleCurrentTranslation(selectedBubble);

    useEffect(() => {
        setSuggestedText("");
        setComment("");
        setSubmittedMessage("");
        setSubmitMode(null);
    }, [selectedBubble.id, selectedBubble.bubbleId]);

    const submit = async () => {
        if (!suggestedText.trim()) return;
        const input = makeTranslationProposalDraftInput({
            seriesId,
            episodeId,
            page,
            panel: selectedPanel,
            bubble: selectedBubble,
            suggestedText,
            comment,
        });
        setSubmitting(true);
        setSubmittedMessage("");
        setSubmitMode(null);
        try {
            const proposal = await createProposal(input);
            setSubmitMode("api");
            setSubmittedMessage(t("structure.translation.sentApi", { id: proposal.proposal_id }));
            setSuggestedText("");
            setComment("");
        } catch {
            const draft = storeLocalTranslationProposalDraft(input);
            setSubmitMode("local");
            setSubmittedMessage(t("structure.translation.savedLocal", { id: draft.id }));
            setSuggestedText("");
            setComment("");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="translation-workspace">
            <div className="translation-workspace-header">
                <div>
                    <h3>{t("structure.translation.title")}</h3>
                    <p className="card-meta">
                        {t("structure.translation.description")}
                    </p>
                </div>
                <span className={`badge ${submitMode === "api" ? "badge-ok" : "badge-warn"}`}>
                    {submitMode === "api" ? t("structure.translation.apiConnected") : t("structure.translation.apiFallback")}
                </span>
            </div>

            <div className="form-group">
                <label>{t("structure.translation.source")}</label>
                <textarea readOnly value={sourceText} rows={3} />
            </div>

            <div className="form-group">
                <label>{t("structure.translation.current")}</label>
                <textarea
                    readOnly
                    value={currentTranslation || t("structure.translation.currentMissing")}
                    rows={3}
                />
            </div>

            <div className="translation-context">
                <strong>{t("structure.translation.context")}</strong>
                <div className="translation-context-list">
                    {context.map((item) => (
                        <div key={item.id} className={`translation-context-item ${item.isSelected ? "is-selected" : ""}`}>
                            <span>{item.label}</span>
                            <p>{item.text || t("structure.translation.noSource")}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label>{t("structure.translation.suggestion")}</label>
                <textarea
                    value={suggestedText}
                    onChange={(e) => setSuggestedText(e.target.value)}
                    placeholder={t("structure.translation.suggestionPlaceholder")}
                    rows={4}
                />
            </div>

            <div className="form-group">
                <label>{t("structure.translation.comment")}</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("structure.translation.commentPlaceholder")}
                    rows={3}
                />
            </div>

            <div className="section-actions translation-workspace-actions">
                <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting || !suggestedText.trim()}>
                    {submitting ? t("structure.translation.sending") : t("structure.translation.submit")}
                </button>
                <span className="card-meta">{t("structure.translation.submitHelp")}</span>
            </div>
            {submittedMessage && <div className="success-msg">{submittedMessage}</div>}
        </section>
    );
}
