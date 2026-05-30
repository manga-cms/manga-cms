import type { EpisodeData, PageData, PanelData } from "../../api";
import type { PanelTemplate, ReviewDecisions, ReviewSummary } from "../../lib/structure-review/types";
import { PanelBubbleLists } from "./PanelBubbleLists";
import { ScriptAssist } from "./ScriptAssist";

type PageStructureSidebarProps = {
    episode: EpisodeData;
    page: PageData | null;
    pageIndex: number;
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    scriptAssistText: string;
    reviewDecisions: ReviewDecisions;
    reviewSummary: ReviewSummary;
    onPageChange: (index: number) => void;
    onPageDisplayRefChange: (displayRef: string) => void;
    onAddPanel: () => void;
    onAddBubble: () => void;
    onApplyPanelTemplate: (template: PanelTemplate) => void;
    onClearPanels: () => void;
    onScriptAssistTextChange: (value: string) => void;
    onApplyScriptAssist: () => void;
    onSelectPanel: (index: number) => void;
    onSelectBubble: (index: number) => void;
    onMovePanel: (index: number, direction: -1 | 1) => void;
    onMoveBubble: (index: number, direction: -1 | 1) => void;
};

export function PageStructureSidebar({
    episode,
    page,
    pageIndex,
    selectedPanel,
    selectedPanelIndex,
    selectedBubbleIndex,
    scriptAssistText,
    reviewDecisions,
    reviewSummary,
    onPageChange,
    onPageDisplayRefChange,
    onAddPanel,
    onAddBubble,
    onApplyPanelTemplate,
    onClearPanels,
    onScriptAssistTextChange,
    onApplyScriptAssist,
    onSelectPanel,
    onSelectBubble,
    onMovePanel,
    onMoveBubble,
}: PageStructureSidebarProps) {
    return (
        <aside className="structure-sidebar card">
            <div className="form-group">
                <label>Page</label>
                <select
                    value={pageIndex}
                    onChange={(e) => onPageChange(Number(e.target.value))}
                >
                    {episode.pages.map((p, i) => (
                        <option key={p.id} value={i}>
                            {p.displayRef ? `${p.displayRef} · ` : ""}Page {p.pageNumber} ({p.panels.length} panels)
                        </option>
                    ))}
                </select>
            </div>

            {page && (
                <div className="form-group">
                    <label>Script display ref</label>
                    <input
                        value={page.displayRef ?? ""}
                        onChange={(e) => onPageDisplayRefChange(e.target.value)}
                        placeholder="P1 / P2-a / P2-b"
                    />
                </div>
            )}

            <div className="review-summary">
                <span className="badge badge-warn">Pending {reviewSummary.pending}</span>
                <span className="badge badge-ok">Accepted {reviewSummary.accepted}</span>
            </div>

            <div className="structure-toolbar">
                <button type="button" className="btn btn-outline" onClick={onAddPanel}>+ Panel</button>
                <button type="button" className="btn btn-outline" onClick={onAddBubble} disabled={selectedPanelIndex === null}>+ Bubble</button>
            </div>

            <h2>Panel Templates</h2>
            <div className="template-grid">
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("two-one-two")}>
                    <strong>2 / 1 / 2</strong>
                    <span>ネーム標準</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("one-one-two")}>
                    <strong>1 / 1 / 2</strong>
                    <span>横長中心</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("three-rows")}>
                    <strong>3 rows</strong>
                    <span>横3段</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("six-plus-wide")}>
                    <strong>3×2 + wide</strong>
                    <span>多コマ</span>
                </button>
            </div>
            <button type="button" className="btn btn-outline danger-lite" onClick={onClearPanels} disabled={!page?.panels.length}>
                Clear structure
            </button>

            <ScriptAssist
                value={scriptAssistText}
                disabled={selectedPanelIndex === null}
                onChange={onScriptAssistTextChange}
                onApply={onApplyScriptAssist}
            />

            <PanelBubbleLists
                panels={page?.panels ?? []}
                selectedPanel={selectedPanel}
                selectedPanelIndex={selectedPanelIndex}
                selectedBubbleIndex={selectedBubbleIndex}
                reviewDecisions={reviewDecisions}
                onSelectPanel={onSelectPanel}
                onSelectBubble={onSelectBubble}
                onMovePanel={onMovePanel}
                onMoveBubble={onMoveBubble}
            />
        </aside>
    );
}
