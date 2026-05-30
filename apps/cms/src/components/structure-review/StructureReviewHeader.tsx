import { Link } from "react-router-dom";

type StructureReviewHeaderProps = {
    seriesId: string | undefined;
    episodeId: string;
    saving: boolean;
    onSave: () => void;
};

export function StructureReviewHeader({ seriesId, episodeId, saving, onSave }: StructureReviewHeaderProps) {
    return (
        <div className="structure-header">
            <div>
                <h1>Page Structure Review</h1>
                <p className="card-meta">{seriesId} / {episodeId} — panel and bubble structure stays in canonical content only after save.</p>
                <p className="card-meta">Ingestion job candidate decisions are persisted from the Ingestion review screen before canonical draft write.</p>
            </div>
            <div className="section-actions">
                <Link to={`/works/${seriesId}/episodes/${episodeId}`} className="btn btn-outline">Episode</Link>
                <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
                    {saving ? "保存中…" : "構造を保存"}
                </button>
            </div>
        </div>
    );
}

