import React, { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

export const LENIS_CSS = `
html.lenis, html.lenis body {
  height: auto;
}
.lenis.lenis-smooth {
  scroll-behavior: auto !important;
}
.lenis.lenis-smooth [data-lenis-prevent] {
  overscroll-behavior: contain;
}
.lenis.lenis-stopped {
  overflow: hidden;
}
.lenis.lenis-scrolling iframe {
  pointer-events: none;
}
`;

// Easing curves mapping progress 0..1 -> eased 0..1
export const EASINGS = {
  default: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  gentle: (t: number) => 1 - Math.pow(1 - t, 3),
  linear: (t: number) => t,
  snappy: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -12 * t)),
} as const;

export type EasingType = keyof typeof EASINGS;

export interface NextSmoothScrollProps {
  intensity?: number;
  easing?: EasingType;
  orientation?: "vertical" | "horizontal";
  wheelMultiplier?: number;
  touchMultiplier?: number;
  smoothTouch?: boolean;
  respectReducedMotion?: boolean;
  disableBelow?: number;
  infinite?: boolean;
  resetScrollOnPageChange?: boolean;
  preventSelectors?: string;
  smoothAnchors?: boolean;
  anchorOffset?: number;
  showProgress?: boolean;
  progressColor?: string;
  progressHeight?: number;
  progressPosition?: "top" | "bottom";
  showScrollTop?: boolean;
  scrollTopThreshold?: number;
  scrollTopCorner?: "bottom-left" | "bottom-center" | "bottom-right";
  scrollTopColor?: string;
  scrollTopIconColor?: string;
  scrollTopSize?: number;
  scrollTopOffset?: number;
  scrollTopRadius?: number;
}

let cssRefCount = 0;

function injectCSS() {
  cssRefCount++;
  if (cssRefCount > 1) return;
  const style = document.createElement("style");
  style.id = "__lenis-css__";
  style.textContent = LENIS_CSS;
  document.head.appendChild(style);
}

function removeCSS() {
  cssRefCount--;
  if (cssRefCount > 0) return;
  document.getElementById("__lenis-css__")?.remove();
}

export function NextSmoothScroll({
  intensity = 10,
  easing = "default",
  orientation = "vertical",
  wheelMultiplier = 1,
  touchMultiplier = 1,
  smoothTouch = false,
  respectReducedMotion = true,
  disableBelow = 0,
  infinite = false,
  resetScrollOnPageChange = true,
  preventSelectors = "[data-lenis-prevent], [data-scroll-prevent], .overflow-auto, .overflow-y-auto, .overflow-x-auto, pre, code",
  smoothAnchors = true,
  anchorOffset = 80,
  showProgress = false,
  progressColor = "#ffffff",
  progressHeight = 3,
  progressPosition = "top",
  showScrollTop = false,
  scrollTopThreshold = 400,
  scrollTopCorner = "bottom-right",
  scrollTopColor = "#111111",
  scrollTopIconColor = "#FFFFFF",
  scrollTopSize = 44,
  scrollTopOffset = 24,
  scrollTopRadius = 22,
}: NextSmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number>(0);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const thresholdRef = useRef(scrollTopThreshold);
  const anchorOffsetRef = useRef(anchorOffset);
  const lastPastRef = useRef(false);

  const [showTopBtn, setShowTopBtn] = useState(false);
  const [enabledByWidth, setEnabledByWidth] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const useLenis = enabledByWidth && !(respectReducedMotion && reducedMotion);

  useEffect(() => {
    thresholdRef.current = scrollTopThreshold;
  }, [scrollTopThreshold]);

  useEffect(() => {
    anchorOffsetRef.current = anchorOffset;
  }, [anchorOffset]);

  // CSS injection with ref counting
  useEffect(() => {
    if (typeof document === "undefined") return;
    injectCSS();
    return removeCSS;
  }, []);

  // Track viewport width breakpoint
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setEnabledByWidth(!disableBelow || window.innerWidth >= disableBelow);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [disableBelow]);

  // Track prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Initialize Lenis engine & progress tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOverlays = (progress: number, position: number) => {
      const clamped = Math.min(1, Math.max(0, progress || 0));
      if (progressFillRef.current) {
        progressFillRef.current.style.transform = `scaleX(${clamped})`;
      }
      const past = position > thresholdRef.current;
      if (past !== lastPastRef.current) {
        lastPastRef.current = past;
        setShowTopBtn(past);
      }
    };

    const selectors = (preventSelectors || "").trim();
    const preventInside = (node: any) => {
      if (!selectors || !node || typeof node.matches !== "function") return false;
      try {
        return node.matches(selectors) || !!node.closest(selectors);
      } catch {
        return false;
      }
    };

    if (useLenis) {
      const duration = Math.max(0.1, (intensity ?? 10) / 10);
      const easingFn = EASINGS[easing] || EASINGS.default;

      const lenis = new Lenis({
        duration,
        easing: easingFn,
        orientation,
        gestureOrientation: orientation,
        smoothWheel: true,
        syncTouch: smoothTouch,
        wheelMultiplier: wheelMultiplier ?? 1,
        touchMultiplier: touchMultiplier ?? 1,
        infinite,
        prevent: preventInside,
      });

      lenisRef.current = lenis;
      (window as any).lenisInstance = lenis;

      const onScroll = (e: any) => {
        const progress = typeof e?.progress === "number" ? e.progress : 0;
        const position = e?.animatedScroll ?? e?.scroll ?? window.scrollY ?? 0;
        updateOverlays(progress, position);
      };

      lenis.on("scroll", onScroll);

      const raf = (time: number) => {
        if (lenisRef.current) {
          lenisRef.current.raf(time);
          rafRef.current = requestAnimationFrame(raf);
        }
      };
      rafRef.current = requestAnimationFrame(raf);

      updateOverlays(lenis.progress ?? 0, lenis.animatedScroll ?? window.scrollY ?? 0);

      return () => {
        lenis.off("scroll", onScroll);
        cancelAnimationFrame(rafRef.current);
        lenis.destroy();
        lenisRef.current = null;
        (window as any).lenisInstance = null;
      };
    }

    // Native fallback
    const computeNative = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const position = window.scrollY || doc.scrollTop || 0;
      updateOverlays(max > 0 ? position / max : 0, position);
    };

    computeNative();
    window.addEventListener("scroll", computeNative, { passive: true });
    window.addEventListener("resize", computeNative);
    return () => {
      window.removeEventListener("scroll", computeNative);
      window.removeEventListener("resize", computeNative);
    };
  }, [
    useLenis,
    intensity,
    easing,
    orientation,
    smoothTouch,
    wheelMultiplier,
    touchMultiplier,
    infinite,
    preventSelectors,
  ]);

  // Reset scroll on client-side route changes
  useEffect(() => {
    if (typeof window === "undefined" || !resetScrollOnPageChange) return;

    let currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const forceScrollToTop = () => {
      requestAnimationFrame(() => {
        if (lenisRef.current) {
          lenisRef.current.scrollTo(0, { immediate: true });
        } else {
          window.scrollTo(0, 0);
        }
      });
    };

    const handleRouteChange = () => {
      const nextRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentRoute === nextRoute) return;
      currentRoute = nextRoute;
      forceScrollToTop();
    };

    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("hashchange", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("hashchange", handleRouteChange);
    };
  }, [resetScrollOnPageChange]);

  // Pause smooth scroll when a modal or dialog locks scroll with overflow: hidden
  useEffect(() => {
    if (typeof document === "undefined") return;

    const check = () => {
      if (!lenisRef.current) return;
      const htmlHidden = document.documentElement?.style?.overflow === "hidden";
      const bodyHidden = document.body?.style?.overflow === "hidden";
      if (htmlHidden || bodyHidden) {
        lenisRef.current.stop();
      } else {
        lenisRef.current.start();
      }
    };

    check();
    const obs = new MutationObserver(check);
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach((el) => obs.observe(el, { attributes: true, attributeFilter: ["style", "class"] }));

    return () => obs.disconnect();
  }, [useLenis]);

  // Smooth anchor links (#hash) navigation
  useEffect(() => {
    if (typeof document === "undefined" || !smoothAnchors) return;

    const onClick = (e: MouseEvent) => {
      const lenis = lenisRef.current;
      if (!lenis) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("data-lenis-prevent")) return;

      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }

      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        url.search !== window.location.search ||
        !url.hash
      ) {
        return;
      }

      let el: HTMLElement | null = null;
      try {
        el = document.querySelector(decodeURIComponent(url.hash));
      } catch {
        el = null;
      }
      if (!el) return;

      const margin = parseInt(window.getComputedStyle(el).scrollMarginTop) || 0;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -(margin + (anchorOffsetRef.current || 0)) });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [smoothAnchors]);

  const handleScrollTop = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0);
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getCornerStyle = () => {
    switch (scrollTopCorner) {
      case "bottom-left":
        return { left: scrollTopOffset, bottom: scrollTopOffset };
      case "bottom-center":
        return { left: "50%", bottom: scrollTopOffset, transform: "translateX(-50%)" };
      case "bottom-right":
      default:
        return { right: scrollTopOffset, bottom: scrollTopOffset };
    }
  };

  return (
    <>
      {showProgress && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            ...(progressPosition === "bottom" ? { bottom: 0 } : { top: 0 }),
            height: progressHeight,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          <div
            ref={progressFillRef}
            style={{
              width: "100%",
              height: "100%",
              background: progressColor,
              transformOrigin: "0 50%",
              transform: "scaleX(0)",
              transition: "transform 0.08s linear",
            }}
          />
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          aria-label="Scroll to top"
          onClick={handleScrollTop}
          style={{
            position: "fixed",
            ...getCornerStyle(),
            width: scrollTopSize,
            height: scrollTopSize,
            borderRadius: scrollTopRadius,
            background: scrollTopColor,
            color: scrollTopIconColor,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            opacity: showTopBtn ? 1 : 0,
            transform: showTopBtn ? "translateY(0)" : "translateY(12px)",
            transition: "opacity .25s ease, transform .25s ease",
            pointerEvents: showTopBtn ? "auto" : "none",
            zIndex: 9998,
            padding: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      )}
    </>
  );
}

export default NextSmoothScroll;
