import { Link } from "react-router-dom";
import type { EpisodeData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import { TextExportMenu } from "../TextExportMenu";

type StructureReviewHeaderProps = {
    seriesId: string | undefined;
    episodeId: string;
    episode: EpisodeData;
    saving: boolean;
    dirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onRequestLeave: () => boolean;
    onSave: () => void;
};

export function StructureReviewHeader({
    seriesId,
    episodeId,
    episode,
    saving,
    dirty,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onRequestLeave,
    onSave,
}: StructureReviewHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="structure-header">
            <div>
                <h1>{t("structure.title")}</h1>
                <p className="card-meta">{t("structure.header.description", { seriesId, episodeId })}</p>
                <p className="card-meta">{t("structure.header.ingestion")}</p>
                <p className="card-meta">{t("structure.header.sourceTextPolicy")}</p>
            </div>
            <div className="section-actions">
                {dirty && <span className="badge badge-warn">{t("structure.dirty")}</span>}
                <Link
                    to={`/works/${seriesId}/episodes/${episodeId}`}
                    className="btn btn-outline"
                    onClick={(event) => {
                        if (!onRequestLeave()) event.preventDefault();
                    }}
                >
                    {t("structure.episode")}
                </Link>
                <Link
                    to={`/works/${seriesId}/episodes/${episodeId}/translation-import`}
                    className="btn btn-outline"
                    onClick={(event) => {
                        if (!onRequestLeave()) event.preventDefault();
                    }}
                >
                    {t("structure.translation.import")}
                </Link>
                <TextExportMenu seriesId={seriesId} episode={episode} dirty={dirty} />
                <button type="button" className="btn btn-outline" onClick={onUndo} disabled={!canUndo} aria-label={t("structure.undoLabel")}>
                    {t("structure.undo")}
                </button>
                <button type="button" className="btn btn-outline" onClick={onRedo} disabled={!canRedo} aria-label={t("structure.redoLabel")}>
                    {t("structure.redo")}
                </button>
                <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
                    {saving ? t("structure.saving") : t("structure.save")}
                </button>
            </div>
        </div>
    );
}
