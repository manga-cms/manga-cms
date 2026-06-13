import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    getAdminEpisode,
    getAdminPageImageUrl,
    getReviewCandidates,
    saveEpisode,
    type BoundingBox,
    type BubbleData,
    type EpisodeData,
    type IngestionReviewCandidate,
    type PageData,
    type PanelData,
} from "../api";
import { CanvasOverlayEditor } from "../components/structure-review/CanvasOverlayEditor";
import { PageStructureSidebar } from "../components/structure-review/PageStructureSidebar";
import { StructureChangeSummary } from "../components/structure-review/StructureChangeSummary";
import { StructureInspector } from "../components/structure-review/StructureInspector";
import { StructureReviewFooter } from "../components/structure-review/StructureReviewFooter";
import { StructureReviewHeader } from "../components/structure-review/StructureReviewHeader";
import { useTranslation } from "../i18n/I18nProvider";
import { summarizeStructureChanges } from "../lib/structure-review/changeSummary";
import { moveBubbleByGlobalReadingOrder } from "../lib/structure-review/bubbleOrdering";
import {
    clearAutosave,
    confirmStructureReviewLeave,
    makeAutosaveKey,
    readAutosave,
    serializeSnapshot,
    writeAutosave,
    type StructureReviewSnapshot,
} from "../lib/structure-review/editSafety";
import { clampBox } from "../lib/structure-review/geometry";
import { bubbleIdOf, makeBubbleId, makeBubbleShortId, makePageBubbleId, makePageBubbleShortId, makePanelId, nextBubbleIdNumber, nextPageBubbleIdNumber, nextPanelIdNumber, panelIdOf, renumberPanelBubbles, renumberPanels } from "../lib/structure-review/ids";
import { buildBubbleTextComparisonOverlayMap } from "../lib/structure-review/ingestionOverlay";
import { syncPageBubbles } from "../lib/structure-review/pageBubbles";
import { buildTemplatePanels } from "../lib/structure-review/panelTemplates";
import { applyEstimatedReadingOrder, getPageReviewWarnings } from "../lib/structure-review/readingOrder";
import { bubbleReviewKey, markPanels, panelReviewKey, seedAcceptedDecisions, summarizeReview } from "../lib/structure-review/reviewDecisions";
import { parseScriptAssistLines } from "../lib/structure-review/scriptAssist";
import type { PanelTemplate, ReviewDecisions, StructureViewport } from "../lib/structure-review/types";
import { useStructureReviewDrag } from "../lib/structure-review/useStructureReviewDrag";

const MIN_STRUCTURE_ZOOM = 0.35;
const MAX_STRUCTURE_ZOOM = 3;

type PageStructureReviewProps = {
    currentUser?: { role: string } | null;
};
const MAX_HISTORY_LENGTH = 80;

function clampStructureZoom(zoom: number) {
    return Math.max(MIN_STRUCTURE_ZOOM, Math.min(MAX_STRUCTURE_ZOOM, zoom));
}

function applyBubblePatch(bubble: BubbleData, patch: Partial<BubbleData>): BubbleData {
    const next: BubbleData = { ...bubble, ...patch };
    for (const key of Object.keys(patch) as Array<keyof BubbleData>) {
        if (patch[key] === undefined) {
            delete (next as Partial<BubbleData>)[key];
        }
    }
    return next;
}

export default function PageStructureReview({ currentUser }: PageStructureReviewProps) {
    const { t } = useTranslation();
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const [searchParams] = useSearchParams();
    const nav = useNavigate();
    const stageRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const confirmedNavigationRef = useRef<{ at: number; href?: string } | null>(null);

    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(null);
    const [selectedBubbleIndex, setSelectedBubbleIndex] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [recoveredAt, setRecoveredAt] = useState<string | null>(null);
    const [scriptAssistText, setScriptAssistText] = useState("");
    const [reviewDecisions, setReviewDecisions] = useState<ReviewDecisions>({});
    const [baselineEpisode, setBaselineEpisode] = useState<EpisodeData | null>(null);
    const [baselineReviewDecisions, setBaselineReviewDecisions] = useState<ReviewDecisions>({});
    const [undoStack, setUndoStack] = useState<StructureReviewSnapshot[]>([]);
    const [redoStack, setRedoStack] = useState<StructureReviewSnapshot[]>([]);
    const [reviewCandidates, setReviewCandidates] = useState<IngestionReviewCandidate[]>([]);
    const [reviewCandidateError, setReviewCandidateError] = useState("");
    const [structureViewport, setStructureViewport] = useState<StructureViewport>({
        zoom: 1,
        panX: 0,
        panY: 0,
        panMode: false,
    });

    const autosaveKey = seriesId && epId ? makeAutosaveKey(seriesId, epId) : "";
    const ingestionJobId = searchParams.get("jobId")?.trim() ?? "";

    const makeSnapshot = useCallback((): StructureReviewSnapshot | null => {
        if (!episode) return null;
        return {
            episode,
            reviewDecisions,
            pageIndex,
            selectedPanelIndex,
            selectedBubbleIndex,
            scriptAssistText,
        };
    }, [episode, pageIndex, reviewDecisions, scriptAssistText, selectedBubbleIndex, selectedPanelIndex]);

    const restoreSnapshot = useCallback((snapshot: StructureReviewSnapshot) => {
        setEpisode(snapshot.episode);
        setReviewDecisions(snapshot.reviewDecisions);
        setPageIndex(Math.min(snapshot.pageIndex, Math.max(0, snapshot.episode.pages.length - 1)));
        setSelectedPanelIndex(snapshot.selectedPanelIndex);
        setSelectedBubbleIndex(snapshot.selectedBubbleIndex);
        setScriptAssistText(snapshot.scriptAssistText);
        setSaved(false);
    }, []);

    const recordSnapshot = useCallback(() => {
        const snapshot = makeSnapshot();
        if (!snapshot) return;
        const snapshotKey = serializeSnapshot(snapshot);
        setUndoStack((current) => {
            const last = current[current.length - 1];
            if (last && serializeSnapshot(last) === snapshotKey) return current;
            return [...current, snapshot].slice(-MAX_HISTORY_LENGTH);
        });
        setRedoStack([]);
        setDirty(true);
        setRecoveredAt(null);
    }, [makeSnapshot]);

    const undo = useCallback(() => {
        const current = makeSnapshot();
        if (!current || undoStack.length === 0) return;
        const previous = undoStack[undoStack.length - 1];
        setUndoStack(undoStack.slice(0, -1));
        setRedoStack([current, ...redoStack].slice(0, MAX_HISTORY_LENGTH));
        restoreSnapshot(previous);
        setDirty(true);
        setRecoveredAt(null);
    }, [makeSnapshot, redoStack, restoreSnapshot, undoStack]);

    const redo = useCallback(() => {
        const current = makeSnapshot();
        if (!current || redoStack.length === 0) return;
        const next = redoStack[0];
        setUndoStack([...undoStack, current].slice(-MAX_HISTORY_LENGTH));
        setRedoStack(redoStack.slice(1));
        restoreSnapshot(next);
        setDirty(true);
        setRecoveredAt(null);
    }, [makeSnapshot, redoStack, restoreSnapshot, undoStack]);

    const requestLeave = useCallback((href?: string) => {
        if (!dirty) return true;
        const recentConfirmation = confirmedNavigationRef.current;
        if (recentConfirmation && Date.now() - recentConfirmation.at < 1000) {
            return recentConfirmation.href === href;
        }
        const confirmed = confirmStructureReviewLeave(dirty, t("structure.unsavedLeaveConfirm"));
        if (confirmed) {
            confirmedNavigationRef.current = { at: Date.now(), href };
        }
        return confirmed;
    }, [dirty, t]);

    useEffect(() => {
        if (!seriesId || !epId) return;
        getAdminEpisode(seriesId, epId)
            .then((ep) => {
                if (!ep) {
                    setError(t("structure.loadError"));
                    return;
                }
                const nextReviewDecisions = seedAcceptedDecisions(ep);
                setBaselineEpisode(ep);
                setBaselineReviewDecisions(nextReviewDecisions);
                const recovery = readAutosave(makeAutosaveKey(seriesId, epId));
                if (recovery?.episode.id === ep.id) {
                    setEpisode(recovery.episode);
                    setReviewDecisions(recovery.reviewDecisions);
                    setPageIndex(Math.min(recovery.pageIndex, Math.max(0, recovery.episode.pages.length - 1)));
                    setSelectedPanelIndex(recovery.selectedPanelIndex);
                    setSelectedBubbleIndex(recovery.selectedBubbleIndex);
                    setScriptAssistText(recovery.scriptAssistText);
                    setDirty(true);
                    setRecoveredAt(recovery.savedAt);
                } else {
                    setEpisode(ep);
                    setReviewDecisions(nextReviewDecisions);
                    setPageIndex(0);
                    setSelectedPanelIndex(ep.pages[0]?.panels.length ? 0 : null);
                    setSelectedBubbleIndex(null);
                    setScriptAssistText("");
                    setDirty(false);
                    setRecoveredAt(null);
                }
                setUndoStack([]);
                setRedoStack([]);
            })
            .catch((e) => setError((e as Error).message));
    }, [seriesId, epId]);

    useEffect(() => {
        let cancelled = false;
        setReviewCandidateError("");
        if (!ingestionJobId) {
            setReviewCandidates([]);
            return;
        }
        getReviewCandidates(ingestionJobId)
            .then((items) => {
                if (cancelled) return;
                setReviewCandidates(items);
            })
            .catch((e) => {
                if (cancelled) return;
                setReviewCandidates([]);
                setReviewCandidateError((e as Error).message);
            });
        return () => {
            cancelled = true;
        };
    }, [ingestionJobId]);

    const page = episode?.pages[pageIndex] ?? null;
    const selectedPanel = page && selectedPanelIndex !== null ? page.panels[selectedPanelIndex] : null;
    const pageLevelBubbles = page ? (page.bubbles ?? []).filter((bubble) => bubble.panelId === null) : [];
    const selectedBubble = selectedPanel && selectedBubbleIndex !== null
        ? selectedPanel.bubbles[selectedBubbleIndex]
        : selectedPanelIndex === null && selectedBubbleIndex !== null
            ? pageLevelBubbles[selectedBubbleIndex]
            : null;
    const selectedPanelDecision = selectedPanel ? reviewDecisions[panelReviewKey(selectedPanel)] ?? "pending" : null;
    const selectedBubbleDecision = selectedBubble ? reviewDecisions[bubbleReviewKey(selectedBubble)] ?? "pending" : null;
    const textComparisonOverlays = useMemo(() => {
        if (!episode || !ingestionJobId) return undefined;
        return buildBubbleTextComparisonOverlayMap(episode, reviewCandidates, (candidate) => {
            console.warn("[PageStructureReview] Ignoring unmatched ingestion review candidate", {
                jobId: ingestionJobId,
                ...candidate,
            });
        });
    }, [episode, ingestionJobId, reviewCandidates]);
    const selectedBubbleTextComparison = selectedBubble ? textComparisonOverlays?.get(bubbleIdOf(selectedBubble)) : undefined;

    const imageUrl = useMemo(() => {
        if (!seriesId || !epId || !page) return "";
        return getAdminPageImageUrl(seriesId, epId, page.pageNumber);
    }, [seriesId, epId, page]);

    const reviewSummary = useMemo(() => {
        return summarizeReview(page, reviewDecisions);
    }, [page, reviewDecisions]);
    const pageReviewWarnings = useMemo(() => {
        return getPageReviewWarnings(page);
    }, [page]);

    const changeSummary = useMemo(() => {
        return summarizeStructureChanges(baselineEpisode, episode, baselineReviewDecisions, reviewDecisions);
    }, [baselineEpisode, baselineReviewDecisions, episode, reviewDecisions]);

    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (!dirty) {
            confirmedNavigationRef.current = null;
            return;
        }

        const onDocumentClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const target = event.target instanceof Element ? event.target : null;
            const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
            if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;

            const nextUrl = new URL(anchor.href, window.location.href);
            if (nextUrl.origin !== window.location.origin) return;
            const currentUrl = new URL(window.location.href);
            const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
            const currentHref = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
            if (nextHref === currentHref) return;

            if (!requestLeave(nextHref)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        document.addEventListener("click", onDocumentClick, true);
        return () => document.removeEventListener("click", onDocumentClick, true);
    }, [dirty, requestLeave]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isUndoKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z";
            if (!isUndoKey) return;
            event.preventDefault();
            if (event.shiftKey) {
                redo();
            } else {
                undo();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [redo, undo]);

    useEffect(() => {
        if (!dirty || !autosaveKey) return;
        const snapshot = makeSnapshot();
        if (!snapshot) return;
        const id = window.setTimeout(() => writeAutosave(autosaveKey, snapshot), 250);
        return () => window.clearTimeout(id);
    }, [autosaveKey, dirty, makeSnapshot]);

    useEffect(() => {
        stageRef.current?.scrollTo({ left: 0, top: 0 });
        setStructureViewport((current) => ({
            ...current,
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [pageIndex]);

    const updatePage = useCallback((nextPage: PageData, options: { recordHistory?: boolean } = {}) => {
        if (options.recordHistory !== false) {
            recordSnapshot();
        } else {
            setDirty(true);
            setRecoveredAt(null);
        }
        setEpisode((current) => {
            if (!current) return current;
            const pages = [...current.pages];
            pages[pageIndex] = syncPageBubbles(nextPage);
            return { ...current, pages };
        });
        setSaved(false);
    }, [pageIndex, recordSnapshot]);

    const { startDrag } = useStructureReviewDrag({
        page,
        canvasRef,
        updatePage: (nextPage) => updatePage(nextPage, { recordHistory: false }),
        onBeforeChange: recordSnapshot,
        setSelectedPanelIndex,
        setSelectedBubbleIndex,
    });

    const updateStructureViewport = useCallback((patch: Partial<StructureViewport>) => {
        setStructureViewport((current) => ({
            ...current,
            ...patch,
            zoom: patch.zoom === undefined ? current.zoom : clampStructureZoom(patch.zoom),
        }));
    }, []);

    const zoomStructureCanvas = useCallback((delta: number) => {
        setStructureViewport((current) => ({
            ...current,
            zoom: clampStructureZoom(current.zoom + delta),
        }));
    }, []);

    const resetStructureScroll = useCallback(() => {
        stageRef.current?.scrollTo({ left: 0, top: 0 });
    }, []);

    const resetStructureView = useCallback(() => {
        resetStructureScroll();
        setStructureViewport({
            zoom: 1,
            panX: 0,
            panY: 0,
            panMode: false,
        });
    }, [resetStructureScroll]);

    const fitStructureWidth = useCallback(() => {
        resetStructureScroll();
        setStructureViewport((current) => ({
            ...current,
            zoom: 1,
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [resetStructureScroll]);

    const fitStructureScreen = useCallback(() => {
        if (!stageRef.current || !page) {
            fitStructureWidth();
            return;
        }
        const stageRect = stageRef.current.getBoundingClientRect();
        const availableWidth = Math.max(320, stageRef.current.clientWidth - 32);
        const baseWidth = Math.min(availableWidth, 736);
        const baseHeight = baseWidth * (page.height / page.width);
        const availableHeight = Math.max(280, window.innerHeight - stageRect.top - 96);
        resetStructureScroll();
        setStructureViewport((current) => ({
            ...current,
            zoom: clampStructureZoom(Math.min(1, availableHeight / baseHeight)),
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [fitStructureWidth, page, resetStructureScroll]);

    const updatePanel = (panelIndex: number, nextPanel: PanelData, options: { recordHistory?: boolean } = {}) => {
        if (!page) return;
        const panels = [...page.panels];
        panels[panelIndex] = nextPanel;
        updatePage({ ...page, panels }, options);
    };

    const addPanel = () => {
        if (!page) return;
        const panelNumber = page.panels.length + 1;
        const panelId = makePanelId(page, nextPanelIdNumber(page));
        const panel: PanelData = {
            id: panelId,
            panelId,
            stableRef: panelId,
            panelNumber,
            bbox: clampBox({
                x: Math.round(page.width * 0.08),
                y: Math.round(page.height * 0.08),
                width: Math.round(page.width * 0.38),
                height: Math.round(page.height * 0.22),
            }, page),
            reactionTags: [],
            bubbles: [],
        };
        updatePage({ ...page, panels: [...page.panels, panel] });
        setReviewDecisions((current) => markPanels(current, [panel], "pending"));
        setSelectedPanelIndex(page.panels.length);
        setSelectedBubbleIndex(null);
    };

    const deletePanel = (options: { recordHistory?: boolean } = {}) => {
        if (!page || selectedPanelIndex === null) return;
        const panels = renumberPanels(page, page.panels.filter((_, i) => i !== selectedPanelIndex));
        updatePage({ ...page, panels }, options);
        setSelectedPanelIndex(panels.length ? Math.min(selectedPanelIndex, panels.length - 1) : null);
        setSelectedBubbleIndex(null);
    };

    const applyPanelTemplate = (template: PanelTemplate) => {
        if (!page) return;
        if (page.panels.length > 0 && !window.confirm(t("structure.replaceConfirm"))) {
            return;
        }
        const panels = buildTemplatePanels(page, template);
        updatePage({ ...page, panels });
        setReviewDecisions((current) => markPanels(current, panels, "pending"));
        setSelectedPanelIndex(panels.length ? 0 : null);
        setSelectedBubbleIndex(null);
    };

    const clearPanels = () => {
        if (!page || page.panels.length === 0) return;
        if (!window.confirm(t("structure.clearConfirm"))) return;
        updatePage({ ...page, panels: [] });
        setSelectedPanelIndex(null);
        setSelectedBubbleIndex(null);
    };

    const applyReadingOrderEstimate = () => {
        if (!page) return;
        const result = applyEstimatedReadingOrder(page);
        const changeCount = result.changedPanelCount + result.changedBubbleCount;
        if (changeCount === 0) {
            window.alert(t("structure.readingOrder.noChanges"));
            return;
        }
        if (!window.confirm(t("structure.readingOrder.confirm", {
            panelCount: result.changedPanelCount,
            bubbleCount: result.changedBubbleCount,
        }))) {
            return;
        }
        updatePage(result.page);
        setReviewDecisions((current) => {
            const next = markPanels(current, result.page.panels, "pending");
            for (const bubble of result.page.bubbles ?? []) {
                if (bubble.panelId === null) {
                    next[bubbleReviewKey(bubble)] = "pending";
                }
            }
            return next;
        });
        setSelectedPanelIndex(result.page.panels.length ? 0 : null);
        setSelectedBubbleIndex(null);
    };

    const addBubble = () => {
        if (!page) return;
        if (!selectedPanel || selectedPanelIndex === null) {
            const pageBubbleNumber = pageLevelBubbles.length + 1;
            const bubbleNumber = (page.bubbles ?? []).length + 1;
            const bubbleId = makePageBubbleId(page, nextPageBubbleIdNumber(page));
            const displayRef = makePageBubbleShortId(page, pageBubbleNumber);
            const width = Math.max(72, Math.round(page.width * 0.22));
            const height = Math.max(52, Math.round(page.height * 0.08));
            const bubble: BubbleData = {
                id: bubbleId,
                bubbleId,
                panelId: null,
                stableRef: bubbleId,
                displayRef,
                bubbleNumber,
                shortId: displayRef,
                bubbleType: "speech",
                textOriginal: "",
                bbox: clampBox({
                    x: Math.round(page.width - width - 24),
                    y: 24,
                    width,
                    height,
                }, page),
            };
            updatePage({ ...page, bubbles: [...(page.bubbles ?? []), bubble] });
            setReviewDecisions((current) => ({
                ...current,
                [bubbleReviewKey(bubble)]: "pending",
            }));
            setSelectedPanelIndex(null);
            setSelectedBubbleIndex(pageBubbleNumber - 1);
            return;
        }
        const panelIndex = selectedPanelIndex;
        const panel: PanelData = selectedPanel;
        const localBubbleNumber = panel.bubbles.length + 1;
        const bubbleNumber = (page.bubbles ?? []).length + 1;
        const bubbleId = makeBubbleId(panel, nextBubbleIdNumber(panel));
        const displayRef = makeBubbleShortId(page, panel, localBubbleNumber);
        const width = Math.max(60, Math.round(panel.bbox.width * 0.28));
        const height = Math.max(48, Math.round(panel.bbox.height * 0.14));
        const bubble: BubbleData = {
            id: bubbleId,
            bubbleId,
            panelId: panelIdOf(panel),
            stableRef: bubbleId,
            displayRef,
            bubbleNumber,
            shortId: displayRef,
            bubbleType: "speech",
            textOriginal: "",
            bbox: clampBox({
                x: Math.round(panel.bbox.x + panel.bbox.width - width - 24),
                y: Math.round(panel.bbox.y + 24),
                width,
                height,
            }, page),
        };
        const nextPanel = { ...panel, bubbles: [...panel.bubbles, bubble] };
        updatePanel(selectedPanelIndex, nextPanel);
        setReviewDecisions((current) => ({
            ...current,
            [panelReviewKey(nextPanel)]: current[panelReviewKey(nextPanel)] ?? "accepted",
            [bubbleReviewKey(bubble)]: "pending",
        }));
        setSelectedPanelIndex(panelIndex);
        setSelectedBubbleIndex(panel.bubbles.length);
    };

    const deleteBubble = (options: { recordHistory?: boolean } = {}) => {
        if (!page || selectedBubbleIndex === null) return;
        if (!selectedPanel || selectedPanelIndex === null) {
            const selected = pageLevelBubbles[selectedBubbleIndex];
            if (!selected) return;
            const bubbles = (page.bubbles ?? []).filter((bubble) => bubbleIdOf(bubble) !== bubbleIdOf(selected));
            updatePage({ ...page, bubbles }, options);
            setSelectedBubbleIndex(pageLevelBubbles.length > 1 ? Math.min(selectedBubbleIndex, pageLevelBubbles.length - 2) : null);
            return;
        }
        const bubbles = selectedPanel.bubbles.filter((_, i) => i !== selectedBubbleIndex);
        const nextPanel = renumberPanelBubbles(page!, { ...selectedPanel, bubbles });
        updatePanel(selectedPanelIndex, nextPanel, options);
        setSelectedBubbleIndex(bubbles.length ? Math.min(selectedBubbleIndex, bubbles.length - 1) : null);
    };

    const movePanel = (fromIndex: number, direction: -1 | 1) => {
        if (!page) return;
        const toIndex = fromIndex + direction;
        if (toIndex < 0 || toIndex >= page.panels.length) return;
        const panels = [...page.panels];
        [panels[fromIndex], panels[toIndex]] = [panels[toIndex], panels[fromIndex]];
        updatePage({ ...page, panels: renumberPanels(page, panels) });
        setSelectedPanelIndex(toIndex);
        setSelectedBubbleIndex(null);
    };

    const reorderPageLevelBubble = (fromIndex: number, toIndex: number) => {
        if (!page) return;
        if (fromIndex < 0 || fromIndex >= pageLevelBubbles.length) return;
        if (toIndex < 0 || toIndex >= pageLevelBubbles.length) return;
        const pageLevel = [...pageLevelBubbles];
        const [bubble] = pageLevel.splice(fromIndex, 1);
        if (!bubble) return;
        pageLevel.splice(toIndex, 0, bubble);
        const reorderedPageLevel = pageLevel.map((item, index) => ({
            ...item,
            bubbleNumber: index + 1,
            displayRef: item.displayRef ?? makePageBubbleShortId(page, index + 1),
            shortId: item.shortId ?? item.displayRef ?? makePageBubbleShortId(page, index + 1),
        }));
        const assignedBubbles = (page.bubbles ?? []).filter((item) => item.panelId !== null);
        updatePage({ ...page, bubbles: [...assignedBubbles, ...reorderedPageLevel] });
    };

    const selectBubbleCandidate = (panelIndex: number | null, bubbleIndex: number) => {
        setSelectedPanelIndex(panelIndex);
        setSelectedBubbleIndex(bubbleIndex);
    };

    const moveBubbleCandidate = (bubbleId: string, direction: -1 | 1) => {
        if (!page) return;
        const result = moveBubbleByGlobalReadingOrder(page, bubbleId, direction);
        if (!result.changed) return;
        updatePage(result.page);
        setSelectedPanelIndex(result.selectedPanelIndex);
        setSelectedBubbleIndex(result.selectedBubbleIndex);
    };

    const acceptPanel = (panel: PanelData) => {
        recordSnapshot();
        setReviewDecisions((current) => markPanels(current, [panel], "accepted"));
        setError("");
    };

    const acceptBubble = (bubble: BubbleData) => {
        recordSnapshot();
        setReviewDecisions((current) => ({ ...current, [bubbleReviewKey(bubble)]: "accepted" }));
        setError("");
    };

    const rejectSelectedPanel = () => {
        if (!selectedPanel) return;
        recordSnapshot();
        setReviewDecisions((current) => markPanels(current, [selectedPanel], "rejected"));
        deletePanel({ recordHistory: false });
    };

    const rejectSelectedBubble = () => {
        if (!selectedBubble) return;
        recordSnapshot();
        setReviewDecisions((current) => ({ ...current, [bubbleReviewKey(selectedBubble)]: "rejected" }));
        deleteBubble({ recordHistory: false });
    };

    const updateSelectedPanelBox = (field: keyof BoundingBox, value: number) => {
        if (!page || !selectedPanel || selectedPanelIndex === null) return;
        updatePanel(selectedPanelIndex, {
            ...selectedPanel,
            bbox: clampBox({ ...selectedPanel.bbox, [field]: value }, page),
        });
    };

    const updateSelectedBubble = (patch: Partial<BubbleData>) => {
        if (!page || selectedBubbleIndex === null) return;
        if (!selectedPanel || selectedPanelIndex === null) {
            const selected = pageLevelBubbles[selectedBubbleIndex];
            if (!selected) return;
            const bubbles = (page.bubbles ?? []).map((bubble) =>
                bubbleIdOf(bubble) === bubbleIdOf(selected) ? applyBubblePatch(bubble, patch) : bubble,
            );
            updatePage({ ...page, bubbles });
            return;
        }
        const bubbles = [...selectedPanel.bubbles];
        bubbles[selectedBubbleIndex] = applyBubblePatch(bubbles[selectedBubbleIndex], patch);
        updatePanel(selectedPanelIndex, { ...selectedPanel, bubbles });
    };

    const updateSelectedBubbleReadingOrder = (readingOrder: number) => {
        if (!page || selectedBubbleIndex === null) return;
        if (!selectedPanel || selectedPanelIndex === null) {
            const toIndex = Math.max(0, Math.min(pageLevelBubbles.length - 1, Math.round(readingOrder) - 1));
            if (toIndex === selectedBubbleIndex) return;
            reorderPageLevelBubble(selectedBubbleIndex, toIndex);
            setSelectedBubbleIndex(toIndex);
            return;
        }
        const toIndex = Math.max(0, Math.min(selectedPanel.bubbles.length - 1, Math.round(readingOrder) - 1));
        if (toIndex === selectedBubbleIndex) return;
        const bubbles = [...selectedPanel.bubbles];
        const [bubble] = bubbles.splice(selectedBubbleIndex, 1);
        bubbles.splice(toIndex, 0, bubble);
        updatePanel(selectedPanelIndex, renumberPanelBubbles(page!, { ...selectedPanel, bubbles }));
        setSelectedBubbleIndex(toIndex);
    };

    const updateSelectedBubbleBox = (field: keyof BoundingBox, value: number) => {
        if (!page || !selectedBubble) return;
        updateSelectedBubble({ bbox: clampBox({ ...selectedBubble.bbox, [field]: value }, page) });
    };

    const assignSelectedBubblePanel = (targetPanelIndex: number | null) => {
        if (!page || !selectedBubble || selectedBubbleIndex === null) return;
        if (targetPanelIndex === selectedPanelIndex) return;
        const bubbleId = bubbleIdOf(selectedBubble);
        const panels = page.panels.map((panel) => ({
            ...panel,
            bubbles: panel.bubbles.filter((bubble) => bubbleIdOf(bubble) !== bubbleId),
        }));
        const pageLevelBubblesWithoutSelected = (page.bubbles ?? [])
            .filter((bubble) => bubble.panelId === null && bubbleIdOf(bubble) !== bubbleId);

        if (targetPanelIndex === null) {
            const displayRef = makePageBubbleShortId(page, pageLevelBubblesWithoutSelected.length + 1);
            const nextBubble: BubbleData = {
                ...selectedBubble,
                panelId: null,
                displayRef,
                shortId: displayRef,
            };
            updatePage({ ...page, panels, bubbles: [...pageLevelBubblesWithoutSelected, nextBubble] });
            setSelectedPanelIndex(null);
            setSelectedBubbleIndex(pageLevelBubblesWithoutSelected.length);
            return;
        }

        const targetPanel = panels[targetPanelIndex];
        if (!targetPanel) return;
        const displayRef = makeBubbleShortId(page, targetPanel, targetPanel.bubbles.length + 1);
        const nextBubble: BubbleData = {
            ...selectedBubble,
            panelId: panelIdOf(targetPanel),
            displayRef,
            shortId: displayRef,
        };
        panels[targetPanelIndex] = {
            ...targetPanel,
            bubbles: [...targetPanel.bubbles, nextBubble],
        };
        updatePage({ ...page, panels, bubbles: pageLevelBubblesWithoutSelected });
        setSelectedPanelIndex(targetPanelIndex);
        setSelectedBubbleIndex(targetPanel.bubbles.length);
    };

    const updatePageDisplayRef = (displayRef: string) => {
        if (!page) return;
        updatePage({ ...page, displayRef: displayRef.trim() || undefined });
    };

    const applyScriptAssist = () => {
        if (!page || !selectedPanel || selectedPanelIndex === null) {
            setError(t("structure.sidebar.scriptNeedsPanel"));
            return;
        }
        const parsed = parseScriptAssistLines(scriptAssistText);
        if (parsed.length === 0) {
            setError(t("structure.sidebar.scriptNoLines"));
            return;
        }

        const startLocalNumber = selectedPanel.bubbles.length + 1;
        const startNumber = (page.bubbles ?? []).length + 1;
        const startIdNumber = nextBubbleIdNumber(selectedPanel);
        const width = Math.max(72, Math.round(selectedPanel.bbox.width * 0.34));
        const height = Math.max(52, Math.round(selectedPanel.bbox.height * 0.26));
        const gutter = 12;
        const nextBubbles: BubbleData[] = parsed.map((entry, index) => {
            const bubbleNumber = startNumber + index;
            const localBubbleNumber = startLocalNumber + index;
            const bubbleId = makeBubbleId(selectedPanel, startIdNumber + index);
            const displayRef = makeBubbleShortId(page, selectedPanel, localBubbleNumber);
            const yOffset = 18 + index * (height + gutter);
            return {
                id: bubbleId,
                bubbleId,
                panelId: panelIdOf(selectedPanel),
                stableRef: bubbleId,
                displayRef,
                bubbleNumber,
                shortId: displayRef,
                bubbleType: entry.bubbleType,
                textOriginal: entry.textOriginal,
                speaker: entry.speaker,
                bbox: clampBox({
                    x: Math.round(selectedPanel.bbox.x + selectedPanel.bbox.width - width - 18),
                    y: Math.round(selectedPanel.bbox.y + yOffset),
                    width,
                    height,
                }, page),
            };
        });

        updatePanel(selectedPanelIndex, {
            ...selectedPanel,
            bubbles: [...selectedPanel.bubbles, ...nextBubbles],
        });
        setReviewDecisions((current) => {
            const next = { ...current };
            nextBubbles.forEach((bubble) => {
                next[bubbleReviewKey(bubble)] = "pending";
            });
            return next;
        });
        setSelectedBubbleIndex(selectedPanel.bubbles.length);
        setScriptAssistText("");
        setError("");
    };

    const save = async () => {
        if (!seriesId || !episode) return;
        setSaving(true);
        setError("");
        try {
            await saveEpisode(seriesId, {
                id: episode.id,
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                publishedAt: episode.publishedAt,
                publishStartAt: episode.publishStartAt,
                publishEndAt: episode.publishEndAt,
                visibility: episode.visibility,
                pages: episode.pages,
            });
            setBaselineEpisode(episode);
            setBaselineReviewDecisions(reviewDecisions);
            setSaved(true);
            setDirty(false);
            setRecoveredAt(null);
            setUndoStack([]);
            setRedoStack([]);
            if (autosaveKey) clearAutosave(autosaveKey);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (!episode) {
        return (
            <div>
                <h1>{t("structure.title")}</h1>
                {error ? <div className="error-msg">{error}</div> : <p style={{ color: "var(--muted)" }}>{t("structure.loading")}</p>}
            </div>
        );
    }

    return (
        <div className="structure-review">
            <StructureReviewHeader
                seriesId={seriesId}
                episodeId={episode.id}
                episode={episode}
                saving={saving}
                dirty={dirty}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onUndo={undo}
                onRedo={redo}
                onRequestLeave={() => requestLeave(`/works/${seriesId}/episodes/${episode.id}`)}
                onSave={save}
                showTranslationImport={currentUser?.role === "admin"}
            />

            {error && <div className="error-msg">{error}</div>}
            {reviewCandidateError && (
                <div className="warning-msg">
                    Ingestion review candidates の取得に失敗しました: {reviewCandidateError}
                </div>
            )}
            {dirty && reviewSummary.pending > 0 && (
                <div className="warning-msg">
                    {t("structure.pendingSaveWarning", { count: reviewSummary.pending })}
                </div>
            )}
            {pageReviewWarnings.length > 0 && (
                <div className="warning-msg">
                    <strong>{t("structure.pageWarnings.title")}</strong>
                    <ul>
                        {pageReviewWarnings.map((warning) => (
                            <li key={`${warning.code}-${warning.pageId ?? "page"}`}>
                                {warning.code === "READING_ORDER_SUSPECT" ? t("structure.warning.READING_ORDER_SUSPECT") : warning.code}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {recoveredAt && (
                <div className="success-msg">
                    {t("structure.recovered", { savedAt: new Date(recoveredAt).toLocaleString() })}
                </div>
            )}
            {saved && <div className="success-msg">{t("structure.saved")}</div>}
            {dirty && <StructureChangeSummary summary={changeSummary} />}
            <div className="structure-narrow-warning warning-msg">{t("structure.narrowWarning")}</div>

            <div className="structure-layout">
                <PageStructureSidebar
                    seriesId={seriesId}
                    episodeId={episode.id}
                    episode={episode}
                    page={page}
                    pageIndex={pageIndex}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubbleIndex={selectedBubbleIndex}
                    scriptAssistText={scriptAssistText}
                    reviewDecisions={reviewDecisions}
                    reviewSummary={reviewSummary}
                    textComparisonOverlays={textComparisonOverlays}
                    onPageChange={(next) => {
                        setPageIndex(next);
                        setSelectedPanelIndex(episode.pages[next]?.panels.length ? 0 : null);
                        setSelectedBubbleIndex(null);
                    }}
                    onPageDisplayRefChange={updatePageDisplayRef}
                    onAddPanel={addPanel}
                    onAddBubble={addBubble}
                    onApplyPanelTemplate={applyPanelTemplate}
                    onClearPanels={clearPanels}
                    onApplyReadingOrderEstimate={applyReadingOrderEstimate}
                    onScriptAssistTextChange={setScriptAssistText}
                    onApplyScriptAssist={applyScriptAssist}
                    onSelectPanel={(index) => {
                        setSelectedPanelIndex(index);
                        setSelectedBubbleIndex(null);
                    }}
                    onSelectBubbleCandidate={selectBubbleCandidate}
                    onMovePanel={movePanel}
                    onMoveBubbleCandidate={moveBubbleCandidate}
                />

                <CanvasOverlayEditor
                    page={page}
                    imageUrl={imageUrl}
                    stageRef={stageRef}
                    canvasRef={canvasRef}
                    viewport={structureViewport}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubbleIndex={selectedBubbleIndex}
                    reviewDecisions={reviewDecisions}
                    onViewportChange={updateStructureViewport}
                    onZoomIn={() => zoomStructureCanvas(0.15)}
                    onZoomOut={() => zoomStructureCanvas(-0.15)}
                    onResetView={resetStructureView}
                    onFitWidth={fitStructureWidth}
                    onFitScreen={fitStructureScreen}
                    onStartDrag={startDrag}
                />

                <StructureInspector
                    seriesId={seriesId}
                    episodeId={episode.id}
                    page={page}
                    selectedPanel={selectedPanel}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubble={selectedBubble}
                    selectedBubbleTextComparison={selectedBubbleTextComparison}
                    selectedPanelDecision={selectedPanelDecision}
                    selectedBubbleDecision={selectedBubbleDecision}
                    onUpdatePanel={updatePanel}
                    onUpdateSelectedPanelBox={updateSelectedPanelBox}
                    onUpdateSelectedBubble={updateSelectedBubble}
                    onUpdateSelectedBubbleReadingOrder={updateSelectedBubbleReadingOrder}
                    onUpdateSelectedBubbleBox={updateSelectedBubbleBox}
                    onAssignSelectedBubblePanel={assignSelectedBubblePanel}
                    onAcceptPanel={acceptPanel}
                    onRejectSelectedPanel={rejectSelectedPanel}
                    onAcceptBubble={acceptBubble}
                    onRejectSelectedBubble={rejectSelectedBubble}
                />
            </div>

            <StructureReviewFooter
                saving={saving}
                onSave={save}
                onWorkDetail={() => {
                    const href = `/works/${seriesId}`;
                    if (requestLeave(href)) nav(href);
                }}
            />
        </div>
    );
}
