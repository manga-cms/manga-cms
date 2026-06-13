const MIN_REFIT_SCALE = 0.32;
const MAX_STEPS = 8;
const FIT_EPSILON = 1;
const TARGET_FILL_RATIO = 0.86;

const overflows = (element: HTMLElement) =>
  element.scrollHeight > element.clientHeight + FIT_EPSILON
  || element.scrollWidth > element.clientWidth + FIT_EPSILON;

const exceedsTargetFill = (element: HTMLElement) =>
  element.scrollHeight > element.clientHeight * TARGET_FILL_RATIO + FIT_EPSILON
  || element.scrollWidth > element.clientWidth * TARGET_FILL_RATIO + FIT_EPSILON;

const setRefitScale = (element: HTMLElement, scale: number) => {
  element.style.setProperty("--overlay-refit", scale.toFixed(4));
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

const refitBubble = (element: HTMLElement) => {
  element.dataset.overflow = "fit";
  setRefitScale(element, 1);

  if (!exceedsTargetFill(element)) return;

  setRefitScale(element, MIN_REFIT_SCALE);
  if (exceedsTargetFill(element)) {
    if (overflows(element)) {
      element.dataset.overflow = "scroll";
      return;
    }
    // The preferred whitespace target is impossible for this Bubble. Use the
    // largest readable scale that avoids actual clipping instead of forcing the
    // global lower bound, then fall back to scroll only if even that clips.
    const fallbackScale = findLargestScaleThatFits(element, overflows);
    setRefitScale(element, fallbackScale);
    element.dataset.overflow = overflows(element) ? "scroll" : "fit";
    return;
  }

  const best = findLargestScaleThatFits(element, exceedsTargetFill);
  setRefitScale(element, best);
  element.dataset.overflow = overflows(element) ? "scroll" : "fit";
};

const refitNow = () => {
  const bubbles = Array.from(document.querySelectorAll<HTMLElement>("[data-overlay-bubble]"));
  if (bubbles.length === 0) return;
  for (const bubble of bubbles) {
    refitBubble(bubble);
  }
};

let refitQueued = false;

const refitAll = () => {
  if (refitQueued) return;
  refitQueued = true;
  requestAnimationFrame(() => {
    refitQueued = false;
    refitNow();
  });
};

const startRefit = () => {
  // Run once immediately and again after the next paint/font load. The initial
  // module can execute before lazy images and web fonts settle, so the follow-up
  // passes keep fitted text deterministic without listening to viewport resize.
  refitNow();
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
// rescales the fitted text with the page container. Re-run only when text nodes
// change, such as browser translation or future language swaps.
const root = document.querySelector("[data-overlay-fit-root]");
if (root) {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "characterData" || mutation.type === "childList")) {
      refitAll();
    }
  });
  observer.observe(root, { characterData: true, childList: true, subtree: true });
}
