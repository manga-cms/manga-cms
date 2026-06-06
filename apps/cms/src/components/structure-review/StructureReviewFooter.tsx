import { useTranslation } from "../../i18n/I18nProvider";

type StructureReviewFooterProps = {
    saving: boolean;
    onSave: () => void;
    onWorkDetail: () => void;
};

export function StructureReviewFooter({ saving, onSave, onWorkDetail }: StructureReviewFooterProps) {
    const { t } = useTranslation();

    return (
        <div className="section-actions">
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? t("structure.saving") : t("structure.save")}
            </button>
            <button type="button" className="btn btn-outline" onClick={onWorkDetail}>
                {t("structure.workDetail")}
            </button>
        </div>
    );
}
