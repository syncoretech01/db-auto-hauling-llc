import "lenis/dist/lenis.css";

let LenisConstructor = null;
let gsap = null;
let ScrollTrigger = null;
let createUiMotionFactory = null;

const root = document.documentElement;
root.classList.remove("no-js");
root.classList.add("experience-pending");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const saveData = Boolean(navigator.connection?.saveData);

const elements = {
  header: document.getElementById("siteHeader"),
  brand: document.querySelector(".brand"),
  progress: document.getElementById("pageProgress"),
  menuToggle: document.getElementById("menuToggle"),
  siteNav: document.getElementById("siteNav"),
  main: document.getElementById("main"),
  hero: document.getElementById("home"),
  process: document.getElementById("process"),
  journey: document.getElementById("journey"),
  journeySticky: document.querySelector(".journey-sticky"),
  chapters: [...document.querySelectorAll(".chapter")],
  railItems: [...document.querySelectorAll(".journey-rail li")],
  railButtons: [...document.querySelectorAll(".journey-rail button")],
  activeChapterLabel: document.getElementById("activeChapterLabel"),
  sceneBadge: document.getElementById("sceneBadge"),
  sceneCaption: document.getElementById("sceneCaptionStatus"),
  canvasShell: document.getElementById("experienceCanvasShell"),
  canvas: document.getElementById("freightCanvas"),
  loader: document.getElementById("experienceLoader"),
  form: document.getElementById("laneForm"),
  formSuccess: document.getElementById("formSuccess"),
  footer: document.querySelector(".site-footer"),
  skipLink: document.querySelector(".skip-link"),
};

const STAGES = [
  { id: "load", label: "At pickup", badge: "LOAD", status: "Freight on deck", globalStart: 0.15, focus: 0.225 },
  { id: "secure", label: "Before departure", badge: "SECURE", status: "Securement checked", globalStart: 0.3, focus: 0.375 },
  { id: "move", label: "In transit", badge: "MOVE", status: "Wheels rolling", globalStart: 0.45, focus: 0.56 },
  { id: "update", label: "Along the route", badge: "UPDATE", status: "Status shared", globalStart: 0.67, focus: 0.755 },
  { id: "document", label: "At delivery", badge: "DOCUMENT", status: "Delivery documented", globalStart: 0.84, focus: 0.92 },
];

const PINNED_SCENE_START = 0.22;
const PINNED_SCENE_RANGE = 1 - PINNED_SCENE_START;

let lenis = null;
let experience = null;
let uiMotion = null;
let masterTrigger = null;
let ticker = null;
let activeStage = -1;
let experienceVisible = true;
let destroyed = false;
let experienceObserver = null;
let enhancedContext = null;
let fallbackActivated = false;
let resizeFrame = null;
let enhancementIntentHandler = null;

const INTENT_EVENTS = ["pointerdown", "pointermove", "wheel", "touchstart", "keydown", "scroll"];

function supportsWebGL2() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

function setFallback(reason = "unsupported") {
  root.classList.remove("experience-pending", "experience-loading", "experience-ready");
  root.classList.add("experience-fallback");
  root.dataset.experienceFallback = reason;
  delete root.dataset.activeStage;
  elements.loader?.setAttribute("hidden", "");
  elements.chapters.forEach((chapter) => chapter.removeAttribute("aria-hidden"));
  elements.railButtons.forEach((button, index) => {
    if (index === 0) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function setChapter(index, force = false) {
  const next = Math.max(0, Math.min(STAGES.length - 1, index));
  if (!force && next === activeStage) return;
  activeStage = next;
  const stage = STAGES[next];
  root.dataset.activeStage = stage.id;

  elements.chapters.forEach((chapter, chapterIndex) => {
    chapter.classList.toggle("is-active", chapterIndex === next);
  });
  elements.railItems.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === next));
  elements.railButtons.forEach((button, buttonIndex) => {
    if (buttonIndex === next) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  if (elements.activeChapterLabel) elements.activeChapterLabel.textContent = stage.label;
  if (elements.sceneBadge) {
    elements.sceneBadge.innerHTML = `<span>${String(next + 1).padStart(2, "0")}</span> ${stage.badge}`;
  }
  if (elements.sceneCaption) elements.sceneCaption.textContent = stage.status;

  uiMotion?.chapterEnter(next);
  if (stage.id === "update") uiMotion?.communicationPulse();
  if (stage.id === "document") uiMotion?.podComplete();
}

function stageFromProgress(progress) {
  let index = 0;
  STAGES.forEach((stage, stageIndex) => {
    if (progress >= stage.globalStart) index = stageIndex;
  });
  return index;
}

function initBasicUi() {
  document.getElementById("year").textContent = new Date().getFullYear();
  const menuLabel = elements.menuToggle.querySelector(".sr-only");
  const firstMenuLink = elements.siteNav.querySelector("a");

  const closeMenu = ({ restoreFocus = false } = {}) => {
    const wasOpen = elements.menuToggle.getAttribute("aria-expanded") === "true";
    elements.menuToggle.setAttribute("aria-expanded", "false");
    if (menuLabel) menuLabel.textContent = "Open menu";
    elements.siteNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    elements.main.inert = false;
    elements.footer.inert = false;
    elements.skipLink.inert = false;
    lenis?.start();
    if (restoreFocus && wasOpen) elements.menuToggle.focus({ preventScroll: true });
  };

  elements.menuToggle.addEventListener("click", () => {
    const open = elements.menuToggle.getAttribute("aria-expanded") !== "true";
    elements.menuToggle.setAttribute("aria-expanded", String(open));
    if (menuLabel) menuLabel.textContent = open ? "Close menu" : "Open menu";
    elements.siteNav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    elements.main.inert = open;
    elements.footer.inert = open;
    elements.skipLink.inert = open;
    if (open) {
      lenis?.stop();
      window.requestAnimationFrame(() => firstMenuLink?.focus({ preventScroll: true }));
    } else {
      lenis?.start();
    }
  });

  elements.siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });
  elements.brand.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu({ restoreFocus: true });
  });

  document.querySelector(".skip-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    elements.main.focus({ preventScroll: true });
    if (lenis) {
      lenis.scrollTo(elements.main, {
        immediate: true,
        force: true,
      });
    } else {
      elements.main.scrollIntoView({ block: "start" });
    }
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    elements.formSuccess.hidden = false;
    uiMotion?.formSuccess();
  });
}

function initFallbackReveals() {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}

function createSmoothScroll() {
  lenis = new LenisConstructor({
    autoRaf: false,
    anchors: true,
    lerp: coarsePointer.matches ? 0.14 : 0.085,
    smoothWheel: !coarsePointer.matches,
    syncTouch: false,
    stopInertiaOnNavigate: true,
    overscroll: true,
  });

  lenis.on("scroll", ScrollTrigger.update);
  if (document.body.classList.contains("menu-open")) lenis.stop();
}

function createSectionReveals() {
  const revealItems = gsap.utils.toArray(".reveal");
  revealItems.forEach((item) => {
    gsap.fromTo(
      item,
      { opacity: 0, y: 38 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: item,
          start: "top 88%",
          once: true,
        },
      },
    );
  });

  gsap.to(".lane-marquee > div", {
    xPercent: -25,
    ease: "none",
    scrollTrigger: {
      trigger: ".lane-section",
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
    },
  });

  gsap.fromTo(
    ".contact-route-line",
    { strokeDashoffset: 1 },
    {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".contact-section",
        start: "top 82%",
        end: "center 30%",
        scrub: 0.7,
      },
    },
  );
}

function createExperienceTimeline() {
  enhancedContext = gsap.context(() => {
    const heroProxy = { value: 0 };
    gsap.to(heroProxy, {
      value: 0.15,
      ease: "none",
      onUpdate: () => experience?.setProgress(heroProxy.value),
      scrollTrigger: {
        trigger: elements.hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.65,
      },
    });

    const processProxy = { value: 0.15 };
    gsap.to(processProxy, {
      value: PINNED_SCENE_START,
      ease: "none",
      onUpdate: () => experience?.setProgress(processProxy.value),
      scrollTrigger: {
        trigger: elements.process,
        start: "top top",
        end: "bottom top",
        scrub: 0.65,
      },
    });

    gsap.to(".hero-content", {
      yPercent: -12,
      autoAlpha: 0.25,
      ease: "none",
      scrollTrigger: {
        trigger: elements.hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      },
    });

    const journeyProxy = { value: PINNED_SCENE_START };
    const journeyTimeline = gsap.timeline({ paused: true });
    journeyTimeline.to(journeyProxy, {
      value: 1,
      duration: 1,
      ease: "none",
      onUpdate: () => experience?.setProgress(journeyProxy.value),
    });
    STAGES.forEach((stage) => {
      const globalLabel = Math.max(PINNED_SCENE_START, stage.focus);
      journeyTimeline.addLabel(stage.id, (globalLabel - PINNED_SCENE_START) / PINNED_SCENE_RANGE);
    });

    masterTrigger = ScrollTrigger.create({
      id: "freight-journey",
      trigger: elements.journey,
      animation: journeyTimeline,
      pin: elements.journeySticky,
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * (coarsePointer.matches ? 4.4 : 5.25))}`,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const globalProgress = PINNED_SCENE_START + self.progress * PINNED_SCENE_RANGE;
        setChapter(stageFromProgress(globalProgress));
      },
    });

    ScrollTrigger.create({
      id: "page-progress",
      start: 0,
      end: () => ScrollTrigger.maxScroll(window),
      onUpdate: (self) => {
        elements.progress.style.transform = `scaleX(${self.progress})`;
        elements.header.classList.toggle("is-scrolled", self.scroll() > 42);
      },
    });

    createSectionReveals();
  });

  elements.railButtons.forEach((button, index) => {
    const onRailClick = () => {
      if (!masterTrigger || !lenis) return;
      const labelPosition = masterTrigger.labelToScroll?.(STAGES[index].id);
      const fallbackProgress = (STAGES[index].focus - PINNED_SCENE_START) / PINNED_SCENE_RANGE;
      const target = Number.isFinite(labelPosition)
        ? labelPosition
        : masterTrigger.start + masterTrigger.change * fallbackProgress;
      lenis.scrollTo(target, { duration: 1.05, force: true });
    };
    button._journeyHandler = onRailClick;
    button.addEventListener("click", onRailClick);
  });

  setChapter(0, true);
}

function createVisibilityObserver() {
  const visibility = new Map([
    [elements.hero, true],
    [elements.process, false],
    [elements.journey, false],
  ]);

  experienceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => visibility.set(entry.target, entry.isIntersecting));
      experienceVisible = [...visibility.values()].some(Boolean);
      experience?.setActive?.(experienceVisible && !document.hidden);
    },
    { rootMargin: "20% 0px" },
  );

  visibility.forEach((_, element) => experienceObserver.observe(element));
}

function setQualityForViewport() {
  if (!experience) return;
  const mobile = coarsePointer.matches || window.innerWidth < 760;
  const requested = mobile ? "mobile" : "high";
  if (experience.state?.quality !== requested) experience.setQuality?.(requested);
  else experience.resize?.();
}

function handleResize() {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    setQualityForViewport();
  });
}

function startTicker() {
  if (ticker) return;
  ticker = (time) => {
    lenis?.raf(time * 1000);
    uiMotion?.tick();

    if (!document.hidden && experienceVisible && experience) {
      const animated = experience.update?.(time);
      if (animated || experience.state?.needsRender) experience.render?.();
    }
  };
  gsap.ticker.add(ticker);
  gsap.ticker.lagSmoothing(0);
}

function stopTicker() {
  if (!ticker) return;
  gsap.ticker.remove(ticker);
  ticker = null;
}

function releaseEnhancedExperience() {
  stopTicker();
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = null;
  window.removeEventListener("resize", handleResize);

  elements.railButtons.forEach((button) => {
    if (button._journeyHandler) {
      button.removeEventListener("click", button._journeyHandler);
      delete button._journeyHandler;
    }
  });

  masterTrigger?.kill(true);
  masterTrigger = null;
  enhancedContext?.revert();
  enhancedContext = null;
  experienceObserver?.disconnect();
  experienceObserver = null;
  uiMotion?.destroy();
  uiMotion = null;
  lenis?.destroy();
  lenis = null;
  experience?.destroy();
  experience = null;
}

function disarmEnhancement() {
  if (enhancementIntentHandler) {
    INTENT_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, enhancementIntentHandler);
    });
    enhancementIntentHandler = null;
  }
}

function armEnhancement() {
  if (destroyed || fallbackActivated || reducedMotion.matches) return;
  enhancementIntentHandler = () => {
    disarmEnhancement();
    enhance();
  };
  INTENT_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, enhancementIntentHandler, { passive: true });
  });
}

function activateRuntimeFallback(reason) {
  if (destroyed || fallbackActivated) return;
  fallbackActivated = true;
  disarmEnhancement();
  releaseEnhancedExperience();
  initFallbackReveals();
  setFallback(reason);
  window.requestAnimationFrame(() => ScrollTrigger?.refresh?.());
}

async function enhance() {
  if (destroyed || fallbackActivated || reducedMotion.matches) return;

  try {
    const [lenisModule, gsapModule, scrollTriggerModule, uiModule, sceneModule] = await Promise.all([
      import("lenis"),
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("./motion/ui.js"),
      import("./experience/scene.js"),
    ]);
    if (destroyed || fallbackActivated || reducedMotion.matches) return;

    LenisConstructor = lenisModule.default;
    gsap = gsapModule.default ?? gsapModule.gsap;
    ScrollTrigger = scrollTriggerModule.ScrollTrigger;
    createUiMotionFactory = uiModule.createUiMotion;
    gsap.registerPlugin(ScrollTrigger);

    root.classList.add("experience-loading");
    root.classList.remove("experience-pending", "experience-fallback");
    createSmoothScroll();
    uiMotion = createUiMotionFactory({ reducedMotion: false, root: document, manualEngine: true });
    uiMotion.intro();
    startTicker();

    const sceneController = sceneModule.createExperience({
      canvas: elements.canvas,
      quality: coarsePointer.matches || window.innerWidth < 760 ? "mobile" : "desktop",
      onContextLost: (event) => {
        event?.preventDefault?.();
        activateRuntimeFallback("context-lost");
      },
    });
    experience = sceneController;
    await sceneController.ready;
    if (destroyed || fallbackActivated || reducedMotion.matches) {
      sceneController.destroy();
      if (experience === sceneController) experience = null;
      return;
    }

    root.classList.remove("experience-loading");
    root.classList.add("experience-ready");
    elements.loader?.setAttribute("hidden", "");

    createExperienceTimeline();
    createVisibilityObserver();
    setQualityForViewport();

    window.addEventListener("resize", handleResize, { passive: true });
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    }
    document.fonts?.ready.then(() => {
      if (!destroyed && !fallbackActivated) ScrollTrigger.refresh();
    });
    ScrollTrigger.refresh();

    if (window.location.hash && window.location.hash !== "#home") {
      window.requestAnimationFrame(() => {
        try {
          const target = document.querySelector(window.location.hash);
          if (target) lenis?.scrollTo(target, { immediate: true, force: true });
        } catch {
          // Ignore malformed fragments; native navigation has already handled them.
        }
      });
    }
  } catch (error) {
    console.warn("The cinematic freight scene could not start; showing the accessible fallback.", error);
    activateRuntimeFallback("load-failed");
  }
}

function destroy() {
  if (destroyed) return;
  destroyed = true;
  disarmEnhancement();
  releaseEnhancedExperience();
}

initBasicUi();

if (reducedMotion.matches) {
  initFallbackReveals();
  setFallback("reduced-motion");
} else if (saveData) {
  initFallbackReveals();
  setFallback("save-data");
} else if (!supportsWebGL2()) {
  initFallbackReveals();
  setFallback("webgl2-unavailable");
} else {
  window.requestAnimationFrame(() => window.requestAnimationFrame(armEnhancement));
}

reducedMotion.addEventListener?.("change", (event) => {
  if (event.matches) activateRuntimeFallback("reduced-motion");
});

document.addEventListener("visibilitychange", () => {
  experience?.setActive?.(!document.hidden && experienceVisible);
});
window.addEventListener("pagehide", destroy, { once: true });
