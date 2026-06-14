import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type CompositionEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { buildLetteringRender, displayDirectionForLanguage } from "@manga/lettering";
import { refitLetteringNow, startLetteringRefit } from "@manga/lettering/refit";
import {
    checkRightsPermission,
    getAdminEpisode,
    getAdminPageImageUrl,
    listPackDrafts,
    patchBubbleLettering,
    patchPackDraftEntryLettering,
    type BubbleData,
    type BubbleTextLayout,
    type BubbleTextStyle,
    type EpisodeData,
    type PackDraftEntry,
    type PackDraftRecord,
    type PageData,
} from "../api";
import { useTranslation } from "../i18n/I18nProvider";
import { toBoxStyle } from "../lib/structure-review/geometry";
import { bubbleIdOf, panelIdOf } from "../lib/structure-review/ids";

const LETTERING_BLANK_IMAGE_KEYS = ["blank-ja", "blank", "ja-blank"] as const;

type CmsUser = { id: string; role: string };
type AlignValue = "start" | "center" | "end";
type LetteringLanguage = "ja" | string;

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

function isEditableTranslationDraft(draft: PackDraftRecord) {
    return draft.type === "TRANSLATION" && (draft.status === "draft" || draft.status === "in_review");
}

function draftEntryForBubble(draft: PackDraftRecord | null, bubbleId: string, lang: string): PackDraftEntry | null {
    return draft?.entries.find((entry) => entry.lang === lang && entry.target.bubble_id === bubbleId) ?? null;
}

function patchBubbleInEpisode(episode: EpisodeData, pageIndex: number, bubbleId: string, patch: Partial<BubbleData>): EpisodeData {
    const applyPatch = (bubble: BubbleData) => {
        const next = { ...bubble, ...patch };
        if ("textLayout" in patch && patch.textLayout === undefined) delete next.textLayout;
        if ("textStyle" in patch && patch.textStyle === undefined) delete next.textStyle;
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

function patchPackDraftEntryInRecord(draft: PackDraftRecord, entryId: string, patch: Partial<Pick<PackDraftEntry, "text_layout" | "text_style">>): PackDraftRecord {
    return {
        ...draft,
        entries: draft.entries.map((entry) => {
            if (entry.entry_id !== entryId) return entry;
            const next = { ...entry };
            if ("text_layout" in patch) {
                if (patch.text_layout !== undefined) next.text_layout = patch.text_layout;
                else delete next.text_layout;
            }
            if ("text_style" in patch) {
                if (patch.text_style !== undefined) next.text_style = patch.text_style;
                else delete next.text_style;
            }
            return next;
        }),
    };
}

function completeTextLayout(current: BubbleTextLayout | undefined, patch: Partial<BubbleTextLayout>): BubbleTextLayout {
    return {
        ...(current ?? {}),
        ...patch,
        source: "manual",
    };
}

function lineTextForLetteringSource(textLayout: BubbleTextLayout | undefined, renderedText: string) {
    if (textLayout?.lines?.length) return textLayout.lines.join("\n");
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

function alignRatio(value: AlignValue | undefined) {
    if (value === "center") return 50;
    if (value === "end") return 88;
    return 12;
}

function clampOffsetPercent(value: number) {
    return Math.max(-100, Math.min(100, Math.round(value * 10) / 10));
}

function visualAnchorBasePercent(bubble: BubbleData, lang: string, textLayout: BubbleTextLayout | undefined = bubble.textLayout): { x: number; y: number } {
    const inlineAlign = textLayout?.inlineAlign;
    const blockAlign = textLayout?.blockAlign;
    if (displayDirectionForLanguage(bubble.textDirection, lang) === "vertical") {
        return {
            x: blockAlign === "start" ? 88 : blockAlign === "center" ? 50 : 12,
            y: alignRatio(inlineAlign),
        };
    }
    return {
        x: alignRatio(inlineAlign),
        y: alignRatio(blockAlign),
    };
}

function anchorHandleStyle(bubble: BubbleData, lang: string, textLayout: BubbleTextLayout | undefined): CSSProperties {
    const base = visualAnchorBasePercent(bubble, lang);
    const offsetX = textLayout?.offsetXPercent ?? 0;
    const offsetY = textLayout?.offsetYPercent ?? 0;
    return {
        left: `calc(${base.x}% + ${offsetX}%)`,
        top: `calc(${base.y}% + ${offsetY}%)`,
    };
}

function insertTextAtSelection(text: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

export default function LetteringWorkspace({ currentUser }: LetteringWorkspaceProps) {
    const { t } = useTranslation();
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const inlineEditorRef = useRef<HTMLDivElement | null>(null);
    const composingRef = useRef(false);
    const seededEditorKeyRef = useRef("");
    const editorDomKeyRef = useRef("");
    const editorDomTextRef = useRef("");
    const editorTextRef = useRef("");
    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [packDrafts, setPackDrafts] = useState<PackDraftRecord[]>([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedBubbleId, setSelectedBubbleId] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState<LetteringLanguage>("ja");
    const [canManageLettering, setCanManageLettering] = useState(false);
    const [editorText, setEditorText] = useState("");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [resetToAutoBubbleId, setResetToAutoBubbleId] = useState("");
    const [editorActive, setEditorActive] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [draggingAnchorBubbleId, setDraggingAnchorBubbleId] = useState("");

    const setEditorTextValue = (value: string) => {
        editorTextRef.current = value;
        setEditorText(value);
    };

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
        setPackDrafts([]);
        if (!seriesId || !epId) return;
        listPackDrafts({ type: "TRANSLATION", seriesId })
            .then((items) => {
                if (cancelled) return;
                setPackDrafts(items.filter((draft) =>
                    draft.target_series_id === seriesId
                    && (!draft.target_episode_id || draft.target_episode_id === epId)
                    && isEditableTranslationDraft(draft)
                    && Boolean(draft.language),
                ));
            })
            .catch(() => {
                if (!cancelled) setPackDrafts([]);
            });
        return () => {
            cancelled = true;
        };
    }, [epId, seriesId]);

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
    const translationDrafts = useMemo(() => packDrafts.filter((draft) => draft.language), [packDrafts]);
    const languageOptions = useMemo(() => {
        const seen = new Set<string>(["ja"]);
        const options = [{ lang: "ja", label: "日本語", draft: null as PackDraftRecord | null }];
        for (const draft of translationDrafts) {
            const lang = draft.language;
            if (!lang || seen.has(lang)) continue;
            seen.add(lang);
            options.push({ lang, label: lang, draft });
        }
        return options;
    }, [translationDrafts]);
    const selectedTranslationDraft = selectedLanguage === "ja"
        ? null
        : translationDrafts.find((draft) => draft.language === selectedLanguage) ?? null;
    const selectedPackEntry = selectedBubble && selectedLanguage !== "ja"
        ? draftEntryForBubble(selectedTranslationDraft, bubbleIdOf(selectedBubble), selectedLanguage)
        : null;
    const canEditSelectedSource = canManageLettering && (selectedLanguage === "ja" || Boolean(selectedTranslationDraft && selectedPackEntry));
    const selectedTextLayout = selectedLanguage === "ja" ? selectedBubble?.textLayout : selectedPackEntry?.text_layout;
    const selectedTextStyle = selectedLanguage === "ja" ? selectedBubble?.textStyle : selectedPackEntry?.text_style;
    const selectedSourceText = selectedLanguage === "ja" ? selectedBubble?.textOriginal ?? "" : selectedPackEntry?.text ?? "";

    const renderForBubble = useCallback((bubble: BubbleData) => {
        if (!page) return null;
        const lang = selectedLanguage;
        const entry = lang === "ja" ? null : draftEntryForBubble(selectedTranslationDraft, bubbleIdOf(bubble), lang);
        const displayDirection = displayDirectionForLanguage(bubble.textDirection, lang);
        return buildLetteringRender({
            source: {
                text: lang === "ja" ? bubble.textOriginal ?? "" : entry?.text ?? "",
                textLayout: lang === "ja" ? bubble.textLayout : entry?.text_layout,
                textStyle: lang === "ja" ? bubble.textStyle : entry?.text_style,
            },
            bbox: bubble.bbox,
            page: { width: page.width, height: page.height },
            displayDirection,
            addJapaneseSoftBreaks: displayDirection === "vertical",
            spaceAsBreak: false,
        });
    }, [page, selectedLanguage, selectedTranslationDraft]);

    useEffect(() => {
        const nextKey = selectedBubble ? `${selectedLanguage}:${pageIndex}:${bubbleIdOf(selectedBubble)}` : "";
        if (seededEditorKeyRef.current === nextKey) return;
        seededEditorKeyRef.current = nextKey;
        if (!selectedBubble) {
            setEditorTextValue("");
            setDirty(false);
            setSaved(false);
            setResetToAutoBubbleId("");
            setEditorActive(false);
            composingRef.current = false;
            setIsComposing(false);
            return;
        }
        setEditorTextValue(lineTextForLetteringSource(selectedTextLayout, renderForBubble(selectedBubble)?.text ?? selectedSourceText));
        setDirty(false);
        setSaved(false);
        setResetToAutoBubbleId("");
        setEditorActive(false);
        composingRef.current = false;
        setIsComposing(false);
    }, [pageIndex, renderForBubble, selectedBubble, selectedLanguage, selectedSourceText, selectedTextLayout]);

    useEffect(() => {
        if (!overlayRef.current) return;
        refitLetteringNow(overlayRef.current);
    }, [editorActive, episode, isComposing, pageIndex, selectedBubbleId]);

    useEffect(() => {
        if (!overlayRef.current) return;
        return startLetteringRefit(overlayRef.current);
    }, [episode?.id, pageIndex]);

    useLayoutEffect(() => {
        const editor = inlineEditorRef.current;
        if (!editor) return;
        const nextKey = selectedBubble ? `${selectedLanguage}:${pageIndex}:${bubbleIdOf(selectedBubble)}` : "";
        const isNewSelection = editorDomKeyRef.current !== nextKey;
        const editorHasFocus = typeof document !== "undefined" && document.activeElement === editor;
        const editorTextChangedOutsideDom = editorDomTextRef.current !== editorText;
        if (!isNewSelection && editorHasFocus && !editorTextChangedOutsideDom) return;
        const currentDomText = editableTextFromElement(editor);
        if (currentDomText !== editorText) {
            editor.innerText = editorText;
            if (!editorHasFocus) {
                requestAnimationFrame(() => {
                    if (overlayRef.current) refitLetteringNow(overlayRef.current);
                });
            }
        }
        editorDomKeyRef.current = nextKey;
        editorDomTextRef.current = editorText;
    }, [editorText, pageIndex, selectedBubble]);

    useEffect(() => {
        const editor = inlineEditorRef.current;
        if (!editor || !canEditSelectedSource) return;
        requestAnimationFrame(() => editor.focus());
    }, [canEditSelectedSource, pageIndex, selectedBubbleId, selectedLanguage]);

    const patchSelectedBubble = (patch: Partial<BubbleData>) => {
        if (!episode || !selectedBubble) return;
        setEpisode(patchBubbleInEpisode(episode, pageIndex, bubbleIdOf(selectedBubble), patch));
        setDirty(true);
        setSaved(false);
    };

    const patchSelectedTranslationEntry = (patch: { textLayout?: BubbleTextLayout; textStyle?: BubbleTextStyle }) => {
        if (!selectedTranslationDraft || !selectedPackEntry) return;
        const entryPatch: Partial<Pick<PackDraftEntry, "text_layout" | "text_style">> = {};
        if ("textLayout" in patch) entryPatch.text_layout = patch.textLayout;
        if ("textStyle" in patch) entryPatch.text_style = patch.textStyle;
        const nextDraft = patchPackDraftEntryInRecord(selectedTranslationDraft, selectedPackEntry.entry_id, entryPatch);
        setPackDrafts((drafts) => drafts.map((draft) => draft.pack_draft_id === nextDraft.pack_draft_id ? nextDraft : draft));
        setDirty(true);
        setSaved(false);
    };

    const patchSelectedLettering = (patch: { textLayout?: BubbleTextLayout; textStyle?: BubbleTextStyle }) => {
        if (selectedLanguage === "ja") {
            const bubblePatch: Partial<BubbleData> = {};
            if ("textLayout" in patch) bubblePatch.textLayout = patch.textLayout;
            if ("textStyle" in patch) bubblePatch.textStyle = patch.textStyle;
            patchSelectedBubble(bubblePatch);
            return;
        }
        patchSelectedTranslationEntry(patch);
    };

    const applyEditorText = (value: string) => {
        if (!selectedBubble || !canEditSelectedSource) return;
        setResetToAutoBubbleId("");
        if (isEmptyEditorText(value)) {
            patchSelectedLettering({ textLayout: undefined });
            return;
        }
        const lines = linesFromEditorText(value);
        patchSelectedLettering({ textLayout: completeTextLayout(selectedTextLayout, { lines }) });
    };

    const updateTextLayout = (patch: Partial<BubbleTextLayout>) => {
        if (!selectedBubble || !canEditSelectedSource) return;
        setResetToAutoBubbleId("");
        patchSelectedLettering({ textLayout: completeTextLayout(selectedTextLayout, patch) });
    };

    const updateTextStyle = (patch: Partial<BubbleTextStyle>) => {
        if (!selectedBubble || !canEditSelectedSource) return;
        setResetToAutoBubbleId("");
        patchSelectedLettering({ textStyle: { ...(selectedTextStyle ?? {}), ...patch } });
    };

    const updateSelectedBubbleOffsetAtPoint = (clientX: number, clientY: number, bubble: BubbleData, rect: DOMRect) => {
        if (!canEditSelectedSource || bubbleIdOf(bubble) !== selectedBubbleId) return;
        const xPercent = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
        const yPercent = ((clientY - rect.top) / Math.max(rect.height, 1)) * 100;
        const base = visualAnchorBasePercent(bubble, selectedLanguage, selectedTextLayout);
        updateTextLayout({
            offsetXPercent: clampOffsetPercent(xPercent - base.x),
            offsetYPercent: clampOffsetPercent(yPercent - base.y),
        });
    };

    const moveSelectedBubbleOffset = (event: MouseEvent<HTMLElement>, bubble: BubbleData) => {
        if (event.target instanceof HTMLElement && event.target.closest("[data-lettering-inline-editor], [data-lettering-anchor-handle]")) return;
        updateSelectedBubbleOffsetAtPoint(event.clientX, event.clientY, bubble, event.currentTarget.getBoundingClientRect());
    };

    const dragSelectedBubbleOffset = (event: PointerEvent<HTMLElement>, bubble: BubbleData) => {
        const hit = event.currentTarget.closest<HTMLElement>("[data-lettering-bubble-hit]");
        if (!hit) return;
        updateSelectedBubbleOffsetAtPoint(event.clientX, event.clientY, bubble, hit.getBoundingClientRect());
    };

    const resetSelectedBubble = () => {
        if (!selectedBubble || !canEditSelectedSource) return;
        setResetToAutoBubbleId(bubbleIdOf(selectedBubble));
        patchSelectedLettering({ textLayout: undefined, textStyle: undefined });
        setEditorTextValue(renderForBubble(selectedBubble)?.text ?? selectedSourceText);
    };

    const saveSelectedBubble = async () => {
        if (!seriesId || !episode || !page || !selectedBubble || !canEditSelectedSource) return false;
        const isResettingToAuto = resetToAutoBubbleId === bubbleIdOf(selectedBubble);
        const nextTextLayout = isResettingToAuto
            ? {}
            : textLayoutFromEditorText(editorTextRef.current, selectedTextLayout);
        setSaving(true);
        setError("");
        try {
            if (selectedLanguage === "ja") {
                const nextEpisode = await patchBubbleLettering(seriesId, episode.id, page.pageId ?? page.id, bubbleIdOf(selectedBubble), {
                    textLayout: nextTextLayout,
                    textStyle: isResettingToAuto ? {} : selectedTextStyle ?? {},
                });
                setEpisode(nextEpisode);
            } else {
                if (!selectedTranslationDraft || !selectedPackEntry) return false;
                const result = await patchPackDraftEntryLettering(selectedTranslationDraft.pack_draft_id, selectedPackEntry.entry_id, {
                    textLayout: nextTextLayout,
                    textStyle: isResettingToAuto ? {} : selectedTextStyle ?? {},
                });
                setPackDrafts((drafts) => drafts.map((draft) => draft.pack_draft_id === result.record.pack_draft_id ? result.record : draft));
            }
            setDirty(false);
            setSaved(true);
            setResetToAutoBubbleId("");
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
        setEditorActive(false);
        composingRef.current = false;
        setIsComposing(false);
        setDraggingAnchorBubbleId("");
        setSelectedBubbleId(bubbleId);
    };

    const onEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" && event.currentTarget.isContentEditable && !composingRef.current) {
            event.preventDefault();
            if (insertTextAtSelection("\n")) {
                const nextText = editableTextFromElement(event.currentTarget);
                editorDomTextRef.current = nextText;
                setEditorTextValue(nextText);
                setResetToAutoBubbleId("");
                setDirty(true);
                setSaved(false);
            }
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!composingRef.current) {
                applyEditorText(textFromEditorTarget(event.currentTarget));
                void saveSelectedBubble();
            }
        }
    };

    const onCompositionStart = (_event: CompositionEvent<HTMLElement>) => {
        composingRef.current = true;
        setIsComposing(true);
    };

    const onCompositionEnd = (event: CompositionEvent<HTMLElement>) => {
        composingRef.current = false;
        setIsComposing(false);
        applyEditorText(textFromEditorTarget(event.currentTarget));
        requestAnimationFrame(() => {
            if (overlayRef.current) refitLetteringNow(overlayRef.current);
        });
    };

    const selectPage = async (nextIndex: number) => {
        if (nextIndex === pageIndex) return;
        if (!(await flushPendingEdit())) return;
        setEditorActive(false);
        composingRef.current = false;
        setIsComposing(false);
        setDraggingAnchorBubbleId("");
        setPageIndex(nextIndex);
        const nextBubble = activeBubblesOf(episode?.pages[nextIndex] ?? null)[0]?.bubble;
        setSelectedBubbleId(nextBubble ? bubbleIdOf(nextBubble) : "");
    };

    const selectLanguage = async (lang: string) => {
        if (lang === selectedLanguage) return;
        if (!(await flushPendingEdit())) return;
        setEditorActive(false);
        composingRef.current = false;
        setIsComposing(false);
        setDraggingAnchorBubbleId("");
        setSelectedLanguage(lang);
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
                    <p className="card-meta">{episode.title} · {selectedLanguage}</p>
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
            {languageOptions.length > 1 && (
                <div className="lettering-language-tabs card">
                    {languageOptions.map((option) => (
                        <button
                            key={option.lang}
                            type="button"
                            className={selectedLanguage === option.lang ? "is-active" : ""}
                            onClick={() => void selectLanguage(option.lang)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
            {selectedLanguage !== "ja" && !selectedTranslationDraft && (
                <div className="info-msg">この言語のTranslation Pack Draftがありません。</div>
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
                                    const entry = selectedLanguage === "ja" ? null : draftEntryForBubble(selectedTranslationDraft, bubbleId, selectedLanguage);
                                    const bubbleTextLayout = selectedLanguage === "ja" ? bubble.textLayout : entry?.text_layout;
                                    const displayDirection = displayDirectionForLanguage(bubble.textDirection, selectedLanguage);
                                    const editable = selected && canEditSelectedSource;
                                    const skipRefit = editable && (editorActive || isComposing);
                                    return (
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            key={bubbleId}
                                            className={`lettering-bubble-hit ${selected ? "is-selected" : ""}`}
                                            style={toBoxStyle(bubble.bbox, page)}
                                                    onClick={(event) => {
                                                        if (selected) {
                                                    moveSelectedBubbleOffset(event, bubble);
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
                                            <span
                                                className={`lettering-preview-bubble ${editable ? "is-editing" : ""} ${displayDirection === "vertical" ? "is-vertical" : "is-horizontal"}`}
                                                data-overlay-bubble
                                                data-fit-mode={render.fitMode}
                                                data-fit-characters={render.fit.characterCount}
                                                data-inline-align={render.inlineAlign}
                                                data-block-align={render.blockAlign}
                                                data-overlay-refit-skip={skipRefit ? "true" : undefined}
                                                style={letteringInnerStyle(render.style)}
                                            >
                                                {editable ? (
                                                    <span
                                                        ref={inlineEditorRef}
                                                        className="lettering-inline-editor"
                                                        contentEditable="plaintext-only"
                                                        role="textbox"
                                                        aria-multiline="true"
                                                        data-overlay-bubble-text
                                                        data-lettering-inline-editor
                                                        suppressContentEditableWarning
                                                        onInput={(event) => {
                                                            const nextText = editableTextFromElement(event.currentTarget);
                                                            editorDomTextRef.current = nextText;
                                                            setEditorTextValue(nextText);
                                                            setResetToAutoBubbleId("");
                                                            setDirty(true);
                                                            setSaved(false);
                                                        }}
                                                        onFocus={() => setEditorActive(true)}
                                                        onBlur={(event) => {
                                                            setEditorActive(false);
                                                            if (!composingRef.current) applyEditorText(editableTextFromElement(event.currentTarget));
                                                            requestAnimationFrame(() => {
                                                                if (overlayRef.current) refitLetteringNow(overlayRef.current);
                                                            });
                                                        }}
                                                        onKeyDown={onEditorKeyDown}
                                                        onCompositionStart={onCompositionStart}
                                                        onCompositionEnd={onCompositionEnd}
                                                        aria-label={t("lettering.workspace.inlineEditorLabel")}
                                                        spellCheck={false}
                                                    />
                                                ) : (
                                                    <span data-overlay-bubble-text>{render.text}</span>
                                                )}
                                            </span>
                                            {editable && (
                                                <span
                                                    className={`lettering-position-handle ${draggingAnchorBubbleId === bubbleId ? "is-dragging" : ""}`}
                                                    data-lettering-anchor-handle
                                                    role="slider"
                                                    tabIndex={0}
                                                    aria-label={t("lettering.workspace.positionHandle")}
                                                    aria-valuetext={`${bubbleTextLayout?.blockAlign ?? "start"} ${bubbleTextLayout?.inlineAlign ?? "start"} ${bubbleTextLayout?.offsetXPercent ?? 0} ${bubbleTextLayout?.offsetYPercent ?? 0}`}
                                                    style={anchorHandleStyle(bubble, selectedLanguage, bubbleTextLayout)}
                                                    onPointerDown={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        event.currentTarget.setPointerCapture(event.pointerId);
                                                        setDraggingAnchorBubbleId(bubbleId);
                                                        dragSelectedBubbleOffset(event, bubble);
                                                    }}
                                                    onPointerMove={(event) => {
                                                        if (draggingAnchorBubbleId !== bubbleId) return;
                                                        event.preventDefault();
                                                        dragSelectedBubbleOffset(event, bubble);
                                                    }}
                                                    onPointerUp={(event) => {
                                                        event.preventDefault();
                                                        dragSelectedBubbleOffset(event, bubble);
                                                        setDraggingAnchorBubbleId("");
                                                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                            event.currentTarget.releasePointerCapture(event.pointerId);
                                                        }
                                                    }}
                                                    onPointerCancel={() => setDraggingAnchorBubbleId("")}
                                                />
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
                                <span className="badge">{selectedLanguage}</span>
                            </div>
                            {selectedLanguage !== "ja" && !selectedPackEntry && (
                                <div className="info-msg">このフキダシには {selectedLanguage} のTranslation Pack Draft entry がありません。Translation import後に写植できます。</div>
                            )}
                            <div className="form-group">
                                <label>{t("structure.lettering.lines")}</label>
                                <textarea
                                    value={editorText}
                                    disabled={!canEditSelectedSource}
                                    onChange={(event) => {
                                        setEditorTextValue(event.target.value);
                                        setResetToAutoBubbleId("");
                                        setDirty(true);
                                        setSaved(false);
                                    }}
                                    onFocus={() => setEditorActive(true)}
                                    onBlur={(event) => {
                                        setEditorActive(false);
                                        if (!composingRef.current) applyEditorText(event.currentTarget.value);
                                        requestAnimationFrame(() => {
                                            if (overlayRef.current) refitLetteringNow(overlayRef.current);
                                        });
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
                                                className={selectedTextLayout?.blockAlign === blockAlign && selectedTextLayout?.inlineAlign === inlineAlign ? "is-active" : ""}
                                                disabled={!canEditSelectedSource}
                                                onClick={() => updateTextLayout({ blockAlign, inlineAlign, offsetXPercent: 0, offsetYPercent: 0 })}
                                                aria-label={`${blockAlign} ${inlineAlign}`}
                                            />
                                        )),
                                    )}
                                </div>
                            </div>

                            <div className="bubble-field-grid">
                                <div className="form-group">
                                    <label>{t("structure.lettering.offsetXPercent")}</label>
                                    <input
                                        type="number"
                                        min={-100}
                                        max={100}
                                        step={0.5}
                                        value={selectedTextLayout?.offsetXPercent ?? 0}
                                        disabled={!canEditSelectedSource}
                                        onChange={(event) => updateTextLayout({ offsetXPercent: clampOffsetPercent(Number(event.target.value)) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t("structure.lettering.offsetYPercent")}</label>
                                    <input
                                        type="number"
                                        min={-100}
                                        max={100}
                                        step={0.5}
                                        value={selectedTextLayout?.offsetYPercent ?? 0}
                                        disabled={!canEditSelectedSource}
                                        onChange={(event) => updateTextLayout({ offsetYPercent: clampOffsetPercent(Number(event.target.value)) })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fontSizePx")}</label>
                                <input
                                    type="range"
                                    min={8}
                                    max={96}
                                    value={selectedTextStyle?.fontSizePx ?? 28}
                                    disabled={!canEditSelectedSource}
                                    onChange={(event) => updateTextStyle({ fontSizePx: boundedFontSize(Number(event.target.value)), fitMode: "fixed" })}
                                />
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedTextStyle?.fontSizePx ?? ""}
                                    disabled={!canEditSelectedSource}
                                    onChange={(event) => updateTextStyle({ fontSizePx: numberOrUndefined(event.target.value), fitMode: event.target.value ? "fixed" : undefined })}
                                />
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fontWeight")}</label>
                                <select
                                    value={selectedTextStyle?.fontWeight ?? ""}
                                    disabled={!canEditSelectedSource}
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
                                        value={selectedTextStyle?.lineHeight ?? ""}
                                        disabled={!canEditSelectedSource}
                                        onChange={(event) => updateTextStyle({ lineHeight: numberOrUndefined(event.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t("structure.lettering.letterSpacing")}</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={selectedTextStyle?.letterSpacing ?? ""}
                                        disabled={!canEditSelectedSource}
                                        onChange={(event) => updateTextStyle({ letterSpacing: numberOrUndefined(event.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t("structure.lettering.fitMode")}</label>
                                <select
                                    value={selectedTextStyle?.fitMode ?? "auto"}
                                    disabled={!canEditSelectedSource}
                                    onChange={(event) => updateTextStyle({ fitMode: event.target.value as BubbleTextStyle["fitMode"] })}
                                >
                                    <option value="auto">auto</option>
                                    <option value="shrink">shrink</option>
                                    <option value="fixed">fixed</option>
                                </select>
                            </div>

                            <div className="section-actions">
                                <button type="button" className="btn btn-outline" disabled={!canEditSelectedSource} onClick={resetSelectedBubble}>
                                    {t("lettering.workspace.resetAuto")}
                                </button>
                                <button type="button" className="btn btn-primary" disabled={!canEditSelectedSource || saving || !dirty} onClick={saveSelectedBubble}>
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
