// ===================================================================
// Fast manga reader: RTL paging, spread layout, and buffered image loading.
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.querySelector("#reader");
  const track = document.querySelector("[data-reader-track]");
  const shell = document.querySelector("[data-work-id][data-episode-id]");
  const currentPage = document.querySelector("[data-current-page]");
  const pagesScript = document.querySelector("#reader-pages");
  const feedbackApiBaseScript = document.querySelector("#feedback-api-base");
  const pages = pagesScript ? JSON.parse(pagesScript.textContent || "[]") : [];
  const feedbackApiBase = feedbackApiBaseScript ? JSON.parse(feedbackApiBaseScript.textContent || '"/api/v1"') : "/api/v1";

  if (viewport && track && shell && pages.length > 0) {
    shell.setAttribute("data-mode", "normal");
    const storagePrefix = `manga-note:${shell.getAttribute("data-work-id")}:${shell.getAttribute("data-episode-id")}`;
    const seriesId = shell.getAttribute("data-work-id") || "";
    const episodeIdValue = shell.getAttribute("data-episode-id") || "";
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
    const feedbackIssue = document.querySelector("[data-feedback-issue]");
    const feedbackSuggestedWrap = document.querySelector("[data-feedback-suggested-wrap]");
    const feedbackComment = document.querySelector("[data-feedback-comment]");
    const feedbackSuggested = document.querySelector("[data-feedback-suggested]");
    let activePage = "1";
    let selectedTarget = null;
    let feedbackTargetState = null;
    let longPressTimer = null;
    let currentViewIndex = 0;
    let views = [];
    let isDragging = false;
    let startX = 0;
    let dragOffset = 0;
    let lastWidth = viewport.clientWidth;
    let suppressNextImageClick = false;
    let suppressNextTap = false;

    const noteKey = (page) => `${storagePrefix}:p${page}`;
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
        noteAnchor.textContent = "位置指定なし。Explore Modeでページ画像をクリックすると、注の位置候補を保存できます。";
        return;
      }
      noteAnchor.textContent = `位置候補: x=${Math.round(anchor.x * 100)}%, y=${Math.round(anchor.y * 100)}%`;
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
    const boxStyle = (bbox, page) => {
      if (!bbox || !page?.width || !page?.height) return "";
      return [
        `left:${(bbox.x / page.width) * 100}%`,
        `top:${(bbox.y / page.height) * 100}%`,
        `width:${(bbox.width / page.width) * 100}%`,
        `height:${(bbox.height / page.height) * 100}%`,
      ].join(";");
    };
    const showToast = (message) => {
      if (!toast) return;
      toast.textContent = message;
      toast.hidden = false;
      window.setTimeout(() => {
        toast.hidden = true;
      }, 1800);
    };
    const closeContextMenu = () => {
      if (contextMenu) contextMenu.hidden = true;
    };
    const isEditableTarget = (target) =>
      Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
    const isFeedbackOpen = () => Boolean(feedbackModal && !feedbackModal.hidden);
    const shouldIgnoreReaderShortcut = (event) =>
      isFeedbackOpen() || isEditableTarget(event.target);
    const setReaderMode = (mode) => {
      shell.setAttribute("data-mode", mode);
      document.querySelectorAll("[data-mode-button]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-mode-button") === mode);
      });
    };
    const sourceUrlFor = (target) => {
      const url = new URL(window.location.href);
      if (target?.bubble) url.searchParams.set("focus", target.bubble.id);
      else if (target?.panel) url.searchParams.set("focus", target.panel.id);
      else if (target?.page) url.searchParams.set("page", getPageId(target.page));
      return url.toString();
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
      return "Pack";
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
        <div class="pack-entry-list" aria-label="Published packs">
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
      lang: "ja",
      current_text: target?.bubble?.textOriginal ?? "",
      source_url: sourceUrlFor(target),
      client_time: new Date().toISOString(),
    });
    const selectTarget = (target) => {
      selectedTarget = target;
      track.querySelectorAll(".reader-target.is-selected").forEach((el) => el.classList.remove("is-selected"));
      const selector = target?.bubble
        ? `[data-bubble-id="${CSS.escape(target.bubble.id)}"]`
        : target?.panel
          ? `[data-panel-id="${CSS.escape(target.panel.id)}"]`
          : "";
      if (selector) {
        track.querySelectorAll(selector).forEach((el) => el.classList.add("is-selected"));
      }
      if (!exploreTitle || !exploreSummary || !exploreDetail) return;
      if (target?.bubble) {
        exploreTitle.textContent = "このセリフ";
        exploreSummary.textContent = target.bubble.textOriginal || "原文未設定のフキダシです。";
        exploreDetail.innerHTML = `
          <p class="text-muted">Bubble ${escapeHtml(target.bubble.shortId || target.bubble.bubbleNumber)}</p>
          <h3>${escapeHtml(target.bubble.textOriginal || "原文未設定")}</h3>
          <p class="text-muted">Speaker: ${escapeHtml(target.bubble.speaker || "unknown")} / Type: ${escapeHtml(target.bubble.bubbleType || "speech")}</p>
          ${renderPackEntries(target)}
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="share">共有する</button>
            <button type="button" class="btn-viewer btn-primary-viewer" data-feedback-action="better_translation">よりよい訳を提案</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="mistranslation">誤訳を報告</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">注釈を提案</button>
          </div>
        `;
      } else if (target?.panel) {
        exploreTitle.textContent = "このコマ";
        exploreSummary.textContent = `Panel ${target.panel.panelNumber}`;
        exploreDetail.innerHTML = `
          <p class="text-muted">Panel ${escapeHtml(target.panel.panelNumber)} / ${escapeHtml(target.panel.bubbles?.length || 0)} bubbles</p>
          ${renderPackEntries(target)}
          <div class="explore-actions">
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="share">共有する</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="display">表示崩れを報告</button>
            <button type="button" class="btn-viewer btn-ghost-viewer" data-feedback-action="missing_note">注釈を提案</button>
          </div>
        `;
      }
    };
    const openFeedbackModal = (target, issueType = "other", mode = shell.getAttribute("data-mode") === "explore" ? "explore" : "read") => {
      feedbackTargetState = target;
      if (feedbackTitle) feedbackTitle.textContent = mode === "completion" ? "この話に貢献する" : mode === "explore" ? "提案する" : "報告する";
      if (feedbackTarget) {
        feedbackTarget.textContent = target?.bubble
          ? `対象: ${target.bubble.shortId || target.bubble.id}`
          : target?.panel
            ? `対象: Panel ${target.panel.panelNumber}`
            : target?.page
              ? `対象: Page ${target.page.pageNumber}`
              : "対象: Episode";
      }
      if (feedbackIssue) feedbackIssue.value = issueType;
      if (feedbackComment) feedbackComment.value = "";
      if (feedbackSuggested) feedbackSuggested.value = "";
      if (feedbackSuggestedWrap) feedbackSuggestedWrap.hidden = !(issueType === "better_translation" || issueType === "missing_note");
      if (feedbackModal) feedbackModal.hidden = false;
      closeContextMenu();
    };
    const openContextMenu = (event, target) => {
      if (!contextMenu) return;
      event.preventDefault();
      selectTarget(target);
      const isBubble = Boolean(target.bubble);
      contextMenu.innerHTML = `
        <strong>${isBubble ? "このセリフ" : "このコマ"}</strong>
        <button type="button" data-menu-action="share">共有する</button>
        ${isBubble ? "" : "<button type=\"button\" data-menu-action=\"clip\" disabled>Clipに追加（準備中）</button>"}
        <button type="button" data-menu-action="explore">くわしく見る</button>
        <button type="button" data-menu-action="report">報告する</button>
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
        setReaderMode(mode);
      });
    });

    document.addEventListener("click", (event) => {
      if (contextMenu && !contextMenu.hidden && !contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    });

    contextMenu?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target?.closest ? target.closest("button[data-menu-action]") : null;
      if (!button || !selectedTarget) return;
      const action = button.getAttribute("data-menu-action");
      if (action === "share") {
        await navigator.clipboard?.writeText(sourceUrlFor(selectedTarget));
        showToast("リンクをコピーしました");
        closeContextMenu();
      } else if (action === "explore") {
        setReaderMode("explore");
        selectTarget(selectedTarget);
        closeContextMenu();
      } else if (action === "report") {
        openFeedbackModal(selectedTarget, "other", "read");
      }
    });

    exploreDetail?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target?.closest ? target.closest("button[data-feedback-action]") : null;
      if (!button || !selectedTarget) return;
      const action = button.getAttribute("data-feedback-action");
      if (action === "share") {
        await navigator.clipboard?.writeText(sourceUrlFor(selectedTarget));
        showToast("リンクをコピーしました");
        return;
      }
      openFeedbackModal(selectedTarget, action || "other", "explore");
    });

    document.querySelectorAll("[data-feedback-close]").forEach((close) => {
      close.addEventListener("click", () => {
        if (feedbackModal) feedbackModal.hidden = true;
      });
    });

    feedbackIssue?.addEventListener("change", () => {
      if (feedbackSuggestedWrap) {
        feedbackSuggestedWrap.hidden = !(feedbackIssue.value === "better_translation" || feedbackIssue.value === "missing_note");
      }
    });

    feedbackForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const issueType = String(formData.get("issue_type") || "other");
      const mode = feedbackTargetState?.modeOverride || (shell.getAttribute("data-mode") === "explore" ? "explore" : "read");
      const payload = {
        ...makePayloadBase(feedbackTargetState, mode),
        issue_type: issueType,
        comment: String(formData.get("comment") || "").trim(),
        suggested_text: String(formData.get("suggested_text") || "").trim(),
        website: String(formData.get("website") || ""),
        user_agent: navigator.userAgent,
      };
      try {
        const res = await fetch(`${feedbackApiBase}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          throw new Error(data.error?.message || "Feedback failed");
        }
        if (feedbackModal) feedbackModal.hidden = true;
        showToast(mode === "completion" ? "送信しました" : "報告を送信しました");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "送信に失敗しました");
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
      const useSpread = viewport.clientWidth >= 900 && viewport.clientHeight >= 620;
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
      frame.innerHTML = `
        <div class="page-image-wrap">
          <img
            data-src="${page.src}"
            alt="Page ${page.pageNumber}"
            width="${page.width}"
            height="${page.height}"
            decoding="async"
            draggable="false"
          />
          <div class="reader-target-layer"></div>
        </div>
        <div class="page-info text-muted">
          Page ${page.pageNumber} — ${page.panels?.length || 0} panels, ${(page.panels || []).reduce((sum, panel) => sum + (panel.bubbles?.length || 0), 0)} bubbles
        </div>
      `;
      const layer = frame.querySelector(".reader-target-layer");
      for (const panel of page.panels || []) {
        if (panel.feedbackEnabled !== false) {
          const panelTarget = document.createElement("button");
          panelTarget.type = "button";
          panelTarget.className = "reader-target reader-panel-target";
          panelTarget.dataset.panelId = panel.id;
          panelTarget.setAttribute("aria-label", `Panel ${panel.panelNumber}`);
          panelTarget.setAttribute("style", boxStyle(panel.bbox, page));
          const target = { page, panel };
          panelTarget.addEventListener("contextmenu", (event) => openContextMenu(event, target));
          panelTarget.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openContextMenuAtElement(panelTarget, target);
            }
          });
          panelTarget.addEventListener("click", (event) => {
            if (suppressNextImageClick) {
              event.preventDefault();
              event.stopPropagation();
              suppressNextImageClick = false;
              return;
            }
            if (shell.getAttribute("data-mode") !== "explore") return;
            event.stopPropagation();
            selectTarget(target);
          });
          panelTarget.addEventListener("pointerdown", (event) => {
            if (shell.getAttribute("data-mode") === "explore") event.stopPropagation();
            startLongPress(event, target);
          });
          panelTarget.addEventListener("pointerup", () => window.clearTimeout(longPressTimer));
          panelTarget.addEventListener("pointercancel", () => window.clearTimeout(longPressTimer));
          panelTarget.addEventListener("pointermove", () => window.clearTimeout(longPressTimer));
          layer?.appendChild(panelTarget);
        }
        for (const bubble of panel.bubbles || []) {
          if (bubble.feedbackEnabled === false) continue;
          const bubbleTarget = document.createElement("button");
          bubbleTarget.type = "button";
          bubbleTarget.className = "reader-target reader-bubble-target";
          bubbleTarget.dataset.bubbleId = bubble.id;
          bubbleTarget.setAttribute("aria-label", `Bubble ${bubble.shortId || bubble.bubbleNumber}`);
          bubbleTarget.setAttribute("style", boxStyle(bubble.bbox, page));
          const target = { page, panel, bubble };
          bubbleTarget.addEventListener("contextmenu", (event) => openContextMenu(event, target));
          bubbleTarget.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openContextMenuAtElement(bubbleTarget, target);
            }
          });
          bubbleTarget.addEventListener("click", (event) => {
            if (suppressNextImageClick) {
              event.preventDefault();
              event.stopPropagation();
              suppressNextImageClick = false;
              return;
            }
            if (shell.getAttribute("data-mode") !== "explore") return;
            event.stopPropagation();
            selectTarget(target);
          });
          bubbleTarget.addEventListener("pointerdown", (event) => {
            if (shell.getAttribute("data-mode") === "explore") event.stopPropagation();
            startLongPress(event, target);
          });
          bubbleTarget.addEventListener("pointerup", () => window.clearTimeout(longPressTimer));
          bubbleTarget.addEventListener("pointercancel", () => window.clearTimeout(longPressTimer));
          bubbleTarget.addEventListener("pointermove", () => window.clearTimeout(longPressTimer));
          layer?.appendChild(bubbleTarget);
        }
      }
      frame.querySelector(".page-image-wrap")?.addEventListener("click", (event) => {
        if (suppressNextImageClick) {
          suppressNextImageClick = false;
          return;
        }
        if (shell.getAttribute("data-mode") !== "explore") {
          const rect = event.currentTarget.getBoundingClientRect();
          const xRatio = (event.clientX - rect.left) / rect.width;
          if (xRatio < 0.4 || xRatio > 0.6) return;
          event.stopPropagation();
          frame.classList.toggle("zoomed");
        }
      });
      frame.querySelector(".page-image-wrap")?.addEventListener("pointerdown", (event) => {
        if (shell.getAttribute("data-mode") !== "explore") return;
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = {
          x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
        activePage = String(page.pageNumber);
        writeNotePatch({ anchor, scope: noteScope?.value === "page" ? "region" : noteScope?.value ?? "region" });
        loadNote(activePage);
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
          viewEl.innerHTML = `
            <div class="reader-end-card">
              <h2>この話を読み終えました</h2>
              <p>共有や名セリフ確認、軽い貢献ができます。</p>
              <div class="explore-actions">
                <button type="button" class="btn-viewer btn-ghost-viewer" data-completion-action="share">この話を共有する</button>
                <button type="button" class="btn-viewer btn-ghost-viewer" disabled>名セリフを見る（準備中）</button>
                <button type="button" class="btn-viewer btn-primary-viewer" data-completion-action="contribute">この話に貢献する</button>
              </div>
            </div>
          `;
          viewEl.querySelector("[data-completion-action='share']")?.addEventListener("click", async () => {
            await navigator.clipboard?.writeText(window.location.href.split("#")[0]);
            showToast("リンクをコピーしました");
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
    };

    const loadBufferedImages = () => {
      for (let i = currentViewIndex - 2; i <= currentViewIndex + 2; i++) {
        const viewEl = track.children[i];
        if (!viewEl) continue;
        viewEl.querySelectorAll("img[data-src]").forEach((img) => {
          if (!img.getAttribute("src")) {
            img.setAttribute("src", img.dataset.src);
          }
        });
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
    };

    const render = (offset = 0, animate = true) => {
      track.style.transition = animate ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
      // Match medamayaki's RTL invariant: row-reverse track + positive offset
      // advances to the next manga view from right to left.
      const x = currentViewIndex * lastWidth + offset;
      track.style.transform = `translate3d(${x}px, 0, 0)`;
      loadBufferedImages();
    };

    const goToView = (index) => {
      currentViewIndex = Math.max(0, Math.min(index, views.length - 1));
      render(0, true);
      updateActivePage();
    };

    const next = () => goToView(currentViewIndex + 1);
    const prev = () => goToView(currentViewIndex - 1);

    const goToPage = (pageNumber) => {
      const index = views.findIndex((view) => view.pages?.some((page) => page.pageNumber === pageNumber));
      if (index >= 0) goToView(index);
    };
    const applyInitialFocus = () => {
      const url = new URL(window.location.href);
      const focus = url.searchParams.get("focus");
      const pageParam = url.searchParams.get("page");
      const target = findTargetById(focus || pageParam);
      if (!target) return false;
      goToPage(target.page.pageNumber);
      setReaderMode("explore");
      requestAnimationFrame(() => {
        selectTarget(target);
        revealReader();
      });
      return true;
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

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      if (shouldIgnoreReaderShortcut(event)) return;
      isDragging = true;
      startX = event.clientX;
      dragOffset = 0;
      viewport.setPointerCapture?.(event.pointerId);
      render(0, false);
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!isDragging) return;
      dragOffset = event.clientX - startX;
      render(dragOffset, false);
    });

    viewport.addEventListener("pointerup", () => {
      if (!isDragging) return;
      isDragging = false;
      suppressNextTap = Math.abs(dragOffset) > 8;
      const threshold = Math.min(lastWidth * 0.12, 96);
      if (dragOffset > threshold) next();
      else if (dragOffset < -threshold) prev();
      else render(0, true);
      dragOffset = 0;
      window.setTimeout(() => {
        suppressNextTap = false;
      }, 0);
    });

    viewport.addEventListener("click", (event) => {
      if (suppressNextTap || shouldIgnoreReaderShortcut(event) || shell.getAttribute("data-mode") === "explore") {
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const xRatio = (event.clientX - rect.left) / rect.width;
      if (xRatio < 0.42) next();
      else if (xRatio > 0.58) prev();
    });

    window.addEventListener("keydown", (event) => {
      if (shouldIgnoreReaderShortcut(event)) {
        if (event.key === "Escape" && isFeedbackOpen()) feedbackModal.hidden = true;
        return;
      }
      if (event.key === "Escape") {
        if (contextMenu && !contextMenu.hidden) closeContextMenu();
        else if (shell.getAttribute("data-mode") === "explore") setReaderMode("normal");
        return;
      }
      if (event.key === "ArrowLeft") next();
      if (event.key === "ArrowRight") prev();
    });

    window.addEventListener("resize", () => {
      const active = Number(activePage);
      lastWidth = viewport.clientWidth;
      buildDOM();
      const index = views.findIndex((view) => view.pages?.some((page) => page.pageNumber === active));
      currentViewIndex = Math.max(0, index);
      render(0, false);
    });

    buildDOM();
    lastWidth = viewport.clientWidth;
    const initialPage = Number(location.hash.replace("#p", "")) || 1;
    goToPage(getPage(initialPage) ? initialPage : 1);
    loadNote(activePage);
    if (!applyInitialFocus() && location.hash.startsWith("#p")) {
      requestAnimationFrame(revealReader);
    }
  }
});
