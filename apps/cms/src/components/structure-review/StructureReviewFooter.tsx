type StructureReviewFooterProps = {
    saving: boolean;
    onSave: () => void;
    onWorkDetail: () => void;
};

export function StructureReviewFooter({ saving, onSave, onWorkDetail }: StructureReviewFooterProps) {
    return (
        <div className="section-actions">
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "保存中…" : "構造を保存"}
            </button>
            <button type="button" className="btn btn-outline" onClick={onWorkDetail}>
                Work detail
            </button>
        </div>
    );
}
