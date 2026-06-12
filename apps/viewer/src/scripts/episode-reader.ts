// ===================================================================
// Fast manga reader: RTL paging, spread layout, and buffered image loading.
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.querySelector("#reader");
  const track = document.querySelector("[data-reader-track]");
  const shell = document.querySelector("[data-work-id][data-episode-id]");
  const toolbar = document.querySelector("[data-reader-toolbar]");
  const currentPage = document.querySelector("[data-current-page]");
  const pagesScript = document.querySelector("#reader-pages");
  const feedbackApiBaseScript = document.querySelector("#feedback-api-base");
  const displayMetadataScript = document.querySelector("#reader-display-metadata");
  const pages = pagesScript ? JSON.parse(pagesScript.textContent || "[]") : [];
  const feedbackApiBase = feedbackApiBaseScript ? JSON.parse(feedbackApiBaseScript.textContent || '"/api/v1"') : "/api/v1";
  const displayMetadata = displayMetadataScript ? JSON.parse(displayMetadataScript.textContent || "{}") : {};

  if (viewport && track && shell && pages.length > 0) {
    shell.setAttribute("data-mode", "normal");
    document.documentElement.classList.add("is-reader-active");
    document.body?.classList.add("is-reader-active");
    const storagePrefix = `manga-note:${shell.getAttribute("data-work-id")}:${shell.getAttribute("data-episode-id")}`;
    const seriesId = shell.getAttribute("data-work-id") || "";
    const episodeIdValue = shell.getAttribute("data-episode-id") || "";
    const fallbackSeriesTitleValue = shell.getAttribute("data-series-title") || seriesId;
    const fallbackEpisodeTitleValue = shell.getAttribute("data-episode-title") || episodeIdValue;
    let seriesTitleValue = fallbackSeriesTitleValue;
    let episodeTitleValue = fallbackEpisodeTitleValue;
    const nextEpisodeId = shell.getAttribute("data-next-episode-id") || "";
    const nextEpisodeTitle = shell.getAttribute("data-next-episode-title") || "";
    const nextEpisodeHref = nextEpisodeId
      ? `/works/${encodeURIComponent(seriesId)}/episodes/${encodeURIComponent(nextEpisodeId)}`
      : "";
    const structuredTextHref = shell.getAttribute("data-structured-text-href") || "";
    const noteInput = document.querySelector("[data-note-input]");
    const notePage = document.querySelector("[data-note-page]");
    const noteScope = document.querySelector("[data-note-scope]");
    const noteTarget = document.querySelector("[data-note-target]");
    const noteAnchor = document.querySelector("[data-note-anchor]");
    const exploreTitle = document.querySelector("[data-explore-title]");
    const exploreSummary = document.querySelector("[data-explore-summary]");
    const exploreDetail = document.querySelector("[data-explore-detail]");
    const contextMenu = document.querySelector("[data-reader-context-menu]");
    const toast = document.querySelector("[data-reader-toast]");
    const feedbackModal = document.querySelector("[data-feedback-modal]");
    const feedbackForm = document.querySelector("[data-feedback-form]");
    const feedbackTitle = document.querySelector("[data-feedback-title]");
    const feedbackTarget = document.querySelector("[data-feedback-target]");
    const feedbackSourceText = document.querySelector("[data-feedback-source-text]");
    const feedbackIssue = document.querySelector("[data-feedback-issue]");
    const feedbackIdentityLevels = document.querySelectorAll("[data-feedback-identity-level]");
    const feedbackDisplayNameWrap = document.querySelector("[data-feedback-display-name-wrap]");
    const feedbackDisplayName = document.querySelector("[data-feedback-display-name]");
    const feedbackSuggestedWrap = document.querySelector("[data-feedback-suggested-wrap]");
    const feedbackComment = document.querySelector("[data-feedback-comment]");
    const feedbackSuggested = document.querySelector("[data-feedback-suggested]");
    const feedbackTerms = document.querySelector("[data-feedback-terms]");
    const feedbackSubmit = document.querySelector("[data-feedback-submit]");
    const feedbackStatus = document.querySelector("[data-feedback-status]");
    const readerLoading = document.querySelector("[data-reader-loading]");
    const readerLoadingText = document.querySelector("[data-reader-loading-text]");
    const quickActions = document.querySelector("[data-reader-quick-actions]");
    const quickShareButton = document.querySelector("[data-reader-quick-share]");
    const quickFeedbackButton = document.querySelector("[data-reader-quick-feedback]");
    const quickInspectButton = document.querySelector("[data-reader-quick-inspect]");
    const settingsRoot = document.querySelector("[data-reader-settings]");
    const settingsToggleButton = document.querySelector("[data-reader-settings-toggle]");
    const settingsMenu = document.querySelector("[data-reader-settings-menu]");
    const localeSelect = document.querySelector("[data-ui-locale-select]");
    const readerBackTitle = document.querySelector("[data-reader-back-title]");
    const readerTitleText = document.querySelector("[data-reader-title-text]");
    const pageScrubber = document.querySelector("[data-reader-page-scrubber]");
    const pageScrubberRange = document.querySelector("[data-reader-page-range]");
    const pageScrubberLabel = document.querySelector("[data-reader-page-scrubber-label]");
    const startOverButton = document.querySelector("[data-reader-start-over]");
    const sharedTargetButton = document.querySelector("[data-reader-shared-target]");
    const pickPrompt = document.querySelector("[data-reader-pick-prompt]");
    const pickPromptLabel = document.querySelector("[data-reader-pick-label]");
    const pickCancelButton = document.querySelector("[data-reader-pick-cancel]");
    const taskSheet = document.querySelector("[data-reader-task-sheet]");
    const taskKicker = document.querySelector("[data-task-kicker]");
    const taskTitle = document.querySelector("[data-task-title]");
    const taskDescription = document.querySelector("[data-task-description]");
    const taskOptions = document.querySelector("[data-task-options]");
    const shareSheet = document.querySelector("[data-reader-share-sheet]");
    const shareTitle = document.querySelector("[data-share-title]");
    const shareTarget = document.querySelector("[data-share-target]");
    const shareNativeButton = document.querySelector("[data-share-native]");
    const shareCopyButton = document.querySelector("[data-share-copy]");
    const shareXLink = document.querySelector("[data-share-x]");
    const shareLineLink = document.querySelector("[data-share-line]");
    const shareBlueskyLink = document.querySelector("[data-share-bluesky]");
    let activePage = "1";
    let selectedTarget = null;
    let shareTargetState = null;
    let targetPickMode = "";
    let targetPickIntent = "";
    let pendingFeedbackIssueType = "other";
    let taskSheetTrigger = null;
    let isScrubbingPage = false;
    let feedbackTargetState = null;
    let feedbackSubmitting = false;
    let chromeHideTimer = null;
    let longPressTimer = null;
    let quickActionsTimer = null;
    let targetPreviewTimer = null;
    let sharedTargetButtonTimer = null;
    let sharedTargetHighlightTimer = null;
    let sharedDeepLinkTarget = null;
    let sharedDeepLinkKind = "";
    let isSharedDeepLinkPending = false;
    let taskSheetTarget = null;
    let targetPreviewEnabled = false;
    let currentViewIndex = 0;
    let views = [];
    let isDragging = false;
    let activePointerId = null;
    let activePointers = new Map();
    let startY = 0;
    let startX = 0;
    let dragStartedAt = 0;
    let dragOffset = 0;
    let lastWidth = viewport.clientWidth;
    let resizeTimer = null;
    let pendingResizeAfterDrag = false;
    let gestureBlocked = false;
    let horizontalDragActive = false;
    let suppressNextImageClick = false;
    let suppressNextTargetClick = false;
    let suppressNextTap = false;
    let suppressTapUntil = 0;
    let pendingTapTimer = null;
    let lastTap = null;
    let dragSettleTimer = null;
    let navigationToken = 0;
    let targetPreviewGesture = null;
    const imageCache = new Map();
    const IMAGE_RETRY_LIMIT = 2;
    const TAP_NAVIGATION_DELAY_MS = 90;
    const DOUBLE_TAP_DELAY_MS = 280;
    const DOUBLE_TAP_DISTANCE = 34;
    const DRAG_START_DISTANCE = 5;
    const READER_ACTION_VISIBLE_MS = 2600;
    const TARGET_PREVIEW_VISIBLE_MS = 3200;
    const SHARED_TARGET_VISIBLE_MS = 3000;
    const TAP_SUPPRESSION_MS = 220;
    const SWIPE_AXIS_RATIO = 0.62;
    const SWIPE_MIN_DISTANCE = 22;
    const SWIPE_MAX_DISTANCE = 48;
    const SWIPE_VELOCITY = 0.12;
    const DRAG_SETTLE_TIMEOUT_MS = 2400;
    const UI_TEXT = {
      ja: {
        toolbarAria: "リーダー操作",
        localeAria: "表示言語",
        themeAria: "表示テーマ",
        localeJa: "日本語",
        localeEn: "English",
        themeLight: "ライト",
        themeDark: "ダーク",
        layoutAria: "ページ表示",
        settingsAria: "表示設定",
        settingsTitle: "表示設定",
        settingsLanguage: "言語",
        settingsTheme: "テーマ",
        settingsLayout: "ページ表示",
        layoutSingle: "単ページ",
        layoutSpread: "見開き",
        readMode: "読む",
        exploreMode: "コマ・フキダシ",
        readerHint: "左側タップ・右スワイプで次へ。中央/余白タップでメニュー表示",
        startOver: "最初から読む",
        sharedTargetPage: "共有されたページへ移動",
        sharedTargetPanel: "共有されたコマへ移動",
        sharedTargetBubble: "共有されたフキダシへ移動",
        sharedTargetRegion: "共有された位置へ移動",
        cancelPick: "キャンセル",
        pickPanelPrompt: "ページ全体を見ながらコマを選んでください",
        pickBubblePrompt: "ページ全体を見ながらフキダシを選んでください",
        pickRegionPrompt: "報告したい位置をタップしてください",
        targetPickPage: "ページを報告",
        targetPickPanel: "コマを選ぶ",
        targetPickBubble: "フキダシを選ぶ",
        targetPickRegion: "位置を指定",
        shareSheetAria: "共有",
        shareKicker: "共有",
        shareNative: "共有",
        copyUrl: "URLをコピー",
        shareNativeFailed: "共有できませんでした。URLをコピーできます",
        quickActionsAria: "リーダーの簡易操作",
        quickShare: "共有する",
        quickReportDetail: "報告する",
        quickInspect: "対象を選ぶ",
        taskChoiceAria: "操作を選ぶ",
        shareEntryTitle: "共有する",
        shareEntryDescription: "この話、ページ、コマ、フキダシを選んで共有できます。",
        reportEntryTitle: "報告する",
        reportEntryDescription: "ビューアーの不具合か、マンガ内容の気づきを送れます。",
        inspectEntryTitle: "対象を選ぶ",
        inspectEntryDescription: "コマやフキダシを選択します。",
        taskEpisode: "この話",
        taskPage: "このページ",
        taskPanel: "コマを指定",
        taskBubble: "フキダシを指定",
        taskRegion: "位置を指定",
        reportViewerBug: "ビューアーのバグ",
        reportMangaContent: "マンガの内容",
        reportViewerBugDescription: "表示崩れ、リンク切れ、操作の不具合を報告します。",
        reportMangaContentDescription: "誤字、誤訳、注釈提案などを対象つきで送ります。",
        targetUnavailable: "このページでは選択できません",
        targetPreviewPage: "このページ",
        targetActionPageTitle: "このページ",
        targetActionNoText: "原文情報はありません。",
        targetActionShare: "共有する",
        targetActionReport: "改善を提案する",
        pageScrubberAria: "ページ移動",
        nextPageAria: "次のページへ",
        prevPageAria: "前のページへ",
        readerAria: "漫画リーダー",
        loadingPage: "ページを読み込み中",
        loadingNextPage: "次のページを読み込み中",
        pageImageLoading: "画像を読み込み中",
        pageAlt: "ページ {page}",
        endTitle: "この話を読み終えました",
        endBody: "共有や、翻訳・修正の提案ができます。",
        endBodyWithNext: "次の話へ進む、共有、翻訳・修正の提案ができます。",
        endNextEpisode: "次の話へ: {title}",
        endNextEpisodeFallback: "次の話",
        endShare: "この話を共有する",
        endTextView: "テキスト版で読む",
        endQuotes: "名セリフを見る（準備中）",
        endContribute: "翻訳・修正を提案",
        linkCopied: "リンクをコピーしました",
        imageLoadError: "画像を読み込めませんでした",
        imageReload: "ページを再読み込み",
        exploreKicker: "コマ・フキダシ / 報告",
        explorePagePrefix: "ページ",
        exploreSummaryDefault: "フキダシやコマを選ぶと、原文確認や軽い報告ができます。",
        exploreDetailDefault: "ページ内のフキダシ/コマを選択してください。",
        noteLabel: "脚注・翻訳メモ",
        notePlaceholder: "例: このセリフに補足がほしい、翻訳では別案がありそう、など",
        noteScopeLabel: "対象",
        noteScopePage: "ページ全体",
        noteScopePanel: "コマ",
        noteScopeBubble: "フキダシ",
        noteScopeRegion: "任意位置",
        noteTargetLabel: "対象メモ",
        noteTargetPlaceholder: "例: 右上のフキダシ / 2コマ目 / 画面中央",
        noteAnchorEmpty: "位置指定なし。ページ画像をクリックすると、注の位置候補を保存できます。",
        noteAnchorCandidate: "位置候補: x={x}%, y={y}%",
        readerPolicyNote: "Readerでは軽い報告だけを受け付けます。",
        feedbackKicker: "フィードバック",
        feedbackTitleCompletion: "翻訳・修正を提案",
        feedbackTitleExplore: "報告する",
        feedbackTitleReport: "報告する",
        feedbackTargetSelected: "対象を選択中",
        issueTypeLabel: "種類",
        issueTypo: "誤字",
        issueMistranslation: "誤訳",
        issueDisplay: "表示崩れ",
        issueBrokenLink: "リンク切れ",
        issueBetterTranslation: "よりよい訳",
        issueMissingNote: "注釈の追加",
        issueOther: "その他",
        identityLabel: "投稿者表示",
        identityAnonymous: "匿名",
        identityDisplayName: "表示名あり",
        displayNameLabel: "表示名",
        displayNamePlaceholder: "例: いち読者",
        feedbackCommentLabel: "コメント",
        feedbackCommentPlaceholder: "気づいた点を短く書いてください",
        sourceTextLabel: "原文",
        suggestedLabel: "提案文",
        suggestedPlaceholder: "翻訳案や注釈案があれば入力してください",
        contributorTermsLabel: "送信内容が作品改善のために保存・共有される場合があることを確認しました",
        close: "閉じる",
        submit: "送信",
        feedbackStatusSubmitted: "前回: {target} を送信済み{id}",
        feedbackStatusNew: "前回: {target} は受付済みです{id}",
        feedbackStatusTriaged: "前回: {target} は審査中です{id}",
        feedbackStatusClosed: "前回: {target} の確認が完了しました{id}",
        feedbackReceipt: "（受付番号: {id}）",
        bubbleTitle: "このセリフ",
        bubbleMissingText: "原文未設定のフキダシです。",
        bubbleMissingHeading: "原文未設定",
        bubbleShortId: "フキダシ {id}",
        bubbleMeta: "話者: {speaker} / 種別: {type}",
        panelTitle: "コマ内のセリフ",
        panelSummary: "コマ {panelNumber}",
        panelMeta: "コマ {panelNumber} / {bubbleCount} フキダシ",
        actionShare: "共有する",
        actionBetterTranslation: "よりよい訳を提案",
        actionMistranslation: "誤訳を報告",
        actionMissingNote: "注釈を提案",
        actionDisplay: "表示崩れを報告",
        targetBubble: "対象: {id}",
        targetPanel: "対象: コマ {panelNumber}",
        targetRegion: "対象: ページ {pageNumber} の位置",
        targetPage: "対象: ページ {pageNumber}",
        targetEpisode: "対象: エピソード",
        contextClipComing: "Clipに追加（準備中）",
        contextExplore: "対象を選ぶ",
        contextReport: "報告する",
        feedbackSent: "送信しました",
        reportSent: "報告を送信しました",
        feedbackFailed: "送信に失敗しました",
        sendFailed: "送信に失敗しました",
        pageInfo: "ページ {pageNumber} — {panelCount} コマ、{bubbleCount} フキダシ",
        panelAria: "コマ {panelNumber}",
        bubbleAria: "フキダシ {bubbleId}",
      },
      en: {
        toolbarAria: "Reader controls",
        localeAria: "Language",
        themeAria: "Reader theme",
        localeJa: "Japanese",
        localeEn: "English",
        themeLight: "Light",
        themeDark: "Dark",
        layoutAria: "Page layout",
        settingsAria: "Display settings",
        settingsTitle: "Display settings",
        settingsLanguage: "Language",
        settingsTheme: "Theme",
        settingsLayout: "Page display",
        layoutSingle: "Single",
        layoutSpread: "Spread",
        readMode: "Read",
        exploreMode: "Panels / bubbles",
        readerHint: "Tap left or swipe right for next. Tap center or margins for controls",
        startOver: "Start from beginning",
        sharedTargetPage: "Jump to shared page",
        sharedTargetPanel: "Jump to shared panel",
        sharedTargetBubble: "Jump to shared bubble",
        sharedTargetRegion: "Jump to shared position",
        cancelPick: "Cancel",
        pickPanelPrompt: "Select a panel with the full page visible",
        pickBubblePrompt: "Select a bubble with the full page visible",
        pickRegionPrompt: "Tap the position you want to report",
        targetPickPage: "Report page",
        targetPickPanel: "Pick panel",
        targetPickBubble: "Pick bubble",
        targetPickRegion: "Pick region",
        shareSheetAria: "Share",
        shareKicker: "Share",
        shareNative: "Share",
        copyUrl: "Copy URL",
        shareNativeFailed: "Could not open sharing. You can copy the URL instead",
        quickActionsAria: "Reader quick actions",
        quickShare: "Share",
        quickReportDetail: "Report",
        quickInspect: "Pick target",
        taskChoiceAria: "Choose an action",
        shareEntryTitle: "Share",
        shareEntryDescription: "Share this episode, page, panel, or bubble.",
        reportEntryTitle: "Report",
        reportEntryDescription: "Report a viewer bug or something about the manga content.",
        inspectEntryTitle: "Pick target",
        inspectEntryDescription: "Select a panel or bubble.",
        taskEpisode: "This episode",
        taskPage: "This page",
        taskPanel: "Pick a panel",
        taskBubble: "Pick a bubble",
        taskRegion: "Pick a position",
        reportViewerBug: "Viewer bug",
        reportMangaContent: "Manga content",
        reportViewerBugDescription: "Report layout, broken link, or interaction issues.",
        reportMangaContentDescription: "Send typos, translation notes, or other target-specific feedback.",
        targetUnavailable: "Unavailable on this page",
        targetPreviewPage: "This page",
        targetActionPageTitle: "This page",
        targetActionNoText: "No source text available.",
        targetActionShare: "Share",
        targetActionReport: "Suggest improvement",
        pageScrubberAria: "Page scrubber",
        nextPageAria: "Next page",
        prevPageAria: "Previous page",
        readerAria: "Manga reader",
        loadingPage: "Loading page",
        loadingNextPage: "Loading next page",
        pageImageLoading: "Loading image",
        pageAlt: "Page {page}",
        endTitle: "You finished this episode",
        endBody: "Share this episode or suggest a translation / fix.",
        endBodyWithNext: "Continue to the next episode, share this one, or suggest a translation / fix.",
        endNextEpisode: "Next episode: {title}",
        endNextEpisodeFallback: "Next episode",
        endShare: "Share this episode",
        endTextView: "Read text version",
        endQuotes: "Notable lines (coming soon)",
        endContribute: "Suggest translation / fix",
        linkCopied: "Link copied",
        imageLoadError: "Could not load image",
        imageReload: "Reload page",
        exploreKicker: "Panels / bubbles / report",
        explorePagePrefix: "Page",
        exploreSummaryDefault: "Select a bubble or panel to inspect source text or send a quick report.",
        exploreDetailDefault: "Select a bubble or panel on the page.",
        noteLabel: "Footnote / translation memo",
        notePlaceholder: "Example: this line may need more context, or there may be a better translation option.",
        noteScopeLabel: "Scope",
        noteScopePage: "Whole page",
        noteScopePanel: "Panel",
        noteScopeBubble: "Bubble",
        noteScopeRegion: "Custom position",
        noteTargetLabel: "Target memo",
        noteTargetPlaceholder: "Example: upper-right bubble / second panel / center of the screen",
        noteAnchorEmpty: "No position selected. Click the page image to save a suggested note anchor.",
        noteAnchorCandidate: "Suggested position: x={x}%, y={y}%",
        readerPolicyNote: "Reader accepts lightweight reports only.",
        feedbackKicker: "Feedback",
        feedbackTitleCompletion: "Suggest translation / fix",
        feedbackTitleExplore: "Report an issue",
        feedbackTitleReport: "Report an issue",
        feedbackTargetSelected: "Target selected",
        issueTypeLabel: "Type",
        issueTypo: "Typo",
        issueMistranslation: "Mistranslation",
        issueDisplay: "Display issue",
        issueBrokenLink: "Broken link",
        issueBetterTranslation: "Better translation",
        issueMissingNote: "Footnote request",
        issueOther: "Other",
        identityLabel: "Contributor display",
        identityAnonymous: "Anonymous",
        identityDisplayName: "Use display name",
        displayNameLabel: "Display name",
        displayNamePlaceholder: "Example: A reader",
        feedbackCommentLabel: "Comment",
        feedbackCommentPlaceholder: "Briefly describe what you noticed.",
        sourceTextLabel: "Source text",
        suggestedLabel: "Suggested text",
        suggestedPlaceholder: "Add a translation or footnote suggestion if you have one.",
        contributorTermsLabel: "I understand this may be saved and shared to improve the work.",
        close: "Close",
        submit: "Submit",
        feedbackStatusSubmitted: "Previous submission: {target} sent{id}",
        feedbackStatusNew: "Previous submission for {target} was received{id}",
        feedbackStatusTriaged: "Previous submission for {target} is under review{id}",
        feedbackStatusClosed: "Previous submission for {target} has been reviewed{id}",
        feedbackReceipt: " (receipt: {id})",
        bubbleTitle: "This line",
        bubbleMissingText: "This bubble has no source text yet.",
        bubbleMissingHeading: "No source text",
        bubbleShortId: "Bubble {id}",
        bubbleMeta: "Speaker: {speaker} / Type: {type}",
        panelTitle: "Panel text",
        panelSummary: "Panel {panelNumber}",
        panelMeta: "Panel {panelNumber} / {bubbleCount} bubbles",
        actionShare: "Share",
        actionBetterTranslation: "Suggest a better translation",
        actionMistranslation: "Report mistranslation",
        actionMissingNote: "Suggest a footnote",
        actionDisplay: "Report display issue",
        targetBubble: "Target: {id}",
        targetPanel: "Target: Panel {panelNumber}",
        targetRegion: "Target: position on page {pageNumber}",
        targetPage: "Target: Page {pageNumber}",
        targetEpisode: "Target: Episode",
        contextClipComing: "Add to Clip (coming soon)",
        contextExplore: "Pick target",
        contextReport: "Report",
        feedbackSent: "Sent",
        reportSent: "Report sent",
        feedbackFailed: "Feedback failed",
        sendFailed: "Could not send",
        pageInfo: "Page {pageNumber} — {panelCount} panels, {bubbleCount} bubbles",
        panelAria: "Panel {panelNumber}",
        bubbleAria: "Bubble {bubbleId}",
      },
    };
    let uiLocale = "ja";
    let contentLocale = "ja";
    let readerTheme = "light";
    let readerLayout = viewport.clientWidth >= 900 ? "spread" : "single";
    const t = (key, values = {}) => {
      const template = UI_TEXT[uiLocale]?.[key] ?? UI_TEXT.ja[key] ?? key;
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template,
      );
    };
    const normalizeUiLocale = (locale) => (locale === "en" ? "en" : "ja");
    const normalizeReaderTheme = (theme) => (theme === "dark" ? "dark" : "light");
    const normalizeReaderLayout = (layout) => (layout === "spread" ? "spread" : "single");
    const canUseSpreadLayout = () => viewport.clientWidth >= 720 && viewport.clientHeight >= 480;
    const readerViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight || viewport.clientHeight;
      return Math.max(320, Math.round(height));
    };
    const syncReaderViewportHeight = () => {
      shell.style.setProperty("--reader-viewport-height", `${readerViewportHeight()}px`);
    };
    const updateUrlLanguage = (locale) => {
      const normalized = normalizeUiLocale(locale);
      const url = new URL(window.location.href);
      if (normalized === "ja") url.searchParams.delete("lang");
      else url.searchParams.set("lang", normalized);
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    };
    const applyLanguageToUrl = (url, locale = contentLocale) => {
      const normalized = normalizeUiLocale(locale);
      if (normalized === "ja") url.searchParams.delete("lang");
      else url.searchParams.set("lang", normalized);
      return url;
    };
    const applyReaderTheme = (theme) => {
      readerTheme = normalizeReaderTheme(theme);
      shell.setAttribute("data-reader-theme", readerTheme);
      try {
        localStorage.setItem(`${storagePrefix}:reader-theme`, readerTheme);
      } catch {
        // Storage may be blocked in private browsing.
      }
      document.querySelectorAll("[data-reader-theme-button]").forEach((button) => {
        const active = button.getAttribute("data-reader-theme-button") === readerTheme;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };
    const applyReaderLayout = (layout, options = {}) => {
      const { rebuild = true } = options;
      const active = Number(activePage);
      readerLayout = normalizeReaderLayout(layout);
      shell.setAttribute("data-reader-layout", readerLayout);
      try {
        localStorage.setItem(`${storagePrefix}:reader-layout`, readerLayout);
      } catch {
        // Storage may be blocked in private browsing.
      }
      document.querySelectorAll("[data-reader-layout-button]").forEach((button) => {
        const activeButton = button.getAttribute("data-reader-layout-button") === readerLayout;
        button.classList.toggle("is-active", activeButton);
        button.setAttribute("aria-pressed", activeButton ? "true" : "false");
      });
      if (!rebuild) return;
      buildDOM();
      const index = views.findIndex((view) => view.pages?.some((page) => page.pageNumber === active));
      currentViewIndex = Math.max(0, index);
      render(0, false);
      updateActivePage();
    };
    const applyContentLocale = (locale) => {
      contentLocale = normalizeUiLocale(locale);
      shell.setAttribute("data-content-locale", contentLocale);
      for (const page of pages) {
        const img = getPageImageElement(page);
        if (!img) continue;
        const nextSrc = readerImageSrcFor(page);
        if (!nextSrc || img.dataset.src === nextSrc) continue;
        img.dataset.src = nextSrc;
        img.dataset.retryCount = "0";
        syncPageImageElement(page, "loading");
      }
      preloadAroundView(currentViewIndex);
    };
    const localizedDisplayMetadata = (locale) => {
      const normalized = normalizeUiLocale(locale);
      const fallbackLocale = normalized === "en" ? "ja" : "en";
      return {
        series: {
          ...(displayMetadata.series?.[fallbackLocale] || {}),
          ...(displayMetadata.series?.[normalized] || {}),
        },
        episode: {
          ...(displayMetadata.episode?.[fallbackLocale] || {}),
          ...(displayMetadata.episode?.[normalized] || {}),
        },
      };
    };
    const syncLocalizedDisplayMetadata = () => {
      const metadata = localizedDisplayMetadata(uiLocale);
      seriesTitleValue = String(metadata.series?.title || fallbackSeriesTitleValue);
      episodeTitleValue = String(metadata.episode?.title || fallbackEpisodeTitleValue);
      shell.setAttribute("data-series-title", seriesTitleValue);
      shell.setAttribute("data-episode-title", episodeTitleValue);
      if (readerBackTitle) readerBackTitle.textContent = `← ${seriesTitleValue}`;
      if (readerTitleText) readerTitleText.textContent = episodeTitleValue;
    };
    const applyUiLocale = (locale, options = {}) => {
      const { updateUrl = false } = options;
      uiLocale = normalizeUiLocale(locale);
      shell.setAttribute("data-ui-locale", uiLocale);
      document.querySelectorAll("[data-ui-label]").forEach((element) => {
        const key = element.getAttribute("data-ui-label");
        if (key) element.textContent = t(key);
      });
      document.querySelectorAll("[data-ui-placeholder]").forEach((element) => {
        const key = element.getAttribute("data-ui-placeholder");
        if (key) element.setAttribute("placeholder", t(key));
      });
      document.querySelectorAll("[data-ui-aria-label]").forEach((element) => {
        const key = element.getAttribute("data-ui-aria-label");
        if (key) element.setAttribute("aria-label", t(key));
      });
      document.querySelectorAll("[data-ui-locale-button]").forEach((button) => {
        const active = button.getAttribute("data-ui-locale-button") === uiLocale;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (localeSelect && localeSelect.value !== uiLocale) {
        localeSelect.value = uiLocale;
      }
      document.querySelectorAll("[data-reader-theme-button]").forEach((button) => {
        const key = button.getAttribute("data-ui-label");
        if (key) button.textContent = t(key);
      });
      track.querySelectorAll(".page-image-status").forEach((element) => {
        element.textContent = t("imageLoadError");
      });
      if (sharedTargetButton && sharedDeepLinkTarget) {
        sharedTargetButton.textContent = sharedTargetLabel(sharedDeepLinkKind);
      }
      syncLocalizedDisplayMetadata();
      applyContentLocale(uiLocale);
      if (updateUrl) updateUrlLanguage(uiLocale);
      syncPageScrubber();
      renderFeedbackStatus();
    };

    const noteKey = (page) => `${storagePrefix}:p${page}`;
    const feedbackStatusKey = `${storagePrefix}:feedback-status:v1`;
    const readNote = (page) => {
      try {
        return JSON.parse(localStorage.getItem(noteKey(page)) || "{}");
      } catch {
        return {};
      }
    };
    const writeNotePatch = (patch) => {
      const current = readNote(activePage);
      localStorage.setItem(noteKey(activePage), JSON.stringify({ ...current, ...patch }));
    };
    const updateAnchorLabel = (anchor) => {
      if (!noteAnchor) return;
      if (!anchor) {
        noteAnchor.textContent = t("noteAnchorEmpty");
        return;
      }
      noteAnchor.textContent = t("noteAnchorCandidate", {
        x: Math.round(anchor.x * 100),
        y: Math.round(anchor.y * 100),
      });
    };
    const renderAnchorMarker = (page, anchor) => {
      track.querySelectorAll(".note-anchor-marker").forEach((el) => el.remove());
      if (!anchor || String(page) !== activePage) return;
      const frame = track.querySelector(`[data-page="${activePage}"]`);
      const wrap = frame?.querySelector(".page-image-wrap");
      if (!wrap) return;
      const marker = document.createElement("span");
      marker.className = "note-anchor-marker";
      marker.style.left = `${anchor.x * 100}%`;
      marker.style.top = `${anchor.y * 100}%`;
      wrap.appendChild(marker);
    };
    const loadNote = (page) => {
      activePage = page;
      const saved = readNote(page);
      if (notePage) notePage.textContent = page;
      if (noteInput) noteInput.value = saved.text ?? "";
      if (noteScope) noteScope.value = saved.scope ?? "page";
      if (noteTarget) noteTarget.value = saved.target ?? "";
      updateAnchorLabel(saved.anchor);
      renderAnchorMarker(page, saved.anchor);
    };

    const getPageId = (page) => page?.id ?? `p${String(page?.pageNumber ?? "").padStart(3, "0")}`;
    const isValidBox = (bbox, page) =>
      Boolean(
        bbox
        && page?.width
        && page?.height
        && Number.isFinite(bbox.x)
        && Number.isFinite(bbox.y)
        && Number.isFinite(bbox.width)
        && Number.isFinite(bbox.height)
        && bbox.width > 0
        && bbox.height > 0,
      );
    const boxStyle = (bbox, page) => {
      if (!isValidBox(bbox, page)) return "";
      return [
        `left:${(bbox.x / page.width) * 100}%`,
        `top:${(bbox.y / page.height) * 100}%`,
        `width:${(bbox.width / page.width) * 100}%`,
        `height:${(bbox.height / page.height) * 100}%`,
      ].join(";");
    };
    const centerStyle = (bbox, page) => {
      if (!isValidBox(bbox, page)) return "";
      const centerX = ((bbox.x + bbox.width / 2) / page.width) * 100;
      const centerY = ((bbox.y + bbox.height / 2) / page.height) * 100;
      return [`left:${centerX}%`, `top:${centerY}%`].join(";");
    };
    const showToast = (message) => {
      if (!toast) return;
      toast.textContent = message;
      toast.hidden = false;
      window.setTimeout(() => {
        toast.hidden = true;
      }, 1800);
    };
    const setReaderLoading = (loading, message = t("loadingPage")) => {
      shell.setAttribute("data-image-state", loading ? "loading" : "ready");
      if (readerLoading) readerLoading.hidden = !loading;
      if (readerLoadingText) readerLoadingText.textContent = message;
    };
    const pageLabelForNumber = (pageNumber) => {
      const page = pages.find((item) => item.pageNumber === pageNumber);
      return page?.displayRef || `p${String(pageNumber).padStart(2, "0")}`;
    };
    const syncPageScrubber = (pageNumber = Number(activePage) || 1, options = {}) => {
      const { preview = false } = options;
      const page = Math.max(1, Math.min(Number(pageNumber) || 1, pages.length));
      const label = `${pageLabelForNumber(page)} / ${pages.length}`;
      if (pageScrubberRange) {
        pageScrubberRange.min = "1";
        pageScrubberRange.max = String(pages.length);
        pageScrubberRange.setAttribute("aria-valuetext", label);
        if (!isScrubbingPage || preview) pageScrubberRange.value = String(page);
      }
      if (pageScrubberLabel) pageScrubberLabel.textContent = label;
    };
    const commitScrubberPage = () => {
      if (!pageScrubberRange) return;
      const page = Math.max(1, Math.min(Number(pageScrubberRange.value) || 1, pages.length));
      isScrubbingPage = false;
      syncPageScrubber(page, { preview: true });
      void goToPage(page, { animate: true, requireReady: true, loadingMessage: t("loadingNextPage") });
    };
    const imageUrlForAttempt = (src, attempt) => {
      if (!src || attempt <= 0) return src;
      try {
        const url = new URL(src, window.location.href);
        url.searchParams.set("retry", String(attempt));
        return url.toString();
      } catch {
        const separator = src.includes("?") ? "&" : "?";
        return `${src}${separator}retry=${attempt}`;
      }
    };
    const readerImageSrcFor = (page) => {
      if (!page) return "";
      const fallbacks = [
        contentLocale,
        ...(Array.isArray(page.imageLocaleFallbacks) ? page.imageLocaleFallbacks : []),
        "ja",
        "en",
      ].filter((value, index, list) => value && list.indexOf(value) === index);
      for (const locale of fallbacks) {
        if (page.images?.[locale]) return page.images[locale];
      }
      return page.src || "";
    };
    const imageCacheKey = (page) => readerImageSrcFor(page);
    const findPageFrame = (page) => track.querySelector(`[data-page="${page.pageNumber}"]`);
    const isPageInActiveView = (page) => views[currentViewIndex]?.pages?.some((viewPage) => viewPage.pageNumber === page?.pageNumber);
    const getPageImageElement = (page) => findPageFrame(page)?.querySelector("img[data-src]");
    const isImageElementReady = (img) => Boolean(img?.complete && img.naturalWidth > 0);
    const markPageImageState = (page, state) => {
      const frame = findPageFrame(page);
      if (frame) frame.setAttribute("data-image-state", state);
    };
    const syncPageImageElement = (page, state = "loading") => {
      const img = getPageImageElement(page);
      if (!img) return;
      const currentSrc = readerImageSrcFor(page);
      if (currentSrc && img.dataset.src !== currentSrc) {
        img.dataset.src = currentSrc;
        img.dataset.retryCount = "0";
      }
      const record = imageCache.get(imageCacheKey(page));
      const nextSrc = record?.resolvedSrc || img.dataset.src;
      if (nextSrc && img.getAttribute("src") !== nextSrc) img.setAttribute("src", nextSrc);
      markPageImageState(page, state === "error" && isImageElementReady(img) ? "ready" : state);
    };
    const decodePreloadedImage = async (img) => {
      if (!img.decode) return;
      try {
        await Promise.race([
          img.decode(),
          new Promise((resolve) => window.setTimeout(resolve, 800)),
        ]);
      } catch {
        // Some browsers reject decode() for images that still painted correctly.
      }
    };
    const preloadPageImage = (page) => {
      const key = imageCacheKey(page);
      if (!key) return Promise.resolve({ ok: false, src: key });
      const cached = imageCache.get(key);
      if (cached) return cached.promise;

      const img = new Image();
      img.decoding = "async";
      const record = {
        status: "loading",
        resolvedSrc: key,
        promise: new Promise((resolve) => {
          const start = (attempt = 0) => {
            const src = imageUrlForAttempt(key, attempt);
            img.onload = async () => {
              await decodePreloadedImage(img);
              record.status = "ready";
              record.resolvedSrc = img.currentSrc || img.src || src;
              markPageImageState(page, "ready");
              resolve({ ok: true, src: record.resolvedSrc });
            };
            img.onerror = () => {
              if (attempt < IMAGE_RETRY_LIMIT) {
                window.setTimeout(() => start(attempt + 1), 280 * (attempt + 1));
                return;
              }
              record.status = "error";
              if (isPageInActiveView(page)) markPageImageState(page, "error");
              resolve({ ok: false, src: key });
            };
            img.src = src;
          };
          start(0);
        }),
      };
      imageCache.set(key, record);
      markPageImageState(page, "loading");
      if (img.complete && img.naturalWidth > 0) {
        record.promise = decodePreloadedImage(img).then(() => {
          record.status = "ready";
          record.resolvedSrc = img.currentSrc || img.src || key;
          markPageImageState(page, "ready");
          return { ok: true, src: record.resolvedSrc };
        });
        imageCache.set(key, record);
      }
      return record.promise;
    };
    const preloadPages = (targetPages) => Promise.all(
      targetPages.filter(Boolean).map((page) => preloadPageImage(page)),
    );
    const attachPageImageHandlers = (img, page) => {
      img.addEventListener("load", () => {
        img.dataset.retryCount = "0";
        markPageImageState(page, "ready");
      });
      img.addEventListener("error", () => {
        const retryCount = Number(img.dataset.retryCount || "0");
        if (retryCount < IMAGE_RETRY_LIMIT) {
          const nextAttempt = retryCount + 1;
          img.dataset.retryCount = String(nextAttempt);
          markPageImageState(page, "loading");
          window.setTimeout(() => {
            img.setAttribute("src", imageUrlForAttempt(readerImageSrcFor(page), nextAttempt));
          }, 320 * nextAttempt);
          return;
        }
        markPageImageState(page, "error");
      });
    };
    const preloadAroundPage = (pageNumber) => {
      const index = pages.findIndex((page) => page.pageNumber === pageNumber);
      if (index < 0) return;
      preloadPages([pages[index - 1], pages[index], pages[index + 1]]);
    };
    const preloadAroundView = (viewIndex) => {
      const targetPages = [];
      for (let i = viewIndex - 1; i <= viewIndex + 1; i++) {
        targetPages.push(...(views[i]?.pages || []));
      }
      preloadPages(targetPages).then(() => {
        for (const page of targetPages) {
          if (!page || isPageInActiveView(page)) continue;
          const frame = findPageFrame(page);
          if (frame?.getAttribute("data-image-state") === "error") frame.setAttribute("data-image-state", "loading");
        }
      });
    };
    const ensureViewImagesReady = async (view) => {
      const viewPages = view?.pages || [];
      if (viewPages.length === 0) return true;
      viewPages.forEach((page) => syncPageImageElement(page, "loading"));
      const results = await preloadPages(viewPages);
      const ok = results.every((result) => result.ok);
      viewPages.forEach((page) => {
        const record = imageCache.get(imageCacheKey(page));
        const img = getPageImageElement(page);
        syncPageImageElement(page, record?.status === "ready" || isImageElementReady(img) ? "ready" : "error");
      });
      return ok || viewPages.every((page) => isImageElementReady(getPageImageElement(page)));
    };
    const closeContextMenu = () => {
      if (contextMenu) contextMenu.hidden = true;
    };
    const updateFeedbackIdentityFields = () => {
      const selected = Array.from(feedbackIdentityLevels).find((input) => input.checked);
      const useDisplayName = selected?.value === "display_name";
      if (feedbackDisplayNameWrap) feedbackDisplayNameWrap.hidden = !useDisplayName;
      if (!useDisplayName && feedbackDisplayName) feedbackDisplayName.value = "";
    };
    const resetFeedbackIdentity = () => {
      feedbackIdentityLevels.forEach((input) => {
        input.checked = input.value === "anonymous";
      });
      if (feedbackDisplayName) feedbackDisplayName.value = "";
      updateFeedbackIdentityFields();
    };
    const contributorIdentityFromForm = (formData) => {
      const level = String(formData.get("identity_level") || "anonymous");
      const displayName = String(formData.get("display_name") || "").trim();
      if (level === "display_name" && displayName) {
        return { identity_level: "display_name", display_name: displayName };
      }
      return { identity_level: "anonymous" };
    };
    const targetLabelFor = (target) => target?.bubble
      ? t("targetBubble", { id: target.bubble.shortId || target.bubble.id })
      : target?.panel
        ? t("targetPanel", { panelNumber: target.panel.panelNumber })
        : target?.region && target?.page
          ? t("targetRegion", { pageNumber: target.page.pageNumber })
          : target?.page
            ? t("targetPage", { pageNumber: target.page.pageNumber })
          : t("targetEpisode");
    const readFeedbackStatus = () => {
      try {
        return JSON.parse(localStorage.getItem(feedbackStatusKey) || "null");
      } catch {
        return null;
      }
    };
    const writeFeedbackStatus = (record) => {
      try {
        localStorage.setItem(feedbackStatusKey, JSON.stringify(record));
      } catch {
        // Storage may be blocked in private browsing.
      }
    };
    const renderFeedbackStatus = () => {
      if (!feedbackStatus) return;
      const status = readFeedbackStatus();
      if (!status) {
        feedbackStatus.hidden = true;
        feedbackStatus.textContent = "";
        return;
      }
      const idText = status.feedback_id ? t("feedbackReceipt", { id: status.feedback_id }) : "";
      const statusKey = status.status === "new"
        ? "feedbackStatusNew"
        : status.status === "triaged"
          ? "feedbackStatusTriaged"
          : status.status === "closed"
            ? "feedbackStatusClosed"
            : "feedbackStatusSubmitted";
      feedbackStatus.textContent = t(statusKey, {
        target: status.target_label || t("targetEpisode"),
        id: idText,
      });
      feedbackStatus.hidden = false;
    };
    const refreshFeedbackStatus = async () => {
      const status = readFeedbackStatus();
      if (!status?.feedback_id || status.feedback_id === "fb_ignored") return;
      try {
        const res = await fetch(`${feedbackApiBase}/feedback/${encodeURIComponent(status.feedback_id)}/status`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        writeFeedbackStatus({
          ...status,
          feedback_id: data.feedback_id || status.feedback_id,
          status: data.status || status.status,
          created_at: data.created_at || status.created_at,
          triaged_at: data.triaged_at || status.triaged_at,
          checked_at: new Date().toISOString(),
        });
        renderFeedbackStatus();
      } catch {
        // Status lookup is best-effort; feedback submission still works offline.
      }
    };
    const extractFeedbackId = (data) =>
      data?.feedback_id || data?.feedbackId || data?.id || data?.feedback?.id || "";
    const updateFeedbackSubmitState = () => {
      if (!feedbackSubmit) return;
      const hasBody = Boolean(
        feedbackComment?.value.trim()
        || (!feedbackSuggestedWrap?.hidden && feedbackSuggested?.value.trim()),
      );
      const canSubmit = !feedbackSubmitting && Boolean(feedbackTerms?.checked) && hasBody;
      feedbackSubmit.disabled = !canSubmit;
      feedbackSubmit.setAttribute("aria-disabled", canSubmit ? "false" : "true");
    };
    const syncFeedbackIssueOptions = (allowedIssueTypes = null) => {
      if (!feedbackIssue) return;
      const allowed = Array.isArray(allowedIssueTypes) ? new Set(allowedIssueTypes) : null;
      Array.from(feedbackIssue.options).forEach((option) => {
        const disabled = Boolean(allowed && !allowed.has(option.value));
        option.hidden = disabled;
        option.disabled = disabled;
      });
      if (allowed && !allowed.has(feedbackIssue.value)) {
        feedbackIssue.value = allowed.values().next().value || "other";
      }
    };
    const isEditableTarget = (target) =>
      Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
    const isFeedbackOpen = () => Boolean(feedbackModal && !feedbackModal.hidden);
    const isTaskSheetOpen = () => Boolean(taskSheet && !taskSheet.hidden);
    const shouldIgnoreReaderShortcut = (event) =>
      isFeedbackOpen() || isTaskSheetOpen() || isEditableTarget(event.target);
    const clearChromeHideTimer = () => {
      if (chromeHideTimer) {
        window.clearTimeout(chromeHideTimer);
        chromeHideTimer = null;
      }
    };
    const closeSettingsMenu = () => {
      if (!settingsMenu) return;
      settingsMenu.hidden = true;
      settingsToggleButton?.setAttribute("aria-expanded", "false");
    };
    const toggleSettingsMenu = () => {
      if (!settingsMenu) return;
      const isOpen = !settingsMenu.hidden;
      settingsMenu.hidden = isOpen;
      settingsToggleButton?.setAttribute("aria-expanded", isOpen ? "false" : "true");
    };
    const setReaderChromeVisible = (visible, options = {}) => {
      const { temporary = visible, delay = READER_ACTION_VISIBLE_MS } = options;
      clearChromeHideTimer();
      if (visible) {
        shell.setAttribute("data-reader-chrome", "visible");
        if (temporary && shell.getAttribute("data-mode") === "normal" && !isFeedbackOpen()) {
          chromeHideTimer = window.setTimeout(() => {
            shell.setAttribute("data-reader-chrome", "hidden");
            hideQuickActions();
            hideTargetPreviewOverlay({ disable: true });
            closeSettingsMenu();
            chromeHideTimer = null;
          }, delay);
        }
      } else if (shell.getAttribute("data-mode") === "normal" && !isFeedbackOpen()) {
        shell.setAttribute("data-reader-chrome", "hidden");
        hideTargetPreviewOverlay({ disable: true });
        closeSettingsMenu();
      }
    };
    const toggleReaderChrome = () => {
      const isVisible = shell.getAttribute("data-reader-chrome") === "visible";
      if (isVisible) {
        setReaderChromeVisible(false);
        hideQuickActions();
        hideTargetPreviewOverlay({ disable: true });
      } else {
        revealReaderActions();
      }
    };
    const hideQuickActions = () => {
      if (quickActionsTimer) {
        window.clearTimeout(quickActionsTimer);
        quickActionsTimer = null;
      }
      shell.setAttribute("data-reader-ui", "hidden");
      if (quickActions) quickActions.hidden = true;
    };
    const showQuickActions = (delay = READER_ACTION_VISIBLE_MS) => {
      if (!quickActions || shell.getAttribute("data-mode") !== "normal" || isFeedbackOpen()) return;
      shell.setAttribute("data-reader-ui", "visible");
      quickActions.hidden = false;
      if (quickActionsTimer) window.clearTimeout(quickActionsTimer);
      quickActionsTimer = window.setTimeout(hideQuickActions, delay);
    };
    const hideTargetPreviewOverlay = (options = {}) => {
      const { disable = false } = options;
      if (targetPreviewTimer) {
        window.clearTimeout(targetPreviewTimer);
        targetPreviewTimer = null;
      }
      if (disable) targetPreviewEnabled = false;
      shell.setAttribute("data-target-preview", "hidden");
      syncTargetInteractivity();
    };
    const showTargetPreviewOverlay = (options = {}) => {
      const { temporary = true, delay = TARGET_PREVIEW_VISIBLE_MS } = options;
      if (shell.getAttribute("data-mode") !== "normal" || isFeedbackOpen() || isTaskSheetOpen()) return;
      targetPreviewEnabled = true;
      shell.setAttribute("data-target-preview", "visible");
      syncTargetInteractivity();
      if (targetPreviewTimer) window.clearTimeout(targetPreviewTimer);
      if (temporary) {
        targetPreviewTimer = window.setTimeout(() => hideTargetPreviewOverlay({ disable: true }), delay);
      }
    };
    const restoreTargetPreviewAfterOverlay = () => {
      if (targetPreviewEnabled && shell.getAttribute("data-mode") === "normal" && !isFeedbackOpen() && !isTaskSheetOpen()) {
        setReaderChromeVisible(true, { delay: READER_ACTION_VISIBLE_MS });
        showTargetPreviewOverlay({ temporary: true, delay: READER_ACTION_VISIBLE_MS });
      }
    };
    const hideSharedTargetButton = () => {
      if (sharedTargetButtonTimer) {
        window.clearTimeout(sharedTargetButtonTimer);
        sharedTargetButtonTimer = null;
      }
      if (sharedTargetButton) sharedTargetButton.hidden = true;
    };
    const showSharedTargetButton = (delay = SHARED_TARGET_VISIBLE_MS) => {
      if (!sharedTargetButton || !sharedDeepLinkTarget || shell.getAttribute("data-mode") !== "normal" || isFeedbackOpen()) return;
      sharedTargetButton.hidden = false;
      if (sharedTargetButtonTimer) window.clearTimeout(sharedTargetButtonTimer);
      sharedTargetButtonTimer = window.setTimeout(hideSharedTargetButton, delay);
    };
    const sharedTargetLabel = (kind) => kind === "bubble"
      ? t("sharedTargetBubble")
      : kind === "panel"
        ? t("sharedTargetPanel")
        : kind === "region"
          ? t("sharedTargetRegion")
          : t("sharedTargetPage");
    const revealReaderActions = (delay = READER_ACTION_VISIBLE_MS) => {
      setReaderChromeVisible(true, { delay });
      showQuickActions(delay);
      showTargetPreviewOverlay({ temporary: true, delay });
      showSharedTargetButton(SHARED_TARGET_VISIBLE_MS);
    };
    const clearSelectedTarget = () => {
      selectedTarget = null;
      shell.removeAttribute("data-explore-target");
      shell.style.removeProperty("--reader-mobile-pan-y");
      track
        .querySelectorAll(".reader-target.is-selected, .reader-bubble-highlight.is-selected")
        .forEach((el) => el.classList.remove("is-selected"));
    };
    const clearSharedTargetHighlight = () => {
      if (sharedTargetHighlightTimer) {
        window.clearTimeout(sharedTargetHighlightTimer);
        sharedTargetHighlightTimer = null;
      }
      track
        .querySelectorAll(".reader-target.is-shared-focus, .reader-bubble-highlight.is-shared-focus")
        .forEach((el) => el.classList.remove("is-shared-focus"));
      shell.removeAttribute("data-shared-target-highlight");
    };
    const endTargetPick = () => {
      targetPickMode = "";
      targetPickIntent = "";
      pendingFeedbackIssueType = "other";
      shell.removeAttribute("data-target-picking");
      if (pickPrompt) pickPrompt.hidden = true;
    };
    const beginTargetPick = (mode, intent = "inspect", issueType = "other") => {
      setReaderMode("explore");
      if (mode === "page") {
        const target = currentPageTarget();
        endTargetPick();
        if (target) {
          if (intent === "share") void shareTargetNow(target);
          else if (intent === "report") openFeedbackModal(target, issueType, "explore");
          else selectTarget(target);
        }
        return;
      }
      targetPickMode = mode;
      targetPickIntent = intent;
      pendingFeedbackIssueType = issueType;
      shell.setAttribute("data-target-picking", mode);
      if (pickPromptLabel) {
        pickPromptLabel.textContent = mode === "panel"
          ? t("pickPanelPrompt")
          : mode === "bubble"
            ? t("pickBubblePrompt")
            : t("pickRegionPrompt");
      }
      if (pickPrompt) pickPrompt.hidden = false;
      setReaderChromeVisible(false);
      hideQuickActions();
    };
    const syncMobileExplorePan = () => {
      if (shell.getAttribute("data-mode") !== "explore" || !shell.hasAttribute("data-explore-target")) {
        shell.style.removeProperty("--reader-mobile-pan-y");
        return;
      }
      if (!window.matchMedia("(max-width: 900px)").matches) {
        shell.style.removeProperty("--reader-mobile-pan-y");
        return;
      }
      const selectedElement = track.querySelector(".reader-target.is-selected");
      const studyPanel = document.querySelector("[data-study-panel]");
      if (!selectedElement || !studyPanel) return;
      const selectedRect = selectedElement.getBoundingClientRect();
      const panelRect = studyPanel.getBoundingClientRect();
      const overlap = selectedRect.bottom - (panelRect.top - 18);
      if (overlap <= 0) {
        shell.style.removeProperty("--reader-mobile-pan-y");
        return;
      }
      shell.style.setProperty("--reader-mobile-pan-y", `${-Math.min(overlap, 180)}px`);
    };
    const syncTargetInteractivity = () => {
      const isExplore = shell.getAttribute("data-mode") === "explore";
      const isPreview = shell.getAttribute("data-target-preview") === "visible";
      track.querySelectorAll(".reader-target").forEach((target) => {
        if (isExplore || isPreview) {
          target.removeAttribute("aria-hidden");
          target.removeAttribute("tabindex");
        } else {
          target.setAttribute("aria-hidden", "true");
          target.setAttribute("tabindex", "-1");
        }
      });
    };
    const setReaderMode = (mode, viewIndex = currentViewIndex) => {
      const nextMode = mode === "explore" && views[viewIndex]?.type === "end" ? "normal" : mode;
      closeTaskSheet({ restorePreview: false });
      shell.setAttribute("data-mode", nextMode);
      if (nextMode === "normal") {
        endTargetPick();
        clearSelectedTarget();
        setReaderChromeVisible(true, { delay: 1800 });
      } else {
        hideQuickActions();
        hideTargetPreviewOverlay({ disable: true });
        hideSharedTargetButton();
        setReaderChromeVisible(true, { temporary: false });
      }
      syncTargetInteractivity();
      requestAnimationFrame(syncMobileExplorePan);
      document.querySelectorAll("[data-mode-button]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-mode-button") === nextMode);
      });
    };
    const clearTapNavigation = () => {
      if (pendingTapTimer) {
        window.clearTimeout(pendingTapTimer);
        pendingTapTimer = null;
      }
    };
    const clearDragSettle = () => {
      if (dragSettleTimer) {
        window.clearTimeout(dragSettleTimer);
        dragSettleTimer = null;
      }
    };
    const setTapSuppressed = (duration = TAP_SUPPRESSION_MS) => {
      suppressNextTap = true;
      suppressTapUntil = performance.now() + duration;
      window.setTimeout(() => {
        if (performance.now() >= suppressTapUntil) suppressNextTap = false;
      }, duration);
    };
    const isTapSuppressed = () => suppressNextTap || performance.now() < suppressTapUntil;
    const getFrameAtPoint = (event) => {
      const eventTarget = event.target?.closest ? event.target : null;
      const targetFrame = eventTarget?.closest?.(".page-frame");
      if (targetFrame) return targetFrame;
      return document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".page-frame") ?? null;
    };
    const previewNavigationFromPoint = (event) => {
      if (shell.getAttribute("data-mode") !== "normal" || shell.getAttribute("data-target-preview") !== "visible") return "";
      if (!window.matchMedia("(max-width: 720px)").matches) return "";
      const rect = viewport.getBoundingClientRect();
      const xRatio = (event.clientX - rect.left) / rect.width;
      if (xRatio < 0.28) return "next";
      if (xRatio > 0.72) return "prev";
      return "";
    };
    const handlePreviewNavigationTap = (event) => {
      const direction = previewNavigationFromPoint(event);
      if (!direction) return false;
      event.preventDefault();
      event.stopPropagation();
      clearTapNavigation();
      setReaderChromeVisible(false);
      if (direction === "next") next();
      else prev();
      return true;
    };
    const getActiveViewElement = () => {
      const view = views[currentViewIndex];
      if (!view?.id) return null;
      return track.querySelector(`[data-view="${CSS.escape(view.id)}"]`);
    };
    const getActiveImageRect = () => {
      const activeView = getActiveViewElement();
      const img = activeView?.querySelector(".page-frame img");
      return img?.getBoundingClientRect?.() ?? null;
    };
    const isOutsideActiveArtworkVertically = (event) => {
      const imageRect = getActiveImageRect();
      if (!imageRect || imageRect.height <= 0) return false;
      return event.clientY < imageRect.top || event.clientY > imageRect.bottom;
    };
    const getZoomedFrame = () => track.querySelector(".page-frame.zoomed");
    const toggleFrameZoom = (frame) => {
      if (!frame) return;
      track.querySelectorAll(".page-frame.zoomed").forEach((zoomedFrame) => {
        if (zoomedFrame !== frame) zoomedFrame.classList.remove("zoomed");
      });
      frame.classList.toggle("zoomed");
    };
    const getSwipeThreshold = () => Math.min(SWIPE_MAX_DISTANCE, Math.max(SWIPE_MIN_DISTANCE, lastWidth * 0.16));
    const isTargetPreviewActive = () => {
      if (targetPickMode) return false;
      return shell.getAttribute("data-target-preview") === "visible" || shell.getAttribute("data-mode") === "explore";
    };
    const startTargetPreviewGesture = (event) => {
      if (!isTargetPreviewActive()) return false;
      event.stopPropagation();
      window.clearTimeout(longPressTimer);
      clearTapNavigation();
      targetPreviewGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: performance.now(),
      };
      try {
        event.currentTarget?.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser cancels the touch before it starts.
      }
      return true;
    };
    const moveTargetPreviewGesture = (event) => {
      if (!targetPreviewGesture || targetPreviewGesture.pointerId !== event.pointerId) return false;
      event.stopPropagation();
      const xOffset = event.clientX - targetPreviewGesture.startX;
      const yOffset = event.clientY - targetPreviewGesture.startY;
      if (Math.abs(xOffset) > DRAG_START_DISTANCE && Math.abs(xOffset) > Math.abs(yOffset) * SWIPE_AXIS_RATIO && event.cancelable) {
        event.preventDefault();
      }
      return true;
    };
    const endTargetPreviewGesture = (event) => {
      if (!targetPreviewGesture || targetPreviewGesture.pointerId !== event.pointerId) return false;
      event.stopPropagation();
      window.clearTimeout(longPressTimer);
      try {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
      } catch {
        // The pointer may have already been released by the browser.
      }
      const xOffset = event.clientX - targetPreviewGesture.startX;
      const yOffset = event.clientY - targetPreviewGesture.startY;
      const absX = Math.abs(xOffset);
      const absY = Math.abs(yOffset);
      const elapsed = Math.max(1, performance.now() - targetPreviewGesture.startedAt);
      const velocity = absX / elapsed;
      const hasSwipeAxis = absX > absY * SWIPE_AXIS_RATIO;
      const hasSwipeDistance = absX >= getSwipeThreshold() || (absX >= 18 && velocity >= SWIPE_VELOCITY);
      targetPreviewGesture = null;
      if (!getZoomedFrame() && hasSwipeAxis && hasSwipeDistance) {
        if (event.cancelable) event.preventDefault();
        suppressNextTargetClick = true;
        setTapSuppressed();
        setReaderChromeVisible(false);
        if (xOffset > 0) next();
        else prev();
        return true;
      }
      return false;
    };
    const cancelTargetPreviewGesture = (event) => {
      if (targetPreviewGesture?.pointerId !== event.pointerId) return false;
      event.stopPropagation();
      targetPreviewGesture = null;
      try {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
      } catch {
        // The pointer may have already been released by the browser.
      }
      return true;
    };
    const capturePointer = (pointerId) => {
      try {
        viewport.setPointerCapture?.(pointerId);
      } catch {
        // Pointer capture can fail if the browser already canceled the gesture.
      }
    };
    const releasePointer = (pointerId) => {
      try {
        viewport.releasePointerCapture?.(pointerId);
      } catch {
        // Some browser automation and interrupted touch gestures release first.
      }
    };
    const scheduleDragSettle = (event) => {
      clearDragSettle();
      const fallbackEvent = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId ?? activePointerId,
      };
      dragSettleTimer = window.setTimeout(() => {
        if (isDragging) finishPointerGesture(fallbackEvent);
        else if (dragOffset !== 0) {
          dragOffset = 0;
          render(0, true);
        }
      }, DRAG_SETTLE_TIMEOUT_MS);
    };
    const sourceUrlFor = (target) => {
      const url = new URL(window.location.href);
      if (target?.modeOverride === "episode") {
        url.searchParams.delete("page");
        url.searchParams.delete("focus");
        url.searchParams.delete("region");
        applyLanguageToUrl(url);
        url.hash = "";
        return url.toString();
      }
      if (target?.bubble) url.searchParams.set("focus", target.bubble.id);
      else if (target?.panel) url.searchParams.set("focus", target.panel.id);
      else if (target?.page) url.searchParams.set("page", getPageId(target.page));
      if (target?.region) {
        url.searchParams.set(
          "region",
          `${Math.round(target.region.x * 1000) / 1000},${Math.round(target.region.y * 1000) / 1000}`,
        );
      }
      applyLanguageToUrl(url);
      return url.toString();
    };
    const hrefWithLanguage = (href) => {
      if (!href) return "";
      const url = new URL(href, window.location.href);
      applyLanguageToUrl(url);
      return `${url.pathname}${url.search}${url.hash}`;
    };
    const publicRefSegment = (value) => encodeURIComponent(String(value || "").trim());
    const panelShareRef = (panel) =>
      panel?.displayRef
      || panel?.shortId
      || (Number.isFinite(Number(panel?.panelNumber)) ? `k${String(panel.panelNumber).padStart(2, "0")}` : panel?.id);
    const bubbleShareRef = (bubble) =>
      bubble?.displayRef
      || bubble?.shortId
      || (Number.isFinite(Number(bubble?.bubbleNumber)) ? `f${String(bubble.bubbleNumber).padStart(2, "0")}` : bubble?.id);
    const shareFacadeUrlFor = (target) => {
      const url = new URL(
        `/s/${publicRefSegment(seriesId)}/${publicRefSegment(episodeIdValue)}`,
        window.location.href,
      );
      const page = target?.page;
      if (page?.pageNumber) {
        url.pathname += `/p/${encodeURIComponent(String(page.pageNumber))}`;
      }
      if (target?.bubble) {
        const ref = bubbleShareRef(target.bubble);
        if (ref) url.pathname += `/f/${publicRefSegment(ref)}`;
      } else if (target?.panel) {
        const ref = panelShareRef(target.panel);
        if (ref) url.pathname += `/k/${publicRefSegment(ref)}`;
      }
      applyLanguageToUrl(url);
      return url.toString();
    };
    const shareUrlForService = (service, url, text) => {
      const encodedUrl = encodeURIComponent(url);
      const encodedText = encodeURIComponent(text);
      if (service === "x") return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
      if (service === "line") return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
      if (service === "bluesky") return `https://bsky.app/intent/compose?text=${encodedText}%20${encodedUrl}`;
      return url;
    };
    const samePublicTitle = (a, b) => {
      const left = String(a || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      const right = String(b || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      return left.length > 0 && left === right;
    };
    const episodeShareTitle = () => {
      if (!episodeTitleValue || samePublicTitle(seriesTitleValue, episodeTitleValue)) return seriesTitleValue || episodeTitleValue;
      return [seriesTitleValue, episodeTitleValue].filter(Boolean).join(" - ");
    };
    const normalizeSpeaker = (speaker) => {
      const value = String(speaker || "").trim();
      if (!value || value.toLowerCase() === "unknown") return "";
      return value;
    };
    const quotedTextFor = (text) => {
      const value = String(text || "").trim();
      return value ? `「${value}」` : "";
    };
    const localizedTextForBubble = (bubble, page) => {
      if (!bubble || contentLocale === "ja") return String(bubble?.textOriginal || "").trim();
      for (const pack of page?.availablePacks || []) {
        if (pack?.type !== "TRANSLATION" || pack?.language !== contentLocale) continue;
        const entry = (pack.entries || []).find((item) => item?.target?.bubbleId === bubble.id);
        const text = String(entry?.text || "").trim();
        if (text) return text;
      }
      return String(bubble.textOriginal || "").trim();
    };
    const bubbleLineFor = (bubble, page) => {
      const quotedText = quotedTextFor(localizedTextForBubble(bubble, page));
      if (!quotedText) return "";
      const speaker = normalizeSpeaker(bubble?.speaker);
      return speaker ? `${speaker}${quotedText}` : quotedText;
    };
    const targetTextLinesFor = (target) => {
      if (target?.bubble) {
        const line = bubbleLineFor(target.bubble, target.page);
        return line ? [line] : [];
      }
      if (target?.panel) {
        return (target.panel.bubbles || [])
          .map((bubble) => bubbleLineFor(bubble, target.page))
          .filter(Boolean);
      }
      return [];
    };
    const targetTextFor = (target) => targetTextLinesFor(target).join("\n");
    const targetSourcePreviewFor = (target) => targetTextFor(target).trim();
    const shareTitleFor = (target) => {
      const base = episodeShareTitle() || targetLabelFor(target);
      if (target?.bubble) return base;
      if (target?.panel) return base;
      if (target?.page) return `${base} / ${target.page.displayRef || `p${String(target.page.pageNumber).padStart(2, "0")}`}`;
      return base;
    };
    const closeShareSheet = () => {
      if (shareSheet) shareSheet.hidden = true;
      shareTargetState = null;
      restoreTargetPreviewAfterOverlay();
    };
    const openShareSheet = (target) => {
      const url = shareFacadeUrlFor(target);
      const label = shareTitleFor(target);
      const body = targetTextFor(target);
      const serviceText = body || label;
      shareTargetState = { target, url, label, text: body, serviceText };
      if (shareTitle) shareTitle.textContent = label;
      if (shareTarget) {
        shareTarget.hidden = !body;
        shareTarget.textContent = body;
      }
      if (shareXLink) shareXLink.setAttribute("href", shareUrlForService("x", url, serviceText));
      if (shareLineLink) shareLineLink.setAttribute("href", shareUrlForService("line", url, label));
      if (shareBlueskyLink) shareBlueskyLink.setAttribute("href", shareUrlForService("bluesky", url, serviceText));
      if (shareSheet) shareSheet.hidden = false;
      closeContextMenu();
    };
    const copyShareUrl = async (url) => {
      await navigator.clipboard?.writeText(url);
      showToast(t("linkCopied"));
    };
    const shareTargetNow = async (target) => {
      openShareSheet(target);
    };
    const currentPageData = () => pages.find((page) => String(page.pageNumber) === String(activePage)) || pages[0];
    const currentPageTarget = () => {
      const page = currentPageData();
      return page ? { page } : null;
    };
    const targetActionTitleFor = (target) => {
      if (target?.bubble || target?.panel) return targetTextFor(target) || "";
      return "";
    };
    const closeTaskSheet = (options = {}) => {
      const { restorePreview = true } = options;
      if (taskSheet) taskSheet.hidden = true;
      if (taskOptions) taskOptions.innerHTML = "";
      taskSheetTarget = null;
      taskSheetTrigger?.focus?.();
      taskSheetTrigger = null;
      if (restorePreview && targetPreviewEnabled && shell.getAttribute("data-mode") === "normal" && !isFeedbackOpen()) {
        restoreTargetPreviewAfterOverlay();
      }
    };
    const taskOptionMarkup = ({ label, action, description = "", disabled = false }) => `
      <button
        type="button"
        class="reader-task-option"
        data-task-action="${escapeHtml(action)}"
        ${disabled ? "disabled" : ""}
      >
        <span>${escapeHtml(label)}</span>
        ${disabled || description ? `<small>${escapeHtml(disabled ? t("targetUnavailable") : description)}</small>` : ""}
      </button>
    `;
    const openTargetActionSheet = (target, trigger = document.activeElement) => {
      if (!taskSheet || !taskOptions || !target?.page) return;
      taskSheetTarget = target;
      taskSheetTrigger = trigger;
      clearSharedTargetHighlight();
      if (taskKicker) {
        taskKicker.hidden = true;
        taskKicker.textContent = "";
      }
      const title = targetActionTitleFor(target);
      if (taskTitle) {
        taskTitle.hidden = !title;
        taskTitle.textContent = title;
      }
      if (taskDescription) {
        taskDescription.hidden = true;
        taskDescription.textContent = "";
      }
      taskOptions.innerHTML = [
        { label: t("targetActionShare"), action: "target:share" },
        { label: t("targetActionReport"), action: "target:report" },
      ].map(taskOptionMarkup).join("");
      taskSheet.hidden = false;
      hideQuickActions();
      hideTargetPreviewOverlay();
      closeContextMenu();
      setReaderChromeVisible(true, { temporary: false });
    };
    const handleTaskAction = async (action) => {
      if (action.startsWith("target:")) {
        const target = taskSheetTarget;
        closeTaskSheet({ restorePreview: false });
        if (!target) return;
        if (action === "target:share") {
          await shareTargetNow(target);
          return;
        }
        if (action === "target:report") {
          openFeedbackModal(target, "other", "read");
          return;
        }
        return;
      }
      closeTaskSheet();
      const pageTarget = currentPageTarget();
      if (action === "share:episode") {
        await shareTargetNow({ modeOverride: "episode" });
        return;
      }
      if (action === "share:page" && pageTarget) {
        await shareTargetNow(pageTarget);
        return;
      }
      if (action === "share:panel" || action === "share:bubble") {
        beginTargetPick(action.endsWith("panel") ? "panel" : "bubble", "share");
        return;
      }
      if (action === "report:viewer") {
        openFeedbackModal({ modeOverride: "episode" }, "display", "read", {
          allowedIssueTypes: ["display", "broken_link", "other"],
        });
        return;
      }
      if (action === "report:episode") {
        openFeedbackModal({ modeOverride: "episode" }, "other", "read");
        return;
      }
      if (action === "report:page" && pageTarget) {
        openFeedbackModal(pageTarget, "other", "read");
        return;
      }
      if (action === "report:panel" || action === "report:bubble" || action === "report:region") {
        const mode = action.split(":")[1] || "page";
        beginTargetPick(mode, "report", mode === "region" ? "display" : "other");
        return;
      }
      if (action === "inspect:page" && pageTarget) {
        setReaderMode("explore");
        selectTarget(pageTarget);
        return;
      }
      if (action === "inspect:panel" || action === "inspect:bubble") {
        beginTargetPick(action.endsWith("panel") ? "panel" : "bubble", "inspect");
      }
    };
    const completeTargetPick = async (target) => {
      const intent = targetPickIntent;
      const issueType = pendingFeedbackIssueType;
      selectTarget(target);
      if (intent === "share") {
        await shareTargetNow(target);
      } else if (intent === "report") {
        openFeedbackModal(target, issueType || "other", "explore");
      } else if (intent === "inspect") {
        setReaderMode("explore");
        selectTarget(target);
      }
    };
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const packTypeLabel = (type) => {
      if (type === "TRANSLATION") return "Translation";
      if (type === "FOOTNOTE") return "Footnote";
      if (type === "COMMENTARY") return "Commentary";
      if (type === "LEARNING") return "Learning";
      if (type === "ACCESSIBILITY") return "Accessibility";
      return "Extra";
    };
    const entryMatchesTarget = (entry, target) => {
      const entryTarget = entry?.target || {};
      if (entryTarget.bubbleId) return target?.bubble?.id === entryTarget.bubbleId;
      if (entryTarget.panelId) return target?.panel?.id === entryTarget.panelId;
      if (entryTarget.pageId) return target?.page && getPageId(target.page) === entryTarget.pageId;
      return Boolean(target?.page);
    };
    const renderPackEntries = (target) => {
      const pagePacks = target?.page?.availablePacks || [];
      const matches = [];
      for (const pack of pagePacks) {
        for (const entry of pack.entries || []) {
          if (entryMatchesTarget(entry, target)) matches.push({ pack, entry });
        }
      }
      if (matches.length === 0) return "";
      return `
        <div class="pack-entry-list" aria-label="Published notes">
          ${matches.map(({ pack, entry }) => {
            const body = entry.text || entry.note || entry.originalText || "";
            const title = `${packTypeLabel(pack.type)}${pack.language ? ` / ${pack.language}` : ""}`;
            return `
              <article class="pack-entry">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(body || pack.title || pack.id)}</p>
              </article>
            `;
          }).join("")}
        </div>
      `;
    };
    const makePayloadBase = (target, mode) => ({
      series_id: seriesId,
      episode_id: episodeIdValue,
      page_id: target?.page ? getPageId(target.page) : null,
      panel_id: target?.panel?.id ?? null,
      bubble_id: target?.bubble?.id ?? null,
      mode,
      lang: contentLocale,
      current_text: target?.bubble ? localizedTextForBubble(target.bubble, target.page) : "",
      source_url: sourceUrlFor(target),
      client_time: new Date().toISOString(),
    });
    const selectTarget = (target) => {
      selectedTarget = target;
      const targetType = target?.bubble ? "bubble" : target?.panel ? "panel" : target?.region ? "region" : target?.page ? "page" : "";
      if (targetType) shell.setAttribute("data-explore-target", targetType);
      else shell.removeAttribute("data-explore-target");
      track
        .querySelectorAll(".reader-target.is-selected, .reader-bubble-highlight.is-selected")
        .forEach((el) => el.classList.remove("is-selected"));
      const selector = target?.bubble
        ? `[data-bubble-id="${CSS.escape(target.bubble.id)}"]`
        : target?.panel
          ? `[data-panel-id="${CSS.escape(target.panel.id)}"]`
          : "";
      if (selector) {
        track.querySelectorAll(selector).forEach((el) => el.classList.add("is-selected"));
      }
      if (target?.panel || target?.bubble || target?.region) endTargetPick();
      requestAnimationFrame(syncMobileExplorePan);
      if (!exploreTitle || !exploreSummary || !exploreDetail) return;
      if (target?.bubble) {
        const bubbleText = localizedTextForBubble(target.bubble, target.page);
        exploreTitle.textContent = t("bubbleTitle");
        exploreSummary.textContent = bubbleText || t("bubbleMissingText");
        exploreDetail.innerHTML = `
          <p class="target-meta text-muted">${escapeHtml(t("bubbleShortId", { id: target.bubble.shortId || target.bubble.bubbleNumber }))}</p>
          <h3 class="target-title">${escapeHtml(bubbleText || t("bubbleMissingHeading"))}</h3>
          <p class="target-submeta text-muted">${escapeHtml(t("bubbleMeta", { speaker: target.bubble.speaker || "unknown", type: target.bubble.bubbleType || "speech" }))}</p>
          ${renderPackEntries(target)}
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="share">${escapeHtml(t("actionShare"))}</button>
            <button type="button" class="btn-viewer btn-primary-viewer" data-feedback-action="better_translation">${escapeHtml(t("actionBetterTranslation"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="mistranslation">${escapeHtml(t("actionMistranslation"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">${escapeHtml(t("actionMissingNote"))}</button>
          </div>
        `;
      } else if (target?.panel) {
        exploreTitle.textContent = t("panelTitle");
        exploreSummary.textContent = t("panelSummary", { panelNumber: target.panel.panelNumber });
        const panelText = targetTextFor(target) || t("targetActionNoText");
        exploreDetail.innerHTML = `
          <p class="target-meta text-muted">${escapeHtml(t("panelMeta", { panelNumber: target.panel.panelNumber, bubbleCount: target.panel.bubbles?.length || 0 }))}</p>
          <h3 class="target-title">${escapeHtml(panelText)}</h3>
          ${renderPackEntries(target)}
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="share">${escapeHtml(t("actionShare"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="display">${escapeHtml(t("actionDisplay"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">${escapeHtml(t("actionMissingNote"))}</button>
          </div>
        `;
      } else if (target?.region && target?.page) {
        exploreTitle.textContent = t("targetRegion", { pageNumber: target.page.pageNumber });
        exploreSummary.textContent = t("noteAnchorCandidate", {
          x: Math.round(target.region.x * 100),
          y: Math.round(target.region.y * 100),
        });
        exploreDetail.innerHTML = `
          <p class="target-meta text-muted">${escapeHtml(targetLabelFor(target))}</p>
          <h3 class="target-title">${escapeHtml(t("targetRegion", { pageNumber: target.page.pageNumber }))}</h3>
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="display">${escapeHtml(t("actionDisplay"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">${escapeHtml(t("actionMissingNote"))}</button>
          </div>
        `;
      } else if (target?.page) {
        exploreTitle.textContent = t("targetPage", { pageNumber: target.page.pageNumber });
        exploreSummary.textContent = t("pageInfo", {
          pageNumber: target.page.pageNumber,
          panelCount: target.page.panels?.length || 0,
          bubbleCount: (target.page.panels || []).reduce((sum, panel) => sum + (panel.bubbles?.length || 0), 0),
        });
        exploreDetail.innerHTML = `
          <p class="target-meta text-muted">${escapeHtml(targetLabelFor(target))}</p>
          <h3 class="target-title">${escapeHtml(t("targetPage", { pageNumber: target.page.pageNumber }))}</h3>
          ${renderPackEntries(target)}
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="share">${escapeHtml(t("actionShare"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="display">${escapeHtml(t("actionDisplay"))}</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">${escapeHtml(t("actionMissingNote"))}</button>
          </div>
        `;
      }
    };
    const flashSharedTarget = (target, duration = 2400) => {
      clearSharedTargetHighlight();
      if (!target?.panel && !target?.bubble) {
        revealReader();
        return;
      }
      const selector = target?.bubble
        ? `[data-bubble-id="${CSS.escape(target.bubble.id)}"]`
        : `[data-panel-id="${CSS.escape(target.panel.id)}"]`;
      track.querySelectorAll(selector).forEach((el) => el.classList.add("is-shared-focus"));
      shell.setAttribute("data-shared-target-highlight", "visible");
      hideTargetPreviewOverlay({ disable: true });
      setReaderChromeVisible(true, { delay: 1200 });
      revealReader();
      sharedTargetHighlightTimer = window.setTimeout(clearSharedTargetHighlight, duration);
    };
    const openFeedbackModal = (
      target,
      issueType = "other",
      mode = shell.getAttribute("data-mode") === "explore" ? "explore" : "read",
      options = {},
    ) => {
      feedbackTargetState = target;
      hideQuickActions();
      if (feedbackTitle) {
        feedbackTitle.textContent = mode === "completion"
          ? t("feedbackTitleCompletion")
          : mode === "explore"
            ? t("feedbackTitleExplore")
            : t("feedbackTitleReport");
      }
      if (feedbackTarget) {
        feedbackTarget.textContent = targetLabelFor(target);
      }
      if (feedbackSourceText) {
        const sourceText = targetSourcePreviewFor(target);
        feedbackSourceText.hidden = !sourceText;
        feedbackSourceText.textContent = sourceText ? `${t("sourceTextLabel")}: ${sourceText}` : "";
      }
      syncFeedbackIssueOptions(options.allowedIssueTypes);
      if (feedbackIssue) feedbackIssue.value = issueType;
      resetFeedbackIdentity();
      if (feedbackComment) feedbackComment.value = "";
      if (feedbackSuggested) feedbackSuggested.value = "";
      if (feedbackTerms) feedbackTerms.checked = false;
      if (feedbackSuggestedWrap) feedbackSuggestedWrap.hidden = !(issueType === "better_translation" || issueType === "missing_note");
      renderFeedbackStatus();
      updateFeedbackSubmitState();
      if (feedbackModal) feedbackModal.hidden = false;
      closeContextMenu();
    };
    const openContextMenu = (event, target) => {
      if (!contextMenu) return;
      event.preventDefault();
      selectTarget(target);
      const isBubble = Boolean(target.bubble);
      contextMenu.innerHTML = `
        <strong>${escapeHtml(isBubble ? t("bubbleTitle") : t("panelTitle"))}</strong>
        <button type="button" data-menu-action="share">${escapeHtml(t("actionShare"))}</button>
        ${isBubble ? "" : `<button type="button" data-menu-action="clip" disabled>${escapeHtml(t("contextClipComing"))}</button>`}
        <button type="button" data-menu-action="explore">${escapeHtml(t("contextExplore"))}</button>
        <button type="button" data-menu-action="report">${escapeHtml(t("contextReport"))}</button>
      `;
      contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 210)}px`;
      contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 220)}px`;
      contextMenu.hidden = false;
    };
    const startLongPress = (event, target) => {
      window.clearTimeout(longPressTimer);
      longPressTimer = window.setTimeout(() => {
        suppressNextImageClick = true;
        openContextMenu(event, target);
      }, 620);
    };
    const openContextMenuAtElement = (element, target) => {
      if (!contextMenu) return;
      const rect = element.getBoundingClientRect();
      openContextMenu({
        preventDefault() { },
        clientX: rect.left + Math.min(rect.width / 2, 120),
        clientY: rect.top + Math.min(rect.height / 2, 120),
      }, target);
    };

    document.querySelectorAll("[data-mode-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-mode-button") ?? "normal";
        endTargetPick();
        setReaderMode(mode);
      });
    });

    document.querySelectorAll("[data-ui-locale-button]").forEach((button) => {
      button.addEventListener("click", () => {
        applyUiLocale(button.getAttribute("data-ui-locale-button"), { updateUrl: true });
        buildDOM();
        render(0, false);
        updateActivePage();
        if (selectedTarget) selectTarget(selectedTarget);
      });
    });
    localeSelect?.addEventListener("change", () => {
      applyUiLocale(localeSelect.value, { updateUrl: true });
      buildDOM();
      render(0, false);
      updateActivePage();
      if (selectedTarget) selectTarget(selectedTarget);
    });

    document.querySelectorAll("[data-reader-theme-button]").forEach((button) => {
      button.addEventListener("click", () => {
        applyReaderTheme(button.getAttribute("data-reader-theme-button"));
      });
    });

    document.querySelectorAll("[data-reader-layout-button]").forEach((button) => {
      button.addEventListener("click", () => {
        applyReaderLayout(button.getAttribute("data-reader-layout-button"));
        setReaderChromeVisible(true, { delay: 2200 });
      });
    });

    settingsToggleButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSettingsMenu();
      setReaderChromeVisible(true, { temporary: false });
      hideTargetPreviewOverlay({ disable: true });
    });

    settingsRoot?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    settingsRoot?.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });
    settingsRoot?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.querySelectorAll("[data-reader-target-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-reader-target-pick") || "page";
        beginTargetPick(mode, "report", mode === "region" ? "display" : "other");
      });
    });

    pickCancelButton?.addEventListener("click", () => {
      endTargetPick();
      setReaderChromeVisible(true, { temporary: false });
    });

    startOverButton?.addEventListener("click", () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("page");
      nextUrl.searchParams.delete("focus");
      nextUrl.searchParams.delete("region");
      nextUrl.hash = "";
      history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}`);
      startOverButton.hidden = true;
      setReaderMode("normal");
      void goToPage(1, { animate: false, requireReady: true, loadingMessage: t("loadingPage") });
    });

    toolbar?.addEventListener("pointerenter", () => {
      setReaderChromeVisible(true, { temporary: false });
    });

    toolbar?.addEventListener("pointerleave", () => {
      if (shell.getAttribute("data-mode") === "normal") {
        setReaderChromeVisible(true, { delay: 1200 });
      }
    });

    document.addEventListener("click", (event) => {
      if (contextMenu && !contextMenu.hidden && !contextMenu.contains(event.target)) {
        closeContextMenu();
      }
      if (settingsRoot && !settingsRoot.contains(event.target)) {
        closeSettingsMenu();
      }
    });

    contextMenu?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target?.closest ? target.closest("button[data-menu-action]") : null;
      if (!button || !selectedTarget) return;
      const action = button.getAttribute("data-menu-action");
      if (action === "share") {
        await shareTargetNow(selectedTarget);
        closeContextMenu();
      } else if (action === "explore") {
        setReaderMode("explore");
        selectTarget(selectedTarget);
        closeContextMenu();
      } else if (action === "report") {
        openFeedbackModal(selectedTarget, "other", "read");
      }
    });

    quickActions?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    quickActions?.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });
    quickShareButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealReaderActions(TARGET_PREVIEW_VISIBLE_MS);
    });
    quickFeedbackButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealReaderActions(TARGET_PREVIEW_VISIBLE_MS);
    });
    quickInspectButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealReaderActions(TARGET_PREVIEW_VISIBLE_MS);
    });
    taskSheet?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    taskSheet?.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });
    document.querySelectorAll("[data-task-close]").forEach((close) => {
      close.addEventListener("click", closeTaskSheet);
    });
    taskOptions?.addEventListener("click", (event) => {
      const target = event.target;
      const button = target?.closest ? target.closest("button[data-task-action]") : null;
      if (!button || button.disabled) return;
      void handleTaskAction(button.getAttribute("data-task-action") || "");
    });
    pageScrubber?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    pageScrubber?.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });
    pageScrubber?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    pageScrubberRange?.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    pageScrubberRange?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      isScrubbingPage = true;
      setReaderChromeVisible(true, { temporary: false });
    });
    pageScrubberRange?.addEventListener("input", () => {
      isScrubbingPage = true;
      syncPageScrubber(Number(pageScrubberRange.value) || Number(activePage) || 1, { preview: true });
    });
    pageScrubberRange?.addEventListener("change", commitScrubberPage);
    pageScrubberRange?.addEventListener("pointerup", (event) => {
      event.stopPropagation();
      if (isScrubbingPage) commitScrubberPage();
    });
    pageScrubberRange?.addEventListener("pointercancel", () => {
      isScrubbingPage = false;
      syncPageScrubber();
    });

    exploreDetail?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target?.closest ? target.closest("button[data-feedback-action]") : null;
      if (!button || !selectedTarget) return;
      const action = button.getAttribute("data-feedback-action");
      if (action === "share") {
        await shareTargetNow(selectedTarget);
        return;
      }
      openFeedbackModal(selectedTarget, action || "other", "explore");
    });

    document.querySelectorAll("[data-share-close]").forEach((close) => {
      close.addEventListener("click", closeShareSheet);
    });

    shareNativeButton?.addEventListener("click", async () => {
      if (!shareTargetState) return;
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTargetState.label,
            ...(shareTargetState.text ? { text: shareTargetState.text } : {}),
            url: shareTargetState.url,
          });
          closeShareSheet();
          return;
        } catch {
          showToast(t("shareNativeFailed"));
        }
      } else {
        showToast(t("shareNativeFailed"));
      }
    });
    if (shareNativeButton && !navigator.share) {
      shareNativeButton.hidden = true;
    }

    shareCopyButton?.addEventListener("click", async () => {
      if (!shareTargetState) return;
      await copyShareUrl(shareTargetState.url);
      closeShareSheet();
    });

    document.querySelectorAll("[data-feedback-close]").forEach((close) => {
      close.addEventListener("click", () => {
        if (feedbackModal) feedbackModal.hidden = true;
        restoreTargetPreviewAfterOverlay();
      });
    });

    feedbackIssue?.addEventListener("change", () => {
      if (feedbackSuggestedWrap) {
        feedbackSuggestedWrap.hidden = !(feedbackIssue.value === "better_translation" || feedbackIssue.value === "missing_note");
      }
      updateFeedbackSubmitState();
    });

    feedbackIdentityLevels.forEach((input) => {
      input.addEventListener("change", updateFeedbackIdentityFields);
    });
    feedbackComment?.addEventListener("input", updateFeedbackSubmitState);
    feedbackSuggested?.addEventListener("input", updateFeedbackSubmitState);
    feedbackTerms?.addEventListener("change", updateFeedbackSubmitState);

    feedbackForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      updateFeedbackSubmitState();
      if (feedbackSubmit?.disabled) return;
      const form = event.currentTarget;
      const formData = new FormData(form);
      const issueType = String(formData.get("issue_type") || "other");
      const mode = feedbackTargetState?.modeOverride || (shell.getAttribute("data-mode") === "explore" ? "explore" : "read");
      const payload = {
        ...makePayloadBase(feedbackTargetState, mode),
        issue_type: issueType,
        comment: String(formData.get("comment") || "").trim(),
        suggested_text: String(formData.get("suggested_text") || "").trim(),
        contributor_identity: contributorIdentityFromForm(formData),
        contributor_terms_accepted: formData.get("contributor_terms") === "accepted",
        website: String(formData.get("website") || ""),
        user_agent: navigator.userAgent,
      };
      feedbackSubmitting = true;
      updateFeedbackSubmitState();
      try {
        const res = await fetch(`${feedbackApiBase}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          throw new Error(data.error?.message || t("feedbackFailed"));
        }
        writeFeedbackStatus({
          feedback_id: extractFeedbackId(data),
          status: "submitted",
          target_label: targetLabelFor(feedbackTargetState),
          issue_type: issueType,
          submitted_at: new Date().toISOString(),
        });
        renderFeedbackStatus();
        if (feedbackModal) feedbackModal.hidden = true;
        restoreTargetPreviewAfterOverlay();
        showToast(mode === "completion" ? t("feedbackSent") : t("reportSent"));
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("sendFailed"));
      } finally {
        feedbackSubmitting = false;
        updateFeedbackSubmitState();
      }
    });

    if (noteInput) {
      noteInput.addEventListener("input", () => {
        writeNotePatch({ text: noteInput.value });
      });
    }

    noteScope?.addEventListener("change", () => {
      writeNotePatch({ scope: noteScope.value });
    });

    noteTarget?.addEventListener("input", () => {
      writeNotePatch({ target: noteTarget.value });
    });

    const getPage = (pageNumber) => pages.find((page) => page.pageNumber === pageNumber);
    const findTargetById = (id) => {
      if (!id) return null;
      for (const page of pages) {
        if (page.id === id || getPageId(page) === id || `p${page.pageNumber}` === id) {
          return { page };
        }
        for (const panel of page.panels || []) {
          if (panel.id === id) return { page, panel };
          for (const bubble of panel.bubbles || []) {
            if (bubble.id === id || bubble.shortId === id) return { page, panel, bubble };
          }
        }
      }
      return null;
    };

    const calculateViews = () => {
      const useSpread = readerLayout === "spread" && canUseSpreadLayout();
      const nextViews = [];
      if (!useSpread) {
        for (const page of pages) {
          nextViews.push({ id: `p${page.pageNumber}`, pages: [page], single: true, align: "center" });
        }
      } else {
        nextViews.push({ id: "p1", pages: [pages[0]], single: true, align: "right" });
        for (let i = 1; i < pages.length; i += 2) {
          const rightPage = pages[i];
          const leftPage = pages[i + 1];
          nextViews.push({
            id: `spread-${rightPage.pageNumber}`,
            pages: leftPage ? [leftPage, rightPage] : [rightPage],
            single: !leftPage,
            align: leftPage ? "center" : "right",
          });
        }
      }
      nextViews.push({ id: "end", type: "end", pages: [] });
      return nextViews;
    };

    const createPageFrame = (page) => {
      const frame = document.createElement("article");
      frame.className = "page-frame";
      frame.dataset.page = String(page.pageNumber);
      frame.dataset.imageState = "idle";
      frame.innerHTML = `
        <div class="page-image-wrap" style="--page-aspect-ratio: ${Number(page.width) || 1} / ${Number(page.height) || 1}; --page-aspect-value: ${(Number(page.width) && Number(page.height)) ? (Number(page.width) / Number(page.height)).toFixed(6) : "0.707107"};">
          <img
            data-src="${readerImageSrcFor(page)}"
            alt="${t("pageAlt", { page: page.pageNumber })}"
            width="${page.width}"
            height="${page.height}"
            decoding="async"
            loading="eager"
            draggable="false"
          />
          <span class="page-image-status" aria-live="polite">
            <span>${t("imageLoadError")}</span>
            <button type="button" class="page-image-reload" data-image-reload>${t("imageReload")}</button>
          </span>
          <div class="reader-target-layer"></div>
        </div>
        <div class="page-info text-muted">
          ${escapeHtml(t("pageInfo", {
            pageNumber: page.pageNumber,
            panelCount: page.panels?.length || 0,
            bubbleCount: (page.panels || []).reduce((sum, panel) => sum + (panel.bubbles?.length || 0), 0),
          }))}
        </div>
      `;
      const pageImage = frame.querySelector("img[data-src]");
      if (pageImage) attachPageImageHandlers(pageImage, page);
      frame.querySelector("[data-image-reload]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.reload();
      });
      const layer = frame.querySelector(".reader-target-layer");
      if (layer) {
        const pageTargetButton = document.createElement("button");
        pageTargetButton.type = "button";
        pageTargetButton.className = "reader-target reader-page-target";
        pageTargetButton.setAttribute("aria-label", t("targetPage", { pageNumber: page.pageNumber }));
        pageTargetButton.textContent = t("targetPreviewPage");
        const pageTarget = { page };
        pageTargetButton.addEventListener("click", (event) => {
          if (shell.getAttribute("data-mode") === "normal" && shell.getAttribute("data-target-preview") === "visible") {
            event.preventDefault();
            event.stopPropagation();
            openTargetActionSheet(pageTarget, pageTargetButton);
          }
        });
        pageTargetButton.addEventListener("pointerdown", (event) => {
          if (shell.getAttribute("data-target-preview") === "visible") event.stopPropagation();
        });
        layer.appendChild(pageTargetButton);
      }
      for (const panel of page.panels || []) {
        if (panel.feedbackEnabled !== false) {
          const panelStyle = boxStyle(panel.bbox, page);
          if (panelStyle) {
            const panelTarget = document.createElement("button");
            panelTarget.type = "button";
            panelTarget.className = "reader-target reader-panel-target";
            panelTarget.dataset.panelId = panel.id;
            panelTarget.setAttribute("aria-label", t("panelAria", { panelNumber: panel.panelNumber }));
            panelTarget.setAttribute("style", panelStyle);
            const target = { page, panel };
            panelTarget.addEventListener("contextmenu", (event) => openContextMenu(event, target));
            panelTarget.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openContextMenuAtElement(panelTarget, target);
              }
            });
            panelTarget.addEventListener("click", (event) => {
              if (suppressNextTargetClick) {
                event.preventDefault();
                event.stopPropagation();
                suppressNextTargetClick = false;
                return;
              }
              if (suppressNextImageClick) {
                event.preventDefault();
                event.stopPropagation();
                suppressNextImageClick = false;
                return;
              }
              if (
                shell.getAttribute("data-mode") === "normal"
                && (shell.getAttribute("data-target-preview") === "visible" || panelTarget.classList.contains("is-shared-focus"))
              ) {
                event.preventDefault();
                event.stopPropagation();
                openTargetActionSheet(target, panelTarget);
                return;
              }
              if (handlePreviewNavigationTap(event)) return;
              if (shell.getAttribute("data-mode") !== "explore") return;
              if (targetPickMode && targetPickMode !== "panel") return;
              event.stopPropagation();
              if (targetPickMode) void completeTargetPick(target);
              else selectTarget(target);
            });
            panelTarget.addEventListener("pointerdown", (event) => {
              if (startTargetPreviewGesture(event)) return;
              if (
                shell.getAttribute("data-mode") === "explore"
                || shell.getAttribute("data-target-preview") === "visible"
                || panelTarget.classList.contains("is-shared-focus")
              ) event.stopPropagation();
              startLongPress(event, target);
            });
            panelTarget.addEventListener("pointerup", (event) => {
              if (endTargetPreviewGesture(event)) return;
              window.clearTimeout(longPressTimer);
            });
            panelTarget.addEventListener("pointercancel", (event) => {
              if (cancelTargetPreviewGesture(event)) return;
              window.clearTimeout(longPressTimer);
            });
            panelTarget.addEventListener("pointermove", (event) => {
              if (moveTargetPreviewGesture(event)) return;
              window.clearTimeout(longPressTimer);
            });
            layer?.appendChild(panelTarget);
          }
        }
        for (const bubble of panel.bubbles || []) {
          if (bubble.feedbackEnabled === false) continue;
          const targetStyle = centerStyle(bubble.bbox, page);
          const highlightStyle = boxStyle(bubble.bbox, page);
          if (!targetStyle || !highlightStyle) continue;
          const bubbleHighlight = document.createElement("span");
          bubbleHighlight.className = "reader-bubble-highlight";
          bubbleHighlight.dataset.bubbleId = bubble.id;
          bubbleHighlight.setAttribute("aria-hidden", "true");
          bubbleHighlight.setAttribute("style", highlightStyle);
          layer?.appendChild(bubbleHighlight);

          const bubbleTarget = document.createElement("button");
          bubbleTarget.type = "button";
          bubbleTarget.className = "reader-target reader-bubble-target";
          bubbleTarget.dataset.bubbleId = bubble.id;
          bubbleTarget.setAttribute("aria-label", t("bubbleAria", { bubbleId: bubble.shortId || bubble.bubbleNumber }));
          bubbleTarget.setAttribute("style", targetStyle);
          const target = { page, panel, bubble };
          bubbleTarget.addEventListener("contextmenu", (event) => openContextMenu(event, target));
          bubbleTarget.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openContextMenuAtElement(bubbleTarget, target);
            }
          });
          bubbleTarget.addEventListener("click", (event) => {
            if (suppressNextTargetClick) {
              event.preventDefault();
              event.stopPropagation();
              suppressNextTargetClick = false;
              return;
            }
            if (suppressNextImageClick) {
              event.preventDefault();
              event.stopPropagation();
              suppressNextImageClick = false;
              return;
            }
            if (
              shell.getAttribute("data-mode") === "normal"
              && (shell.getAttribute("data-target-preview") === "visible" || bubbleTarget.classList.contains("is-shared-focus"))
            ) {
              event.preventDefault();
              event.stopPropagation();
              openTargetActionSheet(target, bubbleTarget);
              return;
            }
            if (handlePreviewNavigationTap(event)) return;
            if (shell.getAttribute("data-mode") !== "explore") return;
            if (targetPickMode && targetPickMode !== "bubble") return;
            event.stopPropagation();
            if (targetPickMode) void completeTargetPick(target);
            else selectTarget(target);
          });
          bubbleTarget.addEventListener("pointerdown", (event) => {
            if (startTargetPreviewGesture(event)) return;
            if (
              shell.getAttribute("data-mode") === "explore"
              || shell.getAttribute("data-target-preview") === "visible"
              || bubbleTarget.classList.contains("is-shared-focus")
            ) event.stopPropagation();
            startLongPress(event, target);
          });
          bubbleTarget.addEventListener("pointerup", (event) => {
            if (endTargetPreviewGesture(event)) return;
            window.clearTimeout(longPressTimer);
          });
          bubbleTarget.addEventListener("pointercancel", (event) => {
            if (cancelTargetPreviewGesture(event)) return;
            window.clearTimeout(longPressTimer);
          });
          bubbleTarget.addEventListener("pointermove", (event) => {
            if (moveTargetPreviewGesture(event)) return;
            window.clearTimeout(longPressTimer);
          });
          layer?.appendChild(bubbleTarget);
        }
      }
      frame.querySelector(".page-image-wrap")?.addEventListener("click", (event) => {
        if (suppressNextImageClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressNextImageClick = false;
          return;
        }
      });
      frame.querySelector(".page-image-wrap")?.addEventListener("pointerdown", (event) => {
        if (shell.getAttribute("data-mode") !== "explore") return;
        if (targetPickMode && targetPickMode !== "region") return;
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = {
          x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
        activePage = String(page.pageNumber);
        writeNotePatch({ anchor, scope: noteScope?.value === "page" ? "region" : noteScope?.value ?? "region" });
        loadNote(activePage);
        if (targetPickMode === "region") {
          void completeTargetPick({ page, region: anchor });
        }
      });
      return frame;
    };

    const buildDOM = () => {
      views = calculateViews();
      track.innerHTML = "";
      for (const view of views) {
        const viewEl = document.createElement("div");
        viewEl.className = `manga-view${view.single ? " is-single" : ""}${view.align === "right" ? " is-right" : ""}${view.type === "end" ? " is-end" : ""}`;
        viewEl.dataset.view = view.id;
        if (view.type === "end") {
          const localizedNextEpisodeHref = hrefWithLanguage(nextEpisodeHref);
          const nextEpisodeAction = nextEpisodeHref
            ? `<a class="btn-viewer btn-primary-viewer" href="${escapeHtml(localizedNextEpisodeHref)}" data-completion-action="next">${escapeHtml(
                t("endNextEpisode", { title: nextEpisodeTitle || t("endNextEpisodeFallback") }),
              )}</a>`
            : "";
          const textViewAction = structuredTextHref
            ? `<a class="btn-viewer btn-ghost-viewer" href="${escapeHtml(hrefWithLanguage(structuredTextHref))}" data-completion-action="text">${escapeHtml(t("endTextView"))}</a>`
            : "";
          viewEl.innerHTML = `
            <div class="reader-end-card">
              <h2>${t("endTitle")}</h2>
              <p>${t(nextEpisodeHref ? "endBodyWithNext" : "endBody")}</p>
              <div class="reader-end-actions${nextEpisodeHref ? " has-next-episode" : ""}">
                ${nextEpisodeAction}
                <button type="button" class="btn-viewer btn-ghost-viewer" data-completion-action="share">${t("endShare")}</button>
                ${textViewAction}
                <button type="button" class="btn-viewer ${nextEpisodeHref ? "btn-ghost-viewer" : "btn-primary-viewer"}" data-completion-action="contribute">${t("endContribute")}</button>
              </div>
            </div>
          `;
          viewEl.querySelector("[data-completion-action='share']")?.addEventListener("click", async () => {
            await shareTargetNow({ modeOverride: "episode" });
          });
          viewEl.querySelector("[data-completion-action='contribute']")?.addEventListener("click", () => {
            openFeedbackModal({ modeOverride: "completion" }, "other", "completion");
          });
        } else {
          for (const page of view.pages) {
            viewEl.appendChild(createPageFrame(page));
          }
        }
        track.appendChild(viewEl);
      }
      syncTargetInteractivity();
    };

    const loadBufferedImages = () => {
      for (let i = currentViewIndex - 3; i <= currentViewIndex + 3; i++) {
        const view = views[i];
        if (!view) continue;
        for (const page of view.pages || []) {
          const record = imageCache.get(imageCacheKey(page));
          syncPageImageElement(page, record?.status === "ready" ? "ready" : "loading");
          if (!record) preloadPageImage(page);
        }
      }
    };

    const updateActivePage = () => {
      const view = views[currentViewIndex];
      const page = view?.pages?.[view.pages.length - 1] ?? view?.pages?.[0] ?? pages[pages.length - 1];
      if (!page) return;
      activePage = String(page.pageNumber);
      if (currentPage) currentPage.textContent = page.displayRef ? `${page.displayRef} · ${activePage}` : activePage;
      loadNote(activePage);
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = `p${activePage}`;
      history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      syncPageScrubber(page.pageNumber);
      preloadAroundPage(page.pageNumber);
      preloadAroundView(currentViewIndex);
    };

    const render = (offset = 0, animate = true) => {
      track.style.transition = animate ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
      // Match medamayaki's RTL invariant: row-reverse track + positive offset
      // advances to the next manga view from right to left.
      const x = currentViewIndex * lastWidth + offset;
      track.style.transform = `translate3d(${x}px, var(--reader-mobile-pan-y, 0px), 0)`;
      loadBufferedImages();
    };
    const refreshReaderGeometry = (options = {}) => {
      const { forceRebuild = false } = options;
      pendingResizeAfterDrag = false;
      syncReaderViewportHeight();

      const active = Number(activePage);
      const nextWidth = viewport.clientWidth;
      const widthChanged = Math.abs(nextWidth - lastWidth) > 2;
      if (forceRebuild || widthChanged) {
        lastWidth = nextWidth;
        buildDOM();
        const index = views.findIndex((view) => view.pages?.some((page) => page.pageNumber === active));
        currentViewIndex = Math.max(0, index);
        render(0, false);
        updateActivePage();
        return;
      }

      render(0, false);
      requestAnimationFrame(syncMobileExplorePan);
    };
    const scheduleReaderGeometryRefresh = (options = {}) => {
      if (isDragging) {
        pendingResizeAfterDrag = true;
        return;
      }
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        refreshReaderGeometry(options);
      }, 80);
    };
    const flushPendingReaderGeometryRefresh = () => {
      if (!pendingResizeAfterDrag) return;
      requestAnimationFrame(() => refreshReaderGeometry());
    };

    const goToView = async (index, options = {}) => {
      const { animate = true, requireReady = true, loadingMessage = t("loadingNextPage") } = options;
      const targetIndex = Math.max(0, Math.min(index, views.length - 1));
      const targetView = views[targetIndex];
      const token = ++navigationToken;
      hideQuickActions();
      closeTaskSheet({ restorePreview: false });
      hideTargetPreviewOverlay({ disable: true });
      clearSharedTargetHighlight();
      clearSelectedTarget();
      endTargetPick();
      preloadAroundView(targetIndex);

      currentViewIndex = targetIndex;
      if (targetView?.type === "end") setReaderMode("normal", targetIndex);
      render(0, animate);
      updateActivePage();

      if (requireReady && targetView?.pages?.length) {
        setReaderLoading(true, loadingMessage);
        const ok = await ensureViewImagesReady(targetView);
        if (token !== navigationToken) return;
        if (!ok) {
          showToast(t("imageLoadError"));
        }
      }

      setReaderLoading(false);
    };

    const next = () => goToView(currentViewIndex + 1);
    const prev = () => goToView(currentViewIndex - 1);

    const goToPage = (pageNumber, options = {}) => {
      const index = views.findIndex((view) => view.pages?.some((page) => page.pageNumber === pageNumber));
      if (index >= 0) return goToView(index, options);
      return Promise.resolve();
    };
    const pageNumberFromHash = (hash = window.location.hash) => {
      const match = hash.match(/^#p(\d+)$/);
      if (!match) return null;
      const pageNumber = Number(match[1]);
      return Number.isFinite(pageNumber) && getPage(pageNumber) ? pageNumber : null;
    };
    const syncPageFromHash = async () => {
      const pageNumber = pageNumberFromHash();
      if (!pageNumber || String(pageNumber) === activePage) return false;
      if (isSharedDeepLinkPending && sharedDeepLinkTarget?.page?.pageNumber === pageNumber) {
        await showInitialSharedTargetPrompt();
        return false;
      }
      await goToPage(pageNumber, { animate: false, requireReady: true });
      revealReader();
      return true;
    };
    const resolveInitialDeepLinkTarget = () => {
      const url = new URL(window.location.href);
      const focus = url.searchParams.get("focus");
      const pageParam = url.searchParams.get("page");
      const hashPage = pageNumberFromHash(url.hash);
      const target = findTargetById(focus || pageParam)
        || (hashPage ? { page: getPage(hashPage) } : null);
      if (!target?.page || target.page.pageNumber <= 1) return null;
      if (url.searchParams.has("region")) {
        const [x, y] = (url.searchParams.get("region") || "").split(",").map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return {
            kind: "region",
            target: {
              page: target.page,
              region: {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
              },
            },
          };
        }
      }
      return {
        kind: target.bubble ? "bubble" : target.panel ? "panel" : "page",
        target,
      };
    };
    const applySharedDeepLinkTarget = async () => {
      const target = sharedDeepLinkTarget;
      const kind = sharedDeepLinkKind;
      if (!target?.page) return;
      isSharedDeepLinkPending = false;
      sharedDeepLinkTarget = null;
      sharedDeepLinkKind = "";
      hideSharedTargetButton();
      await goToPage(target.page.pageNumber, { animate: false, requireReady: true });
      if (kind === "panel" || kind === "bubble" || kind === "region") {
        setReaderMode("normal");
        flashSharedTarget(target);
      } else {
        setReaderMode("normal");
        revealReader();
      }
    };
    const showInitialSharedTargetPrompt = async () => {
      if (!sharedDeepLinkTarget) return;
      if (String(activePage) !== "1") {
        await goToPage(1, { animate: false, requireReady: true, loadingMessage: t("loadingPage") });
      }
      showSharedTargetButton(SHARED_TARGET_VISIBLE_MS);
    };

    const revealReader = () => {
      const scrollToReaderTop = () => {
        const shellTop = shell.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, shellTop), left: 0, behavior: "auto" });
      };

      scrollToReaderTop();
      requestAnimationFrame(() => {
        scrollToReaderTop();
        window.setTimeout(() => {
          scrollToReaderTop();
        }, 80);
      });
    };

    document.querySelector("[data-reader-next]")?.addEventListener("click", next);
    document.querySelector("[data-reader-prev]")?.addEventListener("click", prev);
    sharedTargetButton?.addEventListener("click", () => {
      void applySharedDeepLinkTarget();
    });

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
    }, { passive: false });

    viewport.addEventListener("pointermove", (event) => {
      if (shell.getAttribute("data-mode") !== "normal" || isDragging || isFeedbackOpen()) return;
      const rect = viewport.getBoundingClientRect();
      if (event.clientY - rect.top < 72) {
        setReaderChromeVisible(true, { delay: 1500 });
      }
    });

    const resetPointerGesture = (animate = true) => {
      clearDragSettle();
      isDragging = false;
      activePointerId = null;
      horizontalDragActive = false;
      dragOffset = 0;
      if (animate) render(0, true);
    };

    const cancelPointerGesture = (event) => {
      if (event?.pointerId != null) activePointers.delete(event.pointerId);
      if (activePointers.size === 0) gestureBlocked = false;
      setTapSuppressed();
      resetPointerGesture(true);
      flushPendingReaderGeometryRefresh();
    };

    viewport.addEventListener("pointerdown", (event) => {
      if (shouldIgnoreReaderShortcut(event)) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      clearTapNavigation();
      window.clearTimeout(longPressTimer);
      hideQuickActions();

      if (activePointers.size > 1) {
        gestureBlocked = true;
        resetPointerGesture(true);
        setTapSuppressed();
        return;
      }

      if (getZoomedFrame()) {
        resetPointerGesture(false);
        return;
      }

      gestureBlocked = false;
      isDragging = true;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dragStartedAt = performance.now();
      dragOffset = 0;
      horizontalDragActive = false;
      capturePointer(event.pointerId);
      render(0, false);
      requestAnimationFrame(syncMobileExplorePan);
    });

    viewport.addEventListener("pointermove", (event) => {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (activePointers.size > 1) {
        gestureBlocked = true;
        window.clearTimeout(longPressTimer);
        resetPointerGesture(true);
        return;
      }
      if (!isDragging || activePointerId !== event.pointerId || gestureBlocked) return;

      const nextDragOffset = event.clientX - startX;
      const yOffset = event.clientY - startY;
      const absX = Math.abs(nextDragOffset);
      const absY = Math.abs(yOffset);
      if (Math.hypot(nextDragOffset, yOffset) > DRAG_START_DISTANCE) {
        window.clearTimeout(longPressTimer);
      }
      if (!horizontalDragActive) {
        horizontalDragActive = absX > DRAG_START_DISTANCE && absX > absY * SWIPE_AXIS_RATIO;
      }
      if (!horizontalDragActive) return;
      if (event.cancelable) event.preventDefault();

      dragOffset = nextDragOffset;
      render(dragOffset, false);
      scheduleDragSettle(event);
    }, { passive: false });

    const finishPointerGesture = (event) => {
      clearDragSettle();
      hideQuickActions();
      const pointerId = event.pointerId ?? activePointerId;
      if (pointerId != null) {
        activePointers.delete(pointerId);
        releasePointer(pointerId);
      }
      if (activePointers.size === 0 && gestureBlocked) {
        cancelPointerGesture(event);
        return;
      }
      if (!isDragging || activePointerId !== pointerId) return;

      const xOffset = event.clientX - startX;
      const yOffset = event.clientY - startY;
      const absX = Math.abs(xOffset);
      const absY = Math.abs(yOffset);
      const elapsed = Math.max(1, performance.now() - dragStartedAt);
      const velocity = absX / elapsed;
      const moved = Math.hypot(xOffset, yOffset) > DRAG_START_DISTANCE;
      const hasSwipeAxis = absX > absY * SWIPE_AXIS_RATIO;
      const hasSwipeDistance = absX >= getSwipeThreshold() || (absX >= 18 && velocity >= SWIPE_VELOCITY);

      isDragging = false;
      activePointerId = null;
      horizontalDragActive = false;
      dragOffset = 0;
      if (moved) setTapSuppressed();

      if (!getZoomedFrame() && hasSwipeAxis && hasSwipeDistance) {
        const navigation = xOffset > 0 ? next() : prev();
        navigation.finally(flushPendingReaderGeometryRefresh);
      } else {
        render(0, true);
        flushPendingReaderGeometryRefresh();
      }
    };

    viewport.addEventListener("pointerup", finishPointerGesture);
    viewport.addEventListener("pointercancel", cancelPointerGesture);
    window.addEventListener("pointerup", finishPointerGesture);
    window.addEventListener("pointercancel", cancelPointerGesture);
    window.addEventListener("mouseup", (event) => {
      if (isDragging) finishPointerGesture(event);
    });

    viewport.addEventListener("click", (event) => {
      if (isTapSuppressed() || shouldIgnoreReaderShortcut(event) || shell.getAttribute("data-mode") === "explore") {
        event.preventDefault();
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const xRatio = (event.clientX - rect.left) / rect.width;
      const isMobileViewport = window.matchMedia("(max-width: 720px)").matches;
      const nextTapBoundary = isMobileViewport ? 0.28 : 0.4;
      const prevTapBoundary = isMobileViewport ? 0.72 : 0.6;
      const now = performance.now();
      const frame = getFrameAtPoint(event);
      const isChromeTapZone = (xRatio >= nextTapBoundary && xRatio <= prevTapBoundary) || isOutsideActiveArtworkVertically(event);
      const isNextTapZone = xRatio < nextTapBoundary;
      const isPrevTapZone = xRatio > prevTapBoundary;
      const isDoubleTap = lastTap
        && now - lastTap.time <= DOUBLE_TAP_DELAY_MS
        && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= DOUBLE_TAP_DISTANCE;

      if (isDoubleTap) {
        event.preventDefault();
        clearTapNavigation();
        const zoomTarget = frame || lastTap.frame;
        lastTap = null;
        toggleFrameZoom(zoomTarget);
        setTapSuppressed(120);
        return;
      }

      if (!getZoomedFrame() && isChromeTapZone) {
        event.preventDefault();
        lastTap = { time: now, x: event.clientX, y: event.clientY, frame };
        clearTapNavigation();
        if (isMobileViewport) {
          revealReaderActions();
          return;
        }
        pendingTapTimer = window.setTimeout(() => {
          pendingTapTimer = null;
          if (shell.getAttribute("data-mode") === "explore" || getZoomedFrame()) return;
          toggleReaderChrome();
        }, TAP_NAVIGATION_DELAY_MS);
        return;
      }

      if (!getZoomedFrame() && (isNextTapZone || isPrevTapZone)) {
        event.preventDefault();
        clearTapNavigation();
        lastTap = null;
        setReaderChromeVisible(false);
        if (isNextTapZone) next();
        else prev();
        return;
      }

      lastTap = { time: now, x: event.clientX, y: event.clientY, frame };
      clearTapNavigation();
      pendingTapTimer = window.setTimeout(() => {
        pendingTapTimer = null;
        if (shell.getAttribute("data-mode") === "explore" || getZoomedFrame()) return;
        toggleReaderChrome();
      }, TAP_NAVIGATION_DELAY_MS);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isTaskSheetOpen()) {
        event.preventDefault();
        closeTaskSheet();
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && isTaskSheetOpen()) {
        event.preventDefault();
        closeTaskSheet({ restorePreview: false });
        setReaderChromeVisible(false);
        if (event.key === "ArrowLeft") next();
        else prev();
        return;
      }
      if (shouldIgnoreReaderShortcut(event)) {
        if (event.key === "Escape" && isFeedbackOpen()) {
          feedbackModal.hidden = true;
          restoreTargetPreviewAfterOverlay();
        }
        return;
      }
      if (event.key === "Escape") {
        if (contextMenu && !contextMenu.hidden) closeContextMenu();
        else if (shell.getAttribute("data-reader-ui") === "visible") hideQuickActions();
        else if (shell.getAttribute("data-mode") === "explore") setReaderMode("normal");
        else setReaderChromeVisible(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        setReaderChromeVisible(false);
        next();
      }
      if (event.key === "ArrowRight") {
        setReaderChromeVisible(false);
        prev();
      }
    });

    window.addEventListener("resize", () => {
      scheduleReaderGeometryRefresh();
    });
    window.visualViewport?.addEventListener("resize", () => {
      scheduleReaderGeometryRefresh();
    }, { passive: true });
    window.visualViewport?.addEventListener("scroll", () => {
      scheduleReaderGeometryRefresh();
    }, { passive: true });

    window.addEventListener("hashchange", () => {
      if (window.location.hash.startsWith("#p")) void syncPageFromHash();
    });

    const initializeReader = async () => {
      syncReaderViewportHeight();
      const initialUrlLocale = new URL(window.location.href).searchParams.get("lang");
      applyUiLocale(initialUrlLocale || shell.getAttribute("data-content-locale") || "ja");
      let savedTheme = "light";
      let savedLayout = viewport.clientWidth >= 900 ? "spread" : "single";
      try {
        savedTheme = localStorage.getItem(`${storagePrefix}:reader-theme`) || "light";
        savedLayout = localStorage.getItem(`${storagePrefix}:reader-layout`) || savedLayout;
      } catch {
        savedTheme = "light";
      }
      applyReaderTheme(savedTheme);
      applyReaderLayout(savedLayout, { rebuild: false });
      setReaderChromeVisible(true, { delay: READER_ACTION_VISIBLE_MS });
      buildDOM();
      lastWidth = viewport.clientWidth;
      const deepLink = resolveInitialDeepLinkTarget();
      sharedDeepLinkTarget = deepLink?.target || null;
      sharedDeepLinkKind = deepLink?.kind || "";
      if (sharedTargetButton && sharedDeepLinkTarget) {
        sharedTargetButton.textContent = sharedTargetLabel(sharedDeepLinkKind);
        isSharedDeepLinkPending = true;
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = "p1";
        history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
      await goToPage(1, {
        animate: false,
        requireReady: true,
        loadingMessage: t("loadingPage"),
      });
      loadNote(activePage);
      renderFeedbackStatus();
      void refreshFeedbackStatus();
      if (startOverButton) startOverButton.hidden = true;
      if (location.hash.startsWith("#p")) requestAnimationFrame(revealReader);
      if (shell.getAttribute("data-mode") === "normal") {
        revealReaderActions();
      }
      if (sharedDeepLinkTarget) {
        window.setTimeout(() => {
          void showInitialSharedTargetPrompt();
        }, 0);
      }
    };

    initializeReader();
  }
});
