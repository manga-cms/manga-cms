const MIN_REFIT_SCALE = 0.32;
const MAX_STEPS = 8;
const FIT_EPSILON = 1;
const HORIZONTAL_TARGET_FILL_RATIO = 0.78;
const VERTICAL_WIDTH_TARGET_FILL_RATIO = 0.68;
const VERTICAL_HEIGHT_TARGET_FILL_RATIO = 0.78;

interface TextMeasurement {
    availableHeight: number;
    availableWidth: number;
    textHeight: number;
    textWidth: number;
    vertical: boolean;
    wrapHeight: number;
    wrapWidth: number;
}

interface VerticalLayoutEstimate {
    fillHeight: number;
    fillWidth: number;
    textHeight: number;
    textWidth: number;
}

const textElementOf = (element: HTMLElement) =>
    element.querySelector<HTMLElement>("[data-overlay-bubble-text]") ?? element;

const measurementBoxOf = (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    return {
        height: Math.max(1, element.clientHeight - paddingTop - paddingBottom),
        width: Math.max(1, element.clientWidth - paddingLeft - paddingRight),
        wrapHeight: Math.max(1, element.clientHeight),
        wrapWidth: Math.max(1, element.clientWidth),
    };
};

const measureText = (element: HTMLElement): TextMeasurement => {
    const text = textElementOf(element);
    const available = measurementBoxOf(element);
    const rect = text.getBoundingClientRect();
    return {
        availableHeight: available.height,
        availableWidth: available.width,
        textHeight: Math.max(rect.height, text.scrollHeight),
        textWidth: Math.max(rect.width, text.scrollWidth),
        vertical: element.classList.contains("is-vertical"),
        wrapHeight: available.wrapHeight,
        wrapWidth: available.wrapWidth,
    };
};

const lineHeightOf = (style: CSSStyleDeclaration, fontSize: number) => {
    const parsed = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(parsed)) return parsed;
    return fontSize * 1.3;
};

const verticalLayoutEstimate = (element: HTMLElement): VerticalLayoutEstimate => {
    const available = measurementBoxOf(element);
    const style = window.getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize) || 1;
    const lineHeight = lineHeightOf(style, fontSize);
    const characterCount = Math.max(1, Number(element.dataset.fitCharacters ?? 1));
    const charAdvance = fontSize * 1.03;
    const maxCharsPerColumn = Math.max(
        1,
        Math.floor((available.wrapHeight * VERTICAL_HEIGHT_TARGET_FILL_RATIO) / Math.max(charAdvance, 1)),
    );
    const columns = Math.ceil(characterCount / maxCharsPerColumn);
    const textWidth = columns * lineHeight;
    const textHeight = Math.min(characterCount, maxCharsPerColumn) * charAdvance;
    return {
        fillHeight: textHeight / available.wrapHeight,
        fillWidth: textWidth / available.width,
        textHeight,
        textWidth,
    };
};

const overflows = (element: HTMLElement) => {
    const measurement = measureText(element);
    if (measurement.vertical) {
        return measurement.textHeight > measurement.wrapHeight + FIT_EPSILON
            || measurement.textWidth > measurement.availableWidth + FIT_EPSILON;
    }
    return measurement.textHeight > measurement.availableHeight + FIT_EPSILON
        || measurement.textWidth > measurement.wrapWidth + FIT_EPSILON;
};

const exceedsTargetFill = (element: HTMLElement) => {
    const measurement = measureText(element);
    if (measurement.vertical) {
        const estimate = verticalLayoutEstimate(element);
        return estimate.fillWidth > VERTICAL_WIDTH_TARGET_FILL_RATIO
            || estimate.fillHeight > VERTICAL_HEIGHT_TARGET_FILL_RATIO;
    }
    return measurement.textHeight > measurement.availableHeight * HORIZONTAL_TARGET_FILL_RATIO + FIT_EPSILON
        || measurement.textWidth > measurement.wrapWidth + FIT_EPSILON;
};

const setRefitScale = (element: HTMLElement, scale: number) => {
    element.style.setProperty("--overlay-refit", scale.toFixed(4));
};

const alignFactor = (value: string | undefined) => {
    if (value === "center") return 0.5;
    if (value === "end") return 1;
    return 0;
};

const hasExplicitAlign = (element: HTMLElement) =>
    Boolean(element.dataset.inlineAlign || element.dataset.blockAlign);

const setTextShift = (element: HTMLElement) => {
    const measurement = measureText(element);
    const freeWidth = Math.max(0, (measurement.vertical ? measurement.availableWidth : measurement.wrapWidth) - measurement.textWidth);
    const freeHeight = Math.max(0, (measurement.vertical ? measurement.wrapHeight : measurement.availableHeight) - measurement.textHeight);
    if (hasExplicitAlign(element)) {
        const inlineAlign = element.dataset.inlineAlign;
        const blockAlign = element.dataset.blockAlign;
        if (measurement.vertical) {
            const inlineFactor = alignFactor(inlineAlign);
            const blockFactor = alignFactor(blockAlign);
            element.style.setProperty("--overlay-shift-x", `${(-freeWidth * (1 - blockFactor)).toFixed(2)}px`);
            element.style.setProperty("--overlay-shift-y", `${(freeHeight * inlineFactor).toFixed(2)}px`);
            return;
        }
        element.style.setProperty("--overlay-shift-x", `${(freeWidth * alignFactor(inlineAlign)).toFixed(2)}px`);
        element.style.setProperty("--overlay-shift-y", `${(freeHeight * alignFactor(blockAlign)).toFixed(2)}px`);
        return;
    }
    if (measurement.vertical) {
        const estimate = verticalLayoutEstimate(element);
        const horizontalGravity = estimate.fillWidth < 0.82 ? 0.42 : 0.18;
        const verticalGravity = estimate.fillHeight < 0.82 ? 0.42 : 0.18;
        element.style.setProperty("--overlay-shift-x", `${(-freeWidth * horizontalGravity).toFixed(2)}px`);
        element.style.setProperty("--overlay-shift-y", `${(freeHeight * verticalGravity).toFixed(2)}px`);
        return;
    }
    const verticalGravity = measurement.textHeight / measurement.availableHeight < 0.82 ? 0.36 : 0.12;
    element.style.setProperty("--overlay-shift-x", "0px");
    element.style.setProperty("--overlay-shift-y", `${(freeHeight * verticalGravity).toFixed(2)}px`);
};

const storeMeasurementDebug = (element: HTMLElement) => {
    const measurement = measureText(element);
    if (measurement.vertical) {
        const estimate = verticalLayoutEstimate(element);
        element.dataset.fitFillWidth = estimate.fillWidth.toFixed(3);
        element.dataset.fitFillHeight = estimate.fillHeight.toFixed(3);
        element.dataset.fitActualWidth = (measurement.textWidth / measurement.availableWidth).toFixed(3);
        element.dataset.fitActualHeight = (measurement.textHeight / measurement.availableHeight).toFixed(3);
        return;
    }
    element.dataset.fitFillWidth = (measurement.textWidth / measurement.availableWidth).toFixed(3);
    element.dataset.fitFillHeight = (measurement.textHeight / measurement.availableHeight).toFixed(3);
};

const findLargestScaleThatFits = (element: HTMLElement, predicate: (element: HTMLElement) => boolean) => {
    let low = MIN_REFIT_SCALE;
    let high = 1;
    let best = MIN_REFIT_SCALE;

    for (let step = 0; step < MAX_STEPS; step += 1) {
        const mid = (low + high) / 2;
        setRefitScale(element, mid);
        if (predicate(element)) {
            high = mid;
        } else {
            best = mid;
            low = mid;
        }
    }

    return best;
};

export const refitLetteringBubble = (element: HTMLElement) => {
    element.dataset.overflow = "fit";
    setRefitScale(element, 1);
    const fitMode = element.dataset.fitMode ?? "auto";

    if (fitMode === "fixed") {
        if (overflows(element)) {
            element.dataset.overflow = "scroll";
        }
        setTextShift(element);
        storeMeasurementDebug(element);
        return;
    }

    if (fitMode === "shrink") {
        if (!overflows(element)) {
            setTextShift(element);
            storeMeasurementDebug(element);
            return;
        }
        setRefitScale(element, MIN_REFIT_SCALE);
        if (overflows(element)) {
            element.dataset.overflow = "scroll";
            setTextShift(element);
            storeMeasurementDebug(element);
            return;
        }
        const best = findLargestScaleThatFits(element, overflows);
        setRefitScale(element, best);
        element.dataset.overflow = overflows(element) ? "scroll" : "fit";
        setTextShift(element);
        storeMeasurementDebug(element);
        return;
    }

    if (!exceedsTargetFill(element)) {
        setTextShift(element);
        storeMeasurementDebug(element);
        return;
    }

    setRefitScale(element, MIN_REFIT_SCALE);
    if (exceedsTargetFill(element)) {
        if (overflows(element)) {
            element.dataset.overflow = "scroll";
            setTextShift(element);
            storeMeasurementDebug(element);
            return;
        }
        // The preferred whitespace target is impossible for this Bubble. Keep the
        // lower readable scale instead of growing back to a no-margin fit.
        element.dataset.overflow = "fit";
        setTextShift(element);
        storeMeasurementDebug(element);
        return;
    }

    const best = findLargestScaleThatFits(element, exceedsTargetFill);
    setRefitScale(element, best);
    element.dataset.overflow = overflows(element) ? "scroll" : "fit";
    setTextShift(element);
    storeMeasurementDebug(element);
};

export const refitLetteringNow = (root: ParentNode = document) => {
    const bubbles = Array.from(root.querySelectorAll<HTMLElement>("[data-overlay-bubble]"));
    if (bubbles.length === 0) return;
    for (const bubble of bubbles) {
        refitLetteringBubble(bubble);
    }
};

export const startLetteringRefit = (root: ParentNode = document) => {
    let refitQueued = false;
    const refitAll = () => {
        if (refitQueued) return;
        refitQueued = true;
        requestAnimationFrame(() => {
            refitQueued = false;
            refitLetteringNow(root);
        });
    };

    const startRefit = () => {
        // Run once immediately and again after the next paint/font load. The
        // initial module can execute before lazy images and web fonts settle, so
        // the follow-up passes keep fitted text deterministic without listening
        // to viewport resize.
        refitLetteringNow(root);
        refitAll();
        window.addEventListener("load", refitAll, { once: true });
        void document.fonts?.ready.then(refitAll);
        window.setTimeout(refitAll, 250);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startRefit, { once: true });
    } else {
        startRefit();
    }

    // Overlay coordinates and font sizes use cqw, so viewport resizing naturally
    // rescales the fitted text with the page container. Re-run only when text
    // nodes change, such as browser translation or future language swaps.
    const observerRoot = root instanceof Document
        ? root.querySelector("[data-overlay-fit-root]")
        : root;
    if (observerRoot) {
        const observer = new MutationObserver((mutations) => {
            if (mutations.some((mutation) => mutation.type === "characterData" || mutation.type === "childList")) {
                refitAll();
            }
        });
        observer.observe(observerRoot, { characterData: true, childList: true, subtree: true });
        return () => observer.disconnect();
    }

    return () => { };
};
