import {
  animate,
  createScope,
  createTimeline,
  engine,
  stagger,
} from "animejs";

const SELECTORS = Object.freeze({
  brand: "[data-ui-brand] > *, .brand > .brand-mark, .brand > .brand-copy",
  loader:
    "[data-ui-loader] > *, .experience-loader > span, .experience-loader > i",
  loaderBar:
    "[data-ui-loader-bar], .experience-loader > i > b",
  heroEyebrow: "[data-ui-hero-eyebrow], .hero-eyebrow",
  heroLines: "[data-ui-hero-line] > *, .hero-line > span",
  heroSupport:
    "[data-ui-hero-support], .hero-summary, .hero-actions > *, .hero-proof > li, .scroll-cue",
  chapterKicker: "[data-ui-chapter-kicker], .chapter-kicker",
  chapterTitle: "[data-ui-chapter-title], h2, h3",
  chapterCopy:
    "[data-ui-chapter-copy], p:not(.chapter-kicker), [data-ui-chapter-status], .chapter-status",
  communicationPulse:
    "[data-ui-communication-pulse], .communication-pulse, .chapter-status > i",
  podContent:
    "[data-ui-pod-content] > *, .pod-content > *, [data-ui-pod-row], #podCard text",
  signature: "[data-ui-signature], #signature",
  podCheck: "[data-ui-pod-check] path, #podCheck path",
  successIcon: "[data-ui-success-icon], :scope > span",
  successCopy: "[data-ui-success-copy] > *, :scope > div > *",
});

const isElement = (value) => Boolean(value && value.nodeType === 1);
const isDocument = (value) => Boolean(value && value.nodeType === 9);

function unique(elements) {
  return [...new Set(elements.filter(isElement))];
}

function normalizeRoot(root) {
  if (root && (isElement(root) || isDocument(root))) return root;
  return typeof document === "undefined" ? null : document;
}

function getReducedMotionPreference(reducedMotion) {
  if (typeof reducedMotion === "function") return Boolean(reducedMotion());
  if (reducedMotion && typeof reducedMotion.matches === "boolean") {
    return reducedMotion.matches;
  }
  if (typeof reducedMotion === "boolean") return reducedMotion;
  return typeof window !== "undefined" && "matchMedia" in window
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function safeQueryAll(root, selector) {
  if (!root || !selector || typeof root.querySelectorAll !== "function") return [];

  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function normalizeTargets(root, target, fallbackSelector = "") {
  if (target == null) return unique(safeQueryAll(root, fallbackSelector));
  if (typeof target === "string") return unique(safeQueryAll(root, target));
  if (isElement(target)) return [target];
  if (typeof target[Symbol.iterator] === "function") {
    return unique([...target].flatMap((item) => normalizeTargets(root, item)));
  }
  return [];
}

function collectDescendants(containers, selector, includeMatchingContainer = true) {
  return unique(
    containers.flatMap((container) => {
      const matches =
        includeMatchingContainer && container.matches?.(selector) ? [container] : [];
      return [...matches, ...safeQueryAll(container, selector)];
    }),
  );
}

function geometryLength(path) {
  if (path.getAttribute?.("pathLength") === "1") return 1;
  if (typeof path.getTotalLength !== "function") return 1;

  try {
    return Math.max(path.getTotalLength(), 1);
  } catch {
    return 1;
  }
}

/**
 * Creates the Anime.js-owned UI motion layer.
 *
 * Scroll-linked transforms belong to GSAP. This module deliberately animates
 * only descendants inside those containers (headlines, copy, dots, SVG paths,
 * and success-message children).
 *
 * Set `manualEngine` to true when the app's GSAP ticker owns the single frame
 * loop, then invoke `tick()` from that ticker.
 *
 * @param {object} [options]
 * @param {boolean|MediaQueryList|(() => boolean)} [options.reducedMotion]
 * @param {Document|Element} [options.root]
 * @param {boolean} [options.manualEngine=false]
 */
export function createUiMotion({
  reducedMotion,
  root: rootOption,
  manualEngine = false,
} = {}) {
  const root = normalizeRoot(rootOption);
  if (!root) {
    return {
      intro: () => null,
      chapterEnter: () => null,
      communicationPulse: () => null,
      podComplete: () => null,
      formSuccess: () => null,
      tick: () => {},
      destroy: () => {},
    };
  }

  const scope = createScope(
    isDocument(root)
      ? { defaults: { composition: "replace" } }
      : { root, defaults: { composition: "replace" } },
  );
  const manualEngineActive = manualEngine && !getReducedMotionPreference(reducedMotion);
  const previousDefaultLoop = engine.useDefaultMainLoop;
  let destroyed = false;
  let lastChapter = null;

  if (manualEngineActive) {
    engine.pause();
    engine.useDefaultMainLoop = false;
  }

  const inScope = (callback) => {
    if (destroyed || getReducedMotionPreference(reducedMotion)) return null;
    return scope.execute(callback);
  };

  /**
   * Plays the loader detail, brand reveal, and hero-copy entrance.
   * The loader shell is intentionally not hidden here; the experience owner
   * controls readiness and fallback visibility.
   */
  function intro({ includeLoader = true } = {}) {
    return inScope(() => {
      const loader = includeLoader ? safeQueryAll(root, SELECTORS.loader) : [];
      const loaderBar = includeLoader ? safeQueryAll(root, SELECTORS.loaderBar) : [];
      const brand = safeQueryAll(root, SELECTORS.brand);
      const eyebrow = safeQueryAll(root, SELECTORS.heroEyebrow);
      const lines = safeQueryAll(root, SELECTORS.heroLines);
      const support = safeQueryAll(root, SELECTORS.heroSupport);
      const timeline = createTimeline({ defaults: { ease: "outExpo" } });

      if (loader.length) {
        timeline.add(
          loader,
          {
            opacity: [0, 1],
            translateY: ["8px", "0px"],
            duration: 460,
            delay: stagger(45),
          },
          0,
        );
      }
      if (loaderBar.length) {
        timeline.add(
          loaderBar,
          { scaleX: [0, 1], duration: 900, ease: "inOutCubic" },
          40,
        );
      }
      if (brand.length) {
        timeline.add(
          brand,
          {
            opacity: [0, 1],
            translateY: ["-10px", "0px"],
            duration: 620,
            delay: stagger(55),
          },
          70,
        );
      }
      if (eyebrow.length) {
        timeline.add(
          eyebrow,
          { opacity: [0, 1], translateY: ["12px", "0px"], duration: 620 },
          110,
        );
      }
      if (lines.length) {
        timeline.add(
          lines,
          {
            opacity: [0, 1],
            translateY: ["112%", "0%"],
            duration: 940,
            delay: stagger(95),
          },
          150,
        );
      }
      if (support.length) {
        timeline.add(
          support,
          {
            opacity: [0, 1],
            translateY: ["16px", "0px"],
            duration: 720,
            delay: stagger(60),
          },
          430,
        );
      }

      return timeline;
    });
  }

  /**
   * Reveals only the active chapter's inner typography/status content.
   * `chapter` can be a chapter index, selector, or element.
   */
  function chapterEnter(chapter, { force = false } = {}) {
    let chapters;
    if (Number.isInteger(chapter)) {
      chapters = safeQueryAll(root, `[data-chapter="${chapter}"]`);
    } else {
      chapters = normalizeTargets(root, chapter, ".chapter.is-active");
    }

    const chapterElement = chapters[0];
    if (!chapterElement || (!force && lastChapter === chapterElement)) return null;
    lastChapter = chapterElement;

    return inScope(() => {
      const kicker = safeQueryAll(chapterElement, SELECTORS.chapterKicker);
      const title = safeQueryAll(chapterElement, SELECTORS.chapterTitle);
      const copy = safeQueryAll(chapterElement, SELECTORS.chapterCopy);
      const timeline = createTimeline({ defaults: { ease: "outExpo" } });

      if (kicker.length) {
        timeline.add(
          kicker,
          { opacity: [0, 1], translateY: ["10px", "0px"], duration: 420 },
          0,
        );
      }
      if (title.length) {
        timeline.add(
          title,
          { opacity: [0, 1], translateY: ["24px", "0px"], duration: 680 },
          55,
        );
      }
      if (copy.length) {
        timeline.add(
          copy,
          {
            opacity: [0, 1],
            translateY: ["14px", "0px"],
            duration: 540,
            delay: stagger(55),
          },
          190,
        );
      }

      return timeline;
    });
  }

  /** Plays two finite pulses on communication/status indicators. */
  function communicationPulse(target) {
    let pulseTargets;
    if (target == null) {
      pulseTargets = safeQueryAll(root, "[data-ui-communication-pulse]");
      if (!pulseTargets.length) {
        const communicationChapter = safeQueryAll(root, '[data-chapter="3"]');
        pulseTargets = collectDescendants(
          communicationChapter,
          SELECTORS.communicationPulse,
        );
      }
    } else {
      const containers = normalizeTargets(root, target);
      pulseTargets = collectDescendants(
        containers,
        SELECTORS.communicationPulse,
      );
      if (!pulseTargets.length) pulseTargets = containers;
    }

    if (!pulseTargets.length) return null;

    return inScope(() =>
      animate(pulseTargets, {
        keyframes: [
          { scale: [0.72, 1.55], opacity: [0.45, 1], duration: 320, ease: "outExpo" },
          { scale: 1, opacity: 0.68, duration: 420, ease: "inOutQuad" },
          { scale: 1.35, opacity: 1, duration: 260, ease: "outExpo" },
          { scale: 1, opacity: 0.68, duration: 420, ease: "inOutQuad" },
        ],
        delay: stagger(80),
      }),
    );
  }

  /** Draws the POD signature/check and reveals POD interior rows. */
  function podComplete(target) {
    const containers = normalizeTargets(root, target);
    const searchRoots = containers.length ? containers : [root];
    const content = unique(
      searchRoots.flatMap((container) => safeQueryAll(container, SELECTORS.podContent)),
    );
    const signatures = unique(
      searchRoots.flatMap((container) => safeQueryAll(container, SELECTORS.signature)),
    );
    const checks = unique(
      searchRoots.flatMap((container) => safeQueryAll(container, SELECTORS.podCheck)),
    );

    if (!content.length && !signatures.length && !checks.length) return null;

    return inScope(() => {
      const timeline = createTimeline({ defaults: { ease: "outCubic" } });

      if (content.length) {
        timeline.add(
          content,
          {
            opacity: [0, 1],
            translateY: ["7px", "0px"],
            duration: 420,
            delay: stagger(35),
          },
          0,
        );
      }

      signatures.forEach((path, index) => {
        const length = geometryLength(path);
        timeline.add(
          path,
          {
            strokeDasharray: `${length} ${length}`,
            strokeDashoffset: [length, 0],
            duration: 720,
            ease: "inOutCubic",
          },
          160 + index * 65,
        );
      });

      checks.forEach((path, index) => {
        const length = geometryLength(path);
        timeline.add(
          path,
          {
            strokeDasharray: `${length} ${length}`,
            strokeDashoffset: [length, 0],
            duration: 420,
            ease: "outExpo",
          },
          700 + index * 55,
        );
      });

      return timeline;
    });
  }

  /** Reveals the already-submitted form's success-message interior. */
  function formSuccess(target = "#formSuccess") {
    const success = normalizeTargets(root, target)[0];
    if (!success) return null;

    success.hidden = false;
    if (getReducedMotionPreference(reducedMotion) || destroyed) return null;

    return scope.execute(() => {
      const icons = safeQueryAll(success, SELECTORS.successIcon);
      const copy = safeQueryAll(success, SELECTORS.successCopy);
      const timeline = createTimeline({ defaults: { ease: "outExpo" } });

      if (icons.length) {
        timeline.add(
          icons,
          { opacity: [0, 1], scale: [0.62, 1], duration: 520 },
          0,
        );
      }
      if (copy.length) {
        timeline.add(
          copy,
          {
            opacity: [0, 1],
            translateX: ["10px", "0px"],
            duration: 520,
            delay: stagger(45),
          },
          80,
        );
      }

      return timeline;
    });
  }

  /** Advances Anime's clock when a shared GSAP ticker owns the frame loop. */
  function tick() {
    if (!destroyed && manualEngineActive && !document.hidden) engine.update();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    lastChapter = null;
    scope.revert();

    if (manualEngineActive) {
      engine.useDefaultMainLoop = previousDefaultLoop;
      if (previousDefaultLoop) engine.wake();
    }
  }

  return {
    intro,
    chapterEnter,
    communicationPulse,
    podComplete,
    formSuccess,
    tick,
    destroy,
  };
}

