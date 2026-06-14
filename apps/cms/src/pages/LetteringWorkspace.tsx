import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type CompositionEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { buildLetteringRender, displayDirectionForLanguage } from "@manga/lettering";
import { refitLetteringNow } from "@manga/lettering/refit";
import {
    checkRightsPermission,
    getAdminEpisode,
    getAdminPageImageUrl,
    patchBubbleLettering,
    type BubbleData,
    type BubbleTextLayout,
    type BubbleTextStyle,
    type EpisodeData,
    type PageData,
} from "../api";
import { useTranslation } from "../i18n/I18nProvider";
import { toBoxStyle } from "../lib/structure-review/geometry";
import { bubbleIdOf, panelIdOf } from "../lib/structure-review/ids";

const LETTERING_BLANK_IMAGE_KEYS = ["blank-ja", "blank", "ja-blank"] as const;

type CmsUser = { id: string; role: string };
type AlignValue = "start" | "center" | "end";

type BubbleRef = {
    bubble: BubbleData;
    panelId: string | null;
    readingOrder: number;
};

type LetteringWorkspaceProps = {
    currentUser?: CmsUser | null;
};

function cssTextToStyleObject(cssText: string): CSSProperties {
    const style: Record<string, string> = {};
    for (const declaration of cssText.split(";")) {
        const sep = declaration.indexOf(":");
        if (sep === -1) continue;
        const prop = declaration.slice(0, sep).trim();
        const value = declaration.slice(sep + 1).trim();
        if (!prop || !value) continue;
        const key = prop.startsWith("--")
            ? prop
            : prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
        style[key] = value;
    }
    return style as CSSProperties;
}

function letteringInnerStyle(cssText: string): CSSProperties {
    const style = cssTextToStyleObject(cssText) as Record<string, string>;
    delete style.left;
    delete style.top;
    delete style.width;
    delete style.height;
    return style as CSSProperties;
}

function findLetteringBlankImageKey(page: PageData | null) {
    if (!page) return "";
    for (const key of LETTERING_BLANK_IMAGE_KEYS) {
        if (page.images?.[key]?.trim()) return key;
    }
    return "";
}

function activeBubblesOf(page: PageData | null): BubbleRef[] {
    if (!page) return [];
    const panelBubbles = page.panels.flatMap((panel) =>
        panel.bubbles.map((bubble) => ({
            bubble,
            panelId: panelIdOf(panel),
        })),
    );
    const pageBubbles = (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .map((bubble) => ({ bubble, panelId: null }));
    return [...panelBubbles, ...pageBubbles].map((item, index) => ({
        ...item,
        readingOrder: index + 1,
    }));
}

function patchBubbleInEpisode(episode: EpisodeData, pageIndex: number, bubbleId: string, patch: Partial<BubbleData>): EpisodeData {
    const applyPatch = (bubble: BubbleData) => {
        const next = { ...bubble, ...patch };
        if (patch.textLayout === undefined) delete next.textLayout;
        if (patch.textStyle === undefined) delete next.textStyle;
        return next;
    };
    const pages = episode.pages.map((page, index) => {
        if (index !== pageIndex) return page;
        return {
            ...page,
            bubbles: (page.bubbles ?? []).map((bubble) =>
                bubbleIdOf(bubble) === bubbleId ? applyPatch(bubble) : bubble,
            ),
            panels: page.panels.map((panel) => ({
                ...panel,
                bubbles: panel.bubbles.map((bubble) =>
                    bubbleIdOf(bubble) === bubbleId ? applyPatch(bubble) : bubble,
                ),
            })),
        };
    });
    return { ...episode, pages };
}

function completeTextLayout(current: BubbleTextLayout | undefined, patch: Partial<BubbleTextLayout>): BubbleTextLayout {
    return {
        ...(current ?? {}),
        ...patch,
        source: "manual",
    };
}

function lineTextForEditor(bubble: BubbleData | null, renderedText: string) {
    if (!bubble) return "";
    if (bubble.textLayout?.lines?.length) return bubble.textLayout.lines.join("\n");
    return renderedText.replace(/\u200B/gu, "\n");
}

function linesFromEditorText(value: string) {
    return value
        .replace(/\r\n?/gu, "\n")
        .split("\n")
        .map((line) => line.trimEnd());
}

function editableTextFromElement(element: HTMLElement) {
    return element.innerText
        .replace(/\u00a0/gu, " ")
        .replace(/\r\n?/gu, "\n");
}

function textFromEditorTarget(target: HTMLElement & { value?: string }) {
    if (typeof target.value === "string") return target.value;
    return editableTextFromElement(target);
}

function isEmptyEditorText(value: string) {
    return value.replace(/\s+/gu, "").length === 0;
}

function textLayoutFromEditorText(value: string, current: BubbleTextLayout | undefined): BubbleTextLayout | Record<string, never> {
    if (isEmptyEditorText(value)) return {};
    return completeTextLayout(current, { lines: linesFromEditorText(value) });
}

function numberOrUndefined(value: string) {
    if (!value.trim()) return undefined;
    const next = Number(value);
    return Number.isFinite(next) ? next : undefined;
}

function boundedFontSize(value: number) {
    return Math.max(1, Math.min(160, Math.round(value)));
}

function alignFromRatio(value: number): AlignValue {
    if (value < 1 / 3) return "start";
    if (value > 2 / 3) return "end";
    return "center";
}

export default function LetteringWorkspace({ currentUser }: LetteringWorkspaceProps) {
    const { t } = useTranslation();
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const inlineEditorRef = useRef<HTMLDivElement | null>(null);
    const composingRef = useRef(false);
    const seededEditorKeyRef = useRef("");
    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedBubbleId, setSelectedBubbleId] = useState("");
    const [canManageLettering, setCanManageLettering] = useState(false);
    const [editorText, setEditorText] = useState("");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!seriesId || !epId) return;
        getAdminEpisode(seriesId, epId)
            .then((nextEpisode) => {
                if (!nextEpisode) {
                    setError(t("structure.loadError"));
                    return;
                }
                setEpisode(nextEpisode);
                const firstBubble = activeBubblesOf(nextEpisode.pages[0] ?? null)[0]?.bubble;
                setSelectedBubbleId(firstBubble ? bubbleIdOf(firstBubble) : "");
            })
            .catch((e) => setError((e as Error).message));
    }, [epId, seriesId, t]);

    useEffect(() => {
        let cancelled = false;
        setCanManageLettering(false);
        if (!seriesId || !currentUser) return;
        if (currentUser.role === "admin") {
            setCanManageLettering(true);
            return;
        }
        checkRightsPermission({
            user_id: currentUser.id,
            permission: "manage_rights",
            scope: { series_id: seriesId },
        })
            .then((result) => {
                if (!cancelled) setCanManageLettering(result.allowed);
            })
            .catch(() => {
                if (!cancelled) setCanManageLettering(false);
            });
        return () => {
            cancelled = true;
        };
    }, [currentUser, seriesId]);

    const page = episode?.pages[pageIndex] ?? null;
    const blankKey = findLetteringBlankImageKey(page);
    const imageUrl = seriesId && epId && page && blankKey
        ? getAdminPageImageUrl(seriesId, epId, page.pageNumber, blankKey)
        : "";
    const bubbles = useMemo(() => activeBubblesOf(page), [page]);
    const selectedBubbleRef = bubbles.find((item) => bubbleIdOf(item.bubble) === selectedBubbleId) ?? bubbles[0] ?? null;
    const selectedBubble = selectedBubbleRef?.bubble ?? null;

    const renderForBubble = useCallback((bubble: BubbleData) => {
        if (!page) return null;
        const displayDirection = displayDirectionForLanguage(bubble.textDirection, "ja");
        return buildLetteringRender({
            source: {
                text: bubble.textOriginal ?? "",
                textLayout: bubble.textLayout,
                textStyle: bubble.textStyle,
            },
            bbox: bubble.bbox,
            page: { width: page.width, height: page.height },
            displayDirection,
            addJapaneseSoftBreaks: displayDirection === "vertical",
            spaceAsBreak: false,
        });
    }, [page]);

    useEffect(() => {
        const nextKey = selectedBubble ? `${pageIndex}:${bubbleIdOf(selectedBubble)}` : "";
        if (seededEditorKeyRef.current === nextKey) return;
        seededEditorKeyRef.current = nextKey;
        if (!selectedBubble) {
            setEditorText("");
            setDirty(false);
            setSaved(false);
            return;
        }
        setEditorText(lineTextForEditor(selectedBubble, renderForBubble(selectedBubble)?.text ?? selectedBubble.textOriginal));
        setDirty(false);
        setSaved(false);
    }, [pageIndex, renderForBubble, selectedBubble]);

    useEffect(() => {
        if (!overlayRef.current) return;
        refitLetteringNow(overlayRef.current);
    }, [episode, pageIndex, selectedBubbleId]);

    useEffect(() => {
        const editor = inlineEditorRef.current;
        if (!editor) return;
        if (typeof document !== "undefined" && document.activeElement === editor) return;
        if (editableTextFromElement(editor) !== editorText) {
            editor.innerText = editorText;
        }
    }, [editorText, selectedBubbleId]);

    useEffect(() => {
        const editor = inlineEditorRef.current;
        if (!editor || !canManageLettering) return;
        editor.innerText = editorText;
        requestAnimationFrame(() => editor.focus());
    }, [canManageLettering, pageIndex, selectedBubbleId]);

    const patchSelectedBubble = (patch: Partial<BubbleData>) => {
        if (!episode || !selectedBubble) return;
        setEpisode(patchBubbleInEpisode(episode, pageIndex, bubbleIdOf(selectedBubble), patch));
        setDirty(true);
        setSaved(false);
    };

    const applyEditorText = (value: string) => {
        if (!selectedBubble || !canManageLettering) return;
        if (isEmptyEditorText(value)) {
            patchSelectedBubble({ textLayout: undefined });
            return;
        }
        const lines = linesFromEditorText(value);
        patchSelectedBubble({
            textLayout: completeTextLayout(selectedBubble.textLayout, { lines }),
        });
    };

    const updateTextLayout = (patch: Partial<BubbleTextLayout>) => {
        if (!selectedBubble || !canManageLettering) return;
        patchSelectedBubble({
            textLayout: completeTextLayout(selectedBubble.textLayout, patch),
        });
    };

    const updateTextStyle = (patch: Partial<BubbleTextStyle>) => {
        if (!selectedBubble || !canManageLettering) return;
        patchSelectedBubble({
            textStyle: { ...(selectedBubble.textStyle ?? {}), ...patch },
        });
    };

    const snapSelectedBubbleAlign = (event: MouseEvent<HTMLElement>, bubble: BubbleData) => {
        if (!canManageLettering || bubbleIdOf(bubble) !== selectedBubbleId) return;
        if (event.target instanceof HTMLElement && event.target.closest("[data-lettering-inline-editor]")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
        const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        const displayDirection = displayDirectionForLanguage(bubble.textDirection, "ja");
        if (displayDirection === "vertical") {
            updateTextLayout({
                inlineAlign: alignFromRatio(yRatio),
                blockAlign: xRatio < 1 / 3 ? "end" : xRatio > 2 / 3 ? "start" : "center",
            });
            return;
        }
        updateTextLayout({
            inlineAlign: alignFromRatio(xRatio),
            blockAlign: alignFromRatio(yRatio),
        });
    };

    const resetSelectedBubble = () => {
        if (!selectedBubble || !canManageLettering) return;
        patchSelectedBubble({ textLayout: undefined, textStyle: undefined });
        setEditorText(selectedBubble.textOriginal);
    };

    const saveSelectedBubble = async () => {
        if (!seriesId || !episode || !page || !selectedBubble || !canManageLettering) return false;
        const nextTextLayout = textLayoutFromEditorText(editorText, selectedBubble.textLayout);
        setSaving(true);
        setError("");
        try {
            const nextEpisode = await patchBubbleLettering(seriesId, episode.id, page.pageId ?? page.id, bubbleIdOf(selectedBubble), {
                textLayout: nextTextLayout,
                textStyle: selectedBubble.textStyle ?? {},
            });
            setEpisode(nextEpisode);
            setDirty(false);
            setSaved(true);
            return true;
        } catch (e) {
            setError((e as Error).message);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const flushPendingEdit = async () => {
        if (!dirty) return true;
        if (saving || composingRef.current) return false;
        return saveSelectedBubble();
    };

    const selectBubble = async (bubbleId: string) => {
        if (bubbleId === selectedBubbleId) return;
        if (!(await flushPendingEdit())) return;
        setSelectedBubbleId(bubbleId);
    };

    const onEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!composingRef.current) {
                applyEditorText(editorText);
                void saveSelectedBubble();
            }
        }
    };

    const onCompositionStart = (_event: CompositionEvent<HTMLElement>) => {
        composingRef.current = true;
    };

    const onCompositionEnd = (event: CompositionEvent<HTMLElement>) => {
        composingRef.current = false;
        applyEditorText(textFromEditorTarget(event.currentTarget));
    };

    const selectPage = async (nextIndex: number) => {
        if (nextIndex === pageIndex) return;
        if (!(await flushPendingEdit())) return;
        setPageIndex(nextIndex);
        const nextBubble = activeBubblesOf(episode?.pages[nextIndex] ?? null)[0]?.bubble;
        setSelectedBubbleId(nextBubble ? bubbleIdOf(nextBubble) : "");
    };

    if (!episode) {
        return (
            <div className="lettering-workspace">
                <p className={error ? "error-msg" : ""}>{error || t("common.loading")}</p>
            </div>
        );
    }

    return (
        <div className="lettering-workspace">
            <div className="lettering-workspace-header">
                <div>
                    <h1>{t("lettering.workspace.title")}</h1>
                    <p className="card-meta">{episode.title} · ja</p>
                </div>
                <div className="section-actions">
                    {dirty && <span className="badge badge-warn">{t("lettering.workspace.unsaved")}</span>}
                    <Link to={`/works/${seriesId}/episodes/${epId}/structure`} className="btn btn-outline">
                        {t("lettering.workspace.backToStructure")}
                    </Link>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {!canManageLettering && (
                <div className="info-msg">{t("lettering.workspace.readOnly")}</div>
            )}

            <div className="lettering-workspace-layout">
                <aside className="lettering-page-strip card">
                    <h2>{t("lettering.workspace.pages")}</h2>
                    {episode.pages.map((item, index) => (
                        <button
                            type="button"
                            key={item.pageId ?? item.id}
                            className={`lettering-page-button ${index === pageIndex ? "is-active" : ""}`}
                            onClick={() => void selectPage(index)}
                        >
                            <span>{item.displayRef ?? `p${item.pageNumber}`}</span>
                            <span className="badge">{activeBubblesOf(item).length}</span>
                        </button>
                    ))}
                </aside>

                <section className="lettering-preview-card card">
                    {!page ? (
                        <div className="empty-state">{t("lettering.workspace.noPage")}</div>
                    ) : !imageUrl ? (
                        <div className="structure-image-placeholder" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
                            {t("structure.lettering.blankImageMissing")}
                        </div>
                    ) : (
                        <div className="lettering-canvas" ref={overlayRef}>
                            <img src={imageUrl} alt={t("structure.canvas.pageAlt", { pageNumber: page.pageNumber })} draggable={false} />
                            <div className="lettering-canvas-overlay">
                                {bubbles.map(({ bubble, readingOrder }) => {
                                    const render = renderForBubble(bubble);
                                    if (!render || !page) return null;
                                    const bubbleId = bubbleIdOf(bubble);
                                    const selected = bubbleId === selectedBubbleId;
                                    const displayDirection = displayDirectionForLanguage(bubble.textDirection, "ja");
                                    return (
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            key={bubbleId}
                                            className={`lettering-bubble-hit ${selected ? "is-selected" : ""}`}
                                            style={toBoxStyle(bubble.bbox, page)}
                                            onClick={(event) => {
                                                if (selected) {
                                                    snapSelectedBubbleAlign(event, bubble);
                                                } else {
                                                    void selectBubble(bubbleId);
                                                }
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    void selectBubble(bubbleId);
                                                }
                                            }}
                                            title={`${bubble.displayRef ?? bubble.shortId ?? readingOrder}: ${bubble.textOriginal}`}
                                        >
                                            {selected && canManageLettering ? (
                                                <div
                                                    ref={inlineEditorRef}
                                                    className={`lettering-inline-editor ${displayDirection === "vertical" ? "is-vertical" : "is-horizontal"}`}
                                                    contentEditable="plaintext-only"
                                                    role="textbox"
                                                    aria-multiline="true"
                                                    data-lettering-inline-editor
                                                    suppressContentEditableWarning
                                                    onInput={(event) => {
                                                        const nextText = editableTextFromElement(event.currentTarget);
                                                        setEditorText(nextText);
                                                        if (!composingRef.current) applyEditorText(nextText);
                                                    }}
                                                    onBlur={(event) => {
                                                        if (!composingRef.current) applyEditorText(editableTextFromElement(event.currentTarget));
                                                    }}
                                                    onKeyDown={onEditorKeyDown}
                                                    onCompositionStart={onCompositionStart}
                                                    onCompositionEnd={onCompositionEnd}
                                                    aria-label={t("lettering.workspace.inlineEditorLabel")}
                                                />
                                            ) : (
                                                <span
                                                    className={`lettering-preview-bubble ${displayDirection === "vertical" ? "is-vertical" : "is-horizontal"}`}
                                                    data-overlay-bubble
                                                    data-fit-mode={render.fitMode}
                                                    data-fit-characters={render.fit.characterCount}
                                                    data-inline-align={render.inlineAlign}
                                                    data-block-align={render.blockAlign}
                                                    style={letteringInnerStyle(render.style)}
                                                >
                                                    <span data-overlay-bubble-text>{render.text}</span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>

                <aside className="lettering-inspector card">
                    <h2>{t("lettering.workspace.inspector")}</h2>
                    {!selectedBubble ? (
                        <p className="card-meta">{t("structure.inspector.selectBubble")}</p>
                    ) : (
                        <>
                            <div className="canonical-bubble-header">
                                <span className="badge">{selectedBubble.displayRef ?? selectedBubble.shortId ?? bubbleIdOf(selectedBubble)}</span>
                                <span className="badge">{selectedBubble.bubbleType}</span>
                            </div>
                            <div className="form-group">
                                <label>{t("structure.lettering.lines")}</label>
                                <textarea
                                    value={editorText}
                                    disabled={!canManageLettering}
                                    onChange={(event) => {
                                        setEditorText(event.target.value);
                                        if (!composingRef.current) applyEditorText(event.target.value);
                                    }}
                                    onBlur={(event) => {
                                        if (!composingRef.current) applyEditorText(event.currentTarget.value);
                                    }}
                                    onKeyDown={onEditorKeyDown}
                                    onCompositionStart={onCompositionStart}
                                    onCompositionEnd={onCompositionEnd}
                                />
                                <small>{t("structure.lettering.linesHelp")}</small>
                            </div>

                            <div className="form-group">
                                <label>{t("lettering.workspace.anchor")}</label>
                                <div className="lettering-anchor-grid">
                                    {(["start", "center", "end"] as const).map((blockAlign) =>
                                        (["start", "center", "end"] as const).map((inlineAlign) => (
                                            <button
                                                type="button"
                                                key={`${blockAlign}-${inlineAlign}`}
                                                className={selectedBubble.textLayout?.blockAlign === blockAlign && selectedBubble.textLayout?.inlineAlign === inlineAlign ? "is-active" : ""}
                                                disabled={!canManageLettering}
                                                onClick={() => updateTextLayout({ blockAlign, inlineAlign })}
                                                aria-label={`${blockAlign} ${inlineAlign}`}
                                            />
                                        )),
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fontSizePx")}</label>
                                <input
                                    type="range"
                                    min={8}
                                    max={96}
                                    value={selectedBubble.textStyle?.fontSizePx ?? 28}
                                    disabled={!canManageLettering}
                                    onChange={(event) => updateTextStyle({ fontSizePx: boundedFontSize(Number(event.target.value)), fitMode: "shrink" })}
                                />
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedBubble.textStyle?.fontSizePx ?? ""}
                                    disabled={!canManageLettering}
                                    onChange={(event) => updateTextStyle({ fontSizePx: numberOrUndefined(event.target.value), fitMode: event.target.value ? "shrink" : undefined })}
                                />
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fontWeight")}</label>
                                <select
                                    value={selectedBubble.textStyle?.fontWeight ?? ""}
                                    disabled={!canManageLettering}
                                    onChange={(event) => updateTextStyle({ fontWeight: numberOrUndefined(event.target.value) })}
                                >
                                    <option value="">{t("structure.lettering.auto")}</option>
                                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
                                        <option key={weight} value={weight}>{weight}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bubble-field-grid">
                                <div className="form-group">
                                    <label>{t("structure.lettering.lineHeight")}</label>
                                    <input
                                        type="number"
                                        min={0.1}
                                        step="0.05"
                                        value={selectedBubble.textStyle?.lineHeight ?? ""}
                                        disabled={!canManageLettering}
                                        onChange={(event) => updateTextStyle({ lineHeight: numberOrUndefined(event.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t("structure.lettering.letterSpacing")}</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={selectedBubble.textStyle?.letterSpacing ?? ""}
                                        disabled={!canManageLettering}
                                        onChange={(event) => updateTextStyle({ letterSpacing: numberOrUndefined(event.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fitMode")}</label>
                                <select
                                    value={selectedBubble.textStyle?.fitMode ?? "auto"}
                                    disabled={!canManageLettering}
                                    onChange={(event) => updateTextStyle({ fitMode: event.target.value as BubbleTextStyle["fitMode"] })}
                                >
                                    <option value="auto">auto</option>
                                    <option value="shrink">shrink</option>
                                    <option value="fixed">fixed</option>
                                </select>
                            </div>

                            <div className="section-actions">
                                <button type="button" className="btn btn-outline" disabled={!canManageLettering} onClick={resetSelectedBubble}>
                                    {t("lettering.workspace.resetAuto")}
                                </button>
                                <button type="button" className="btn btn-primary" disabled={!canManageLettering || saving || !dirty} onClick={saveSelectedBubble}>
                                    {saving ? t("structure.lettering.saving") : t("structure.lettering.save")}
                                </button>
                            </div>
                            {saved && <div className="success-msg">{t("structure.lettering.saved")}</div>}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
