import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    createPackDraft,
    getAdminEpisode,
    getSeries,
    importTranslationPackDraft,
    listPackDrafts,
    type BubbleData,
    type EpisodeData,
    type PackDraftEntry,
    type PackDraftRecord,
    type PanelData,
    type SeriesDetail,
    type TranslationImportSourceFormat,
    type TranslationPackDraftImportEntry,
    type TranslationPackDraftImportResponse,
} from "../api";
import { estimateTranslationFit, type TranslationFitEstimate } from "../lib/structure-review/translationFit";

type CanonicalBubbleRow = {
    bubbleId: string;
    refs: string[];
    pageId: string;
    pageNumber: number;
    panelId: string | null;
    panelNumber?: number;
    readingOrder: number;
    sourceText: string;
    bboxSummary: string;
    bbox: BubbleData["bbox"];
    pageWidth: number;
};

type ParsedTranslationRow = {
    rowNumber: number;
    lookupRef: string;
    sourceText?: string;
    text?: string;
    comment?: string;
};

type ResolvedTranslationRow = ParsedTranslationRow & {
    canonical?: CanonicalBubbleRow;
    entry?: TranslationPackDraftImportEntry;
    fitEstimate?: TranslationFitEstimate;
};

function pageIdOf(page: EpisodeData["pages"][number]) {
    return page.pageId ?? page.id;
}

function panelIdOf(panel: PanelData) {
    return panel.panelId ?? panel.id;
}

function bubbleIdOf(bubble: BubbleData) {
    return bubble.bubbleId ?? bubble.id;
}

function formatBbox(bbox: BubbleData["bbox"]) {
    return `${Math.round(bbox.x)},${Math.round(bbox.y)},${Math.round(bbox.width)},${Math.round(bbox.height)}`;
}

function headerKey(value: string) {
    return value
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function readField(row: Map<string, string>, aliases: string[]) {
    for (const alias of aliases) {
        const value = row.get(alias);
        if (value?.trim()) return value.trim();
    }
    return "";
}

function parseCsvRows(input: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        const next = input[i + 1];
        if (char === '"' && quoted && next === '"') {
            cell += '"';
            i += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === "," && !quoted) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") i += 1;
            row.push(cell);
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
}

function parsedRowFromObject(input: Record<string, unknown>, rowNumber: number): ParsedTranslationRow {
    const normalized = new Map<string, string>();
    Object.entries(input).forEach(([key, value]) => {
        normalized.set(headerKey(key), value === undefined || value === null ? "" : String(value));
    });
    return {
        rowNumber,
        lookupRef: readField(normalized, ["bubble_id", "bubbleid", "bubble_ref", "bubble", "id", "short_id", "shortid", "display_ref", "displayref"]),
        sourceText: readField(normalized, ["source_text", "sourcetext", "source", "original_text", "originaltext", "text_original", "textoriginal"]) || undefined,
        text: readField(normalized, ["text", "suggested_text", "suggestedtext", "translation", "english", "en"]) || undefined,
        comment: readField(normalized, ["comment", "note", "memo"]) || undefined,
    };
}

function parseImportRows(input: string, sourceFormat: TranslationImportSourceFormat): { rows: ParsedTranslationRow[]; error: string } {
    const text = input.trim();
    if (!text) return { rows: [], error: "" };

    try {
        if (sourceFormat === "json") {
            const parsed = JSON.parse(text) as unknown;
            const values = Array.isArray(parsed)
                ? parsed
                : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { entries?: unknown }).entries)
                    ? (parsed as { entries: unknown[] }).entries
                    : [];
            if (!values.length) return { rows: [], error: "JSON は配列または { entries: [...] } で入力してください。" };
            return {
                rows: values.map((value, index) => parsedRowFromObject(
                    typeof value === "object" && value !== null ? value as Record<string, unknown> : {},
                    index + 1,
                )),
                error: "",
            };
        }

        const csvRows = parseCsvRows(text);
        if (csvRows.length < 2) return { rows: [], error: "CSV は header 行と translation 行を入力してください。" };
        const headers = csvRows[0].map(headerKey);
        return {
            rows: csvRows.slice(1).map((cells, index) => {
                const row = new Map<string, string>();
                headers.forEach((header, cellIndex) => row.set(header, cells[cellIndex] ?? ""));
                return parsedRowFromObject(Object.fromEntries(row), index + 2);
            }),
            error: "",
        };
    } catch (error) {
        return { rows: [], error: (error as Error).message };
    }
}

function flattenCanonicalBubbles(episode: EpisodeData | null): CanonicalBubbleRow[] {
    if (!episode) return [];
    return episode.pages.flatMap((page) => {
        const panelsById = new Map<string, PanelData>();
        page.panels.forEach((panel) => panelsById.set(panelIdOf(panel), panel));
        return page.bubbles.map((bubble) => {
            const bubbleId = bubbleIdOf(bubble);
            const panel = bubble.panelId ? panelsById.get(bubble.panelId) : undefined;
            const refs = [
                bubbleId,
                bubble.id,
                bubble.bubbleId,
                bubble.shortId,
                bubble.displayRef,
                bubble.stableRef,
            ].filter((value): value is string => Boolean(value));
            return {
                bubbleId,
                refs: [...new Set(refs)],
                pageId: pageIdOf(page),
                pageNumber: page.pageNumber,
                panelId: bubble.panelId ?? null,
                panelNumber: panel?.panelNumber,
                readingOrder: bubble.bubbleNumber,
                sourceText: bubble.textOriginal,
                bboxSummary: formatBbox(bubble.bbox),
                bbox: bubble.bbox,
                pageWidth: page.width,
            };
        });
    });
}

function resolveRows(rows: ParsedTranslationRow[], canonicalBubbles: CanonicalBubbleRow[]): ResolvedTranslationRow[] {
    const refMap = new Map<string, CanonicalBubbleRow>();
    canonicalBubbles.forEach((bubble) => {
        bubble.refs.forEach((ref) => refMap.set(ref, bubble));
    });

    return rows.map((row) => {
        const canonical = refMap.get(row.lookupRef);
        if (!canonical) return row;
        const fitEstimate = row.text?.trim()
            ? estimateTranslationFit({
                text: row.text,
                bbox: canonical.bbox,
                pageWidth: canonical.pageWidth,
            })
            : undefined;
        return {
            ...row,
            canonical,
            fitEstimate,
            entry: {
                bubble_id: canonical.bubbleId,
                page_id: canonical.pageId,
                panel_id: canonical.panelId,
                row_number: row.rowNumber,
                row_ref: row.lookupRef,
                ...(row.sourceText && { source_text: row.sourceText }),
                ...(row.text && { text: row.text }),
                ...(row.comment && { comment: row.comment }),
            },
        };
    });
}

function countDuplicates(rows: ResolvedTranslationRow[]) {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
        if (!row.canonical) return;
        counts.set(row.canonical.bubbleId, (counts.get(row.canonical.bubbleId) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([bubbleId]) => bubbleId);
}

function normalizeSourceText(value: string | undefined) {
    return (value ?? "").trim();
}

function hasSourceTextMismatch(row: ResolvedTranslationRow) {
    if (!row.canonical || row.sourceText === undefined) return false;
    return normalizeSourceText(row.sourceText) !== normalizeSourceText(row.canonical.sourceText);
}

function issueKindLabel(kind: string) {
    switch (kind) {
        case "source_text_mismatch":
            return "source_text_mismatch（import source_text と canonical Bubble.textOriginal が違います）";
        case "unmatched_bubble":
            return "unmatched_bubble（一致する Bubble がありません）";
        case "duplicate_bubble":
            return "duplicate_bubble（同じ Bubble が複数行あります）";
        case "missing_bubble":
            return "missing_bubble（import に含まれない canonical Bubble があります）";
        case "existing_entry_conflict":
            return "existing_entry_conflict（既存 draft entry と衝突します）";
        case "invalid_pack_draft":
            return "invalid_pack_draft（Pack Draft が不正です）";
        default:
            return kind;
    }
}

export default function TranslationDraftImport() {
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const [series, setSeries] = useState<SeriesDetail | null>(null);
    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [drafts, setDrafts] = useState<PackDraftRecord[]>([]);
    const [selectedDraftId, setSelectedDraftId] = useState("");
    const [sourceFormat, setSourceFormat] = useState<TranslationImportSourceFormat>("csv");
    const [lang, setLang] = useState("en");
    const [rawInput, setRawInput] = useState("");
    const [createTitle, setCreateTitle] = useState("");
    const [apiResult, setApiResult] = useState<TranslationPackDraftImportResponse | null>(null);
    const [savedMessage, setSavedMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        if (!seriesId || !epId) return;
        setLoading(true);
        setError("");
        try {
            const [nextSeries, nextEpisode, nextDrafts] = await Promise.all([
                getSeries(seriesId),
                getAdminEpisode(seriesId, epId),
                listPackDrafts({ type: "TRANSLATION" }),
            ]);
            setSeries(nextSeries);
            setEpisode(nextEpisode);
            const scopedDrafts = nextDrafts.filter((draft) =>
                draft.type === "TRANSLATION"
                && (!draft.target_series_id || draft.target_series_id === seriesId)
                && (!draft.target_episode_id || draft.target_episode_id === epId)
                && (draft.language ?? "en") === lang,
            );
            setDrafts(scopedDrafts);
            setSelectedDraftId((current) => {
                if (current && scopedDrafts.some((draft) => draft.pack_draft_id === current)) return current;
                return scopedDrafts.find((draft) => ["draft", "in_review"].includes(draft.status))?.pack_draft_id ?? "";
            });
            if (nextSeries && nextEpisode) {
                setCreateTitle((current) => current || `${nextSeries.title} / ${nextEpisode.title} English Translation`);
            }
            if (!nextEpisode) setError("Episode が見つからないか、管理者ログインが必要です。");
        } catch (loadError) {
            setError((loadError as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [seriesId, epId, lang]);

    const canonicalBubbles = useMemo(() => flattenCanonicalBubbles(episode), [episode]);
    const parsed = useMemo(() => parseImportRows(rawInput, sourceFormat), [rawInput, sourceFormat]);
    const resolvedRows = useMemo(() => resolveRows(parsed.rows, canonicalBubbles), [canonicalBubbles, parsed.rows]);
    const duplicateBubbleIds = useMemo(() => countDuplicates(resolvedRows), [resolvedRows]);
    const apiEntries = useMemo(() => resolvedRows
        .filter((row) => row.entry && row.text?.trim())
        .map((row) => row.entry as TranslationPackDraftImportEntry), [resolvedRows]);
    const matchedBubbleIds = useMemo(() => new Set(resolvedRows.flatMap((row) => row.canonical ? [row.canonical.bubbleId] : [])), [resolvedRows]);
    const missingBubbles = useMemo(() => canonicalBubbles.filter((bubble) => !matchedBubbleIds.has(bubble.bubbleId)), [canonicalBubbles, matchedBubbleIds]);
    const unmatchedRows = resolvedRows.filter((row) => !row.canonical && row.lookupRef);
    const localSourceTextMismatches = resolvedRows.filter(hasSourceTextMismatch);
    const localFitWarnings = resolvedRows.filter((row) => row.fitEstimate?.status === "warning");
    const localFitTightRows = resolvedRows.filter((row) => row.fitEstimate?.status === "tight");
    const selectedDraft = drafts.find((draft) => draft.pack_draft_id === selectedDraftId);
    const canCallApi = Boolean(seriesId && epId && selectedDraftId && apiEntries.length > 0);
    const canApply = Boolean(apiResult?.result.can_apply && selectedDraftId && apiEntries.length > 0);
    const apiSourceTextMismatches = apiResult?.result.issues.filter((issue) => issue.kind === "source_text_mismatch") ?? [];
    const canonicalByBubbleId = useMemo(() => new Map(canonicalBubbles.map((bubble) => [bubble.bubbleId, bubble])), [canonicalBubbles]);
    const importedDraftEntries = useMemo(() => {
        if (!apiResult) return [];
        const sourceEntries: PackDraftEntry[] = apiResult.applied && apiResult.record
            ? apiResult.record.entries.filter((entry) => apiResult.result.planned_entries.some((planned) => planned.entry_id === entry.entry_id))
            : apiResult.result.planned_entries;
        return sourceEntries
            .filter((entry) => entry.target.bubble_id)
            .map((entry) => ({
                entry,
                canonical: canonicalByBubbleId.get(entry.target.bubble_id as string),
            }));
    }, [apiResult, canonicalByBubbleId]);

    const createDraft = async () => {
        if (!seriesId || !epId) return;
        setBusy(true);
        setError("");
        setSavedMessage("");
        try {
            const next = await createPackDraft({
                type: "TRANSLATION",
                title: createTitle.trim() || `${seriesId} ${epId} English Translation`,
                language: lang.trim() || "en",
                target_series_id: seriesId,
                target_episode_id: epId,
            });
            setDrafts((current) => [next, ...current.filter((draft) => draft.pack_draft_id !== next.pack_draft_id)]);
            setSelectedDraftId(next.pack_draft_id);
            setSavedMessage("Translation Pack Draft を作成しました。");
        } catch (createError) {
            setError((createError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const submitImport = async (apply: boolean) => {
        if (!seriesId || !epId || !selectedDraftId) return;
        setBusy(true);
        setError("");
        setSavedMessage("");
        try {
            const response = await importTranslationPackDraft(selectedDraftId, {
                series_id: seriesId,
                episode_id: epId,
                lang: lang.trim() || "en",
                source_format: sourceFormat,
                entries: apiEntries,
                apply,
            });
            setApiResult(response);
            if (response.applied) {
                setSavedMessage("Translation Pack Draft に import しました。canonical episode は変更していません。");
                await load();
            }
        } catch (importError) {
            setError((importError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

    return (
        <div className="translation-import-page">
            <div className="section-heading">
                <div>
                    <h1>English Translation Draft Import</h1>
                    <p className="card-meta">
                        {series?.title ?? seriesId} / {episode?.title ?? epId} — 英語版は canonical episode を上書きせず Translation Pack Draft に取り込みます。
                    </p>
                </div>
                <div className="section-actions">
                    <Link to={`/works/${seriesId}`} className="btn btn-outline">作品詳細</Link>
                    <Link to={`/works/${seriesId}/episodes/${epId}/structure`} className="btn btn-outline">Structure Review</Link>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {savedMessage && <div className="success-msg">{savedMessage}</div>}

            <div className="card">
                <h2>1. Import source</h2>
                <p className="card-meta">CSV header は bubble_id/text/source_text/comment を推奨します。bubbleId / id / shortId / displayRef でも canonical Bubble ID に解決します。</p>
                <p className="card-meta">source_text は照合用です。English draft は Translation Pack Draft に入り、canonical Bubble.textOriginal は上書きしません。</p>
                <div className="translation-import-controls">
                    <div className="form-group">
                        <label>Format</label>
                        <select value={sourceFormat} onChange={(e) => { setSourceFormat(e.target.value as TranslationImportSourceFormat); setApiResult(null); }}>
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Target language</label>
                        <input value={lang} onChange={(e) => { setLang(e.target.value); setApiResult(null); }} placeholder="en" />
                    </div>
                </div>
                <textarea
                    className="translation-import-input"
                    value={rawInput}
                    onChange={(e) => { setRawInput(e.target.value); setApiResult(null); }}
                    placeholder={'bubble_id,source_text,text,comment\nrain-world-ep01-p01-panel-01-bubble-001,「……」,"It is still raining.","tone: quiet"'}
                />
                {parsed.error && <div className="error-msg">{parsed.error}</div>}
            </div>

            <div className="card">
                <h2>2. Preview / unmatched確認</h2>
                <div className="translation-import-summary">
                    <span className="badge">canonical {canonicalBubbles.length}</span>
                    <span className="badge badge-ok">matched {matchedBubbleIds.size}</span>
                    <span className={`badge ${unmatchedRows.length ? "badge-warn" : "badge-ok"}`}>unmatched rows {unmatchedRows.length}</span>
                    <span className={`badge ${missingBubbles.length ? "badge-warn" : "badge-ok"}`}>missing bubbles {missingBubbles.length}</span>
                    <span className={`badge ${duplicateBubbleIds.length ? "badge-warn" : "badge-ok"}`}>duplicates {duplicateBubbleIds.length}</span>
                    <span className={`badge ${localSourceTextMismatches.length ? "badge-warn" : "badge-ok"}`}>source_text_mismatch {localSourceTextMismatches.length}</span>
                    <span className={`badge ${localFitTightRows.length ? "badge-warn" : "badge-ok"}`}>fit tight {localFitTightRows.length}</span>
                    <span className={`badge ${localFitWarnings.length ? "badge-warn" : "badge-ok"}`}>fit warnings {localFitWarnings.length}</span>
                </div>
                <p className="card-meta">
                    fit は Bubble bbox と textDirection からの簡易推定です。保存ブロックではなく、翻訳レビュー時の注意表示として扱います。
                </p>

                {localSourceTextMismatches.length > 0 && (
                    <div className="warning-list warning-list-priority translation-mismatch-summary">
                        <strong>source_text_mismatch</strong>
                        {localSourceTextMismatches.slice(0, 8).map((row) => (
                            <span key={`${row.rowNumber}-${row.lookupRef}`} className="badge badge-warn">
                                row {row.rowNumber}: {row.canonical?.bubbleId}
                            </span>
                        ))}
                        {localSourceTextMismatches.length > 8 && <span className="badge">+{localSourceTextMismatches.length - 8}</span>}
                    </div>
                )}

                <div className="translation-import-table-shell">
                    <table className="translation-import-table">
                        <thead>
                            <tr>
                                <th>row</th>
                                <th>ref</th>
                                <th>canonical bubble</th>
                                <th>source</th>
                                <th>English draft</th>
                                <th>fit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resolvedRows.length === 0 ? (
                                <tr><td colSpan={6}>Import rows are empty.</td></tr>
                            ) : resolvedRows.map((row) => {
                                const sourceMismatch = hasSourceTextMismatch(row);
                                return (
                                    <tr key={`${row.rowNumber}-${row.lookupRef}`}>
                                        <td>{row.rowNumber}</td>
                                        <td><code>{row.lookupRef || "-"}</code></td>
                                        <td>
                                            {row.canonical ? (
                                                <>
                                                    <code>{row.canonical.bubbleId}</code>
                                                    <small>Page {row.canonical.pageNumber} / reading {row.canonical.readingOrder} / bbox {row.canonical.bboxSummary}</small>
                                                </>
                                            ) : <span className="badge badge-warn">unmatched</span>}
                                        </td>
                                        <td>
                                            <div className={`translation-source-compare ${sourceMismatch ? "is-mismatch" : ""}`}>
                                                {row.sourceText ? (
                                                    <>
                                                        <span>import source_text</span>
                                                        <p>{row.sourceText}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>canonical Bubble.textOriginal</span>
                                                        <p>{row.canonical?.sourceText ?? "-"}</p>
                                                    </>
                                                )}
                                                {sourceMismatch && (
                                                    <small>
                                                        canonical Bubble.textOriginal: {row.canonical?.sourceText || "-"}
                                                    </small>
                                                )}
                                            </div>
                                        </td>
                                        <td>{row.text ?? "-"}</td>
                                        <td>
                                            {row.fitEstimate ? (
                                                <span className={`badge ${row.fitEstimate.status === "warning" || row.fitEstimate.status === "tight" ? "badge-warn" : "badge-ok"}`}>
                                                    {row.fitEstimate.characterCount}/{row.fitEstimate.estimatedCapacity}
                                                </span>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {unmatchedRows.length > 0 && (
                    <div className="warning-list warning-list-priority">
                        <strong>未一致 row</strong>
                        {unmatchedRows.map((row) => <span key={`${row.rowNumber}-${row.lookupRef}`} className="badge badge-warn">row {row.rowNumber}: {row.lookupRef}</span>)}
                    </div>
                )}
            </div>

            <div className="card">
                <h2>3. Pack Draft 作成 / 事前確認 / 取り込み</h2>
                <p className="card-meta">preview は Pack Draft を変更しません。apply した場合だけ runtime Translation Pack Draft に entries を追加します。</p>
                <div className="translation-import-controls">
                    <div className="form-group">
                        <label>Translation Pack Draft</label>
                        <select value={selectedDraftId} onChange={(e) => { setSelectedDraftId(e.target.value); setApiResult(null); }}>
                            <option value="">未選択</option>
                            {drafts.map((draft) => (
                                <option key={draft.pack_draft_id} value={draft.pack_draft_id}>
                                    {draft.title} / {draft.status} / {draft.entries.length} entries
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>New draft title</label>
                        <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
                    </div>
                </div>
                <div className="section-actions">
                    <button type="button" className="btn btn-outline" disabled={busy || !seriesId || !epId} onClick={createDraft}>
                        {busy ? "処理中…" : "Pack Draft を作成"}
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy || !canCallApi} onClick={() => submitImport(false)}>
                        事前確認
                    </button>
                    <button type="button" className="btn btn-success" disabled={busy || !canApply} onClick={() => submitImport(true)}>
                        Pack Draft に import
                    </button>
                </div>
                {selectedDraft && (
                    <p className="card-meta" style={{ marginTop: "0.75rem" }}>
                        Selected: <Link to={`/pack-drafts/${selectedDraft.pack_draft_id}`}>{selectedDraft.pack_draft_id}</Link> / {selectedDraft.status}
                    </p>
                )}
            </div>

            {apiResult && (
                <div className="card">
                    <h2>事前確認結果</h2>
                    <div className="translation-import-summary">
                        <span className={`badge ${apiResult.result.can_apply ? "badge-ok" : "badge-warn"}`}>can_apply {String(apiResult.result.can_apply)}</span>
                        <span className="badge">planned {apiResult.result.summary.planned_entries}</span>
                        <span className="badge">matched {apiResult.result.summary.matched_rows}</span>
                        <span className={`badge ${apiResult.result.summary.error_count ? "badge-warn" : "badge-ok"}`}>errors {apiResult.result.summary.error_count}</span>
                        <span className={`badge ${apiResult.result.summary.warning_count ? "badge-warn" : "badge-ok"}`}>warnings {apiResult.result.summary.warning_count}</span>
                        <span className={`badge ${apiSourceTextMismatches.length ? "badge-warn" : "badge-ok"}`}>source_text_mismatch {apiSourceTextMismatches.length}</span>
                    </div>
                    {importedDraftEntries.length > 0 && (
                        <div className="translation-import-applied">
                            <div className="translation-import-applied-header">
                                <strong>{apiResult.applied ? "Translation Pack Draft に入った Bubble" : "事前確認で追加予定の Bubble"}</strong>
                                <span className="badge badge-ok">{importedDraftEntries.length} entries</span>
                            </div>
                            <p className="card-meta">draft text は Pack Draft entry に入り、canonical Bubble.textOriginal は変更しません。</p>
                            <div className="translation-import-applied-list">
                                {importedDraftEntries.map(({ entry, canonical }) => (
                                    <div key={entry.entry_id} className="translation-import-applied-row">
                                        <div>
                                            <code>{entry.target.bubble_id}</code>
                                            <small>
                                                {canonical
                                                    ? `Page ${canonical.pageNumber} / reading ${canonical.readingOrder} / bbox ${canonical.bboxSummary}`
                                                    : "canonical ref not found in current episode"}
                                            </small>
                                        </div>
                                        <p>{entry.text || "-"}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {apiSourceTextMismatches.length > 0 && (
                        <div className="warning-list warning-list-priority translation-mismatch-summary">
                            <strong>source_text_mismatch</strong>
                            {apiSourceTextMismatches.map((issue, index) => (
                                <span key={`${issue.bubble_id}-${issue.row_number}-${index}`} className="badge badge-warn">
                                    row {issue.row_number ?? "-"} / bubble {issue.bubble_id ?? "-"}
                                </span>
                            ))}
                        </div>
                    )}
                    {apiResult.result.issues.length === 0 ? (
                        <div className="success-msg">検証エラーはありません。</div>
                    ) : (
                        <div className="compact-list">
                            {apiResult.result.issues.map((issue, index) => (
                                <div key={`${issue.kind}-${index}`} className={`compact-list-item ${issue.kind === "source_text_mismatch" ? "translation-import-issue-mismatch" : ""}`}>
                                    <div>
                                        <span className={`badge ${issue.severity === "error" ? "badge-warn" : ""}`}>{issue.severity}</span>{" "}
                                        <strong>{issueKindLabel(issue.kind)}</strong>
                                    </div>
                                    <p>{issue.message}</p>
                                    <div className="card-meta">
                                        row {issue.row_number ?? "-"} / ref {issue.row_ref ?? "-"} / bubble {issue.bubble_id ?? "-"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
