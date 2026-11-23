import { useEffect, useMemo, useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import {
  buildWorkspaceTourSteps,
  computeTourPopoverPosition,
  type TourRect,
  type TourStepStateSync,
} from "./workspace-tour-config";

interface WorkspaceTourProps {
  open: boolean;
  repoLabel: string;
  theme: "dark" | "light";
  onSyncStepState: (sync: TourStepStateSync) => void;
  onComplete: () => void;
  onSkip: () => void;
}

const SPOTLIGHT_PADDING = 6;
const DEFAULT_POPOVER_WIDTH = 368;
const DEFAULT_POPOVER_HEIGHT = 246;

export function WorkspaceTour({
  open,
  repoLabel,
  theme,
  onSyncStepState,
  onComplete,
  onSkip,
}: WorkspaceTourProps) {
  const isLight = theme === "light";
  const prefersReducedMotion = useReducedMotion();
  const rawMaskId = useId();
  const maskId = `dx-tour-mask-${rawMaskId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleId = useId();
  const descId = useId();

  const steps = useMemo(() => buildWorkspaceTourSteps(repoLabel), [repoLabel]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1280, height: 800 },
  );
  const [popoverSize, setPopoverSize] = useState({
    width: DEFAULT_POPOVER_WIDTH,
    height: DEFAULT_POPOVER_HEIGHT,
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentStep = steps[stepIndex] ?? steps[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  // Reset step index and capture previous focus when opening
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setStepIndex(0);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus?.();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Synchronize workspace panels/tabs for the active step
  useEffect(() => {
    if (!open || !currentStep?.ensureState) return;
    onSyncStepState(currentStep.ensureState);
  }, [open, currentStep, onSyncStepState]);

  // Measure target element rect and keep it synced across resizes and layout shifts
  const measureTarget = useCallback(() => {
    if (!open) return;

    const nextViewport = { width: window.innerWidth, height: window.innerHeight };
    setViewport(nextViewport);

    if (!currentStep?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector<HTMLElement>(currentStep.targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setTargetRect(null);
      return;
    }

    const paddedLeft = Math.max(4, rect.left - SPOTLIGHT_PADDING);
    const paddedTop = Math.max(4, rect.top - SPOTLIGHT_PADDING);
    const paddedWidth = Math.min(
      nextViewport.width - paddedLeft - 4,
      rect.width + SPOTLIGHT_PADDING * 2,
    );
    const paddedHeight = Math.min(
      nextViewport.height - paddedTop - 4,
      rect.height + SPOTLIGHT_PADDING * 2,
    );

    setTargetRect({
      left: paddedLeft,
      top: paddedTop,
      width: Math.max(0, paddedWidth),
      height: Math.max(0, paddedHeight),
    });
  }, [open, currentStep]);

  useEffect(() => {
    if (!open) return;

    measureTarget();
    const rafId = window.requestAnimationFrame(measureTarget);
    // Re-measure after panel expand/tab transition settles
    const settleTimer = window.setTimeout(measureTarget, 220);

    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && currentStep?.targetSelector) {
      const el = document.querySelector<HTMLElement>(currentStep.targetSelector);
      if (el) {
        resizeObserver = new ResizeObserver(() => measureTarget());
        resizeObserver.observe(el);
      }
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      resizeObserver?.disconnect();
    };
  }, [open, currentStep, measureTarget]);

  // Measure actual rendered popover size for accurate edge clamping
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const node = dialogRef.current;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPopoverSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateSize);
      ro.observe(node);
      return () => ro.disconnect();
    }
    return undefined;
  }, [open, stepIndex]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [isLastStep, onComplete, steps.length]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Move focus into the dialog primary CTA on open/step change
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, stepIndex]);

  // Keyboard navigation + focus trap inside the tour dialog
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onSkip();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.key === "ArrowLeft" && !isFirstStep) {
        e.preventDefault();
        handleBack();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, isFirstStep, handleNext, handleBack, onSkip]);

  const position = useMemo(() => {
    const effectiveWidth = Math.min(popoverSize.width || DEFAULT_POPOVER_WIDTH, viewport.width - 32);
    return computeTourPopoverPosition(
      targetRect,
      { width: effectiveWidth, height: popoverSize.height || DEFAULT_POPOVER_HEIGHT },
      viewport,
      currentStep?.preferredPlacement ?? "center",
    );
  }, [targetRect, popoverSize, viewport, currentStep]);

  const accentColor = isLight ? "#1D4ED8" : "#60A5FA";
  const scrimFill = isLight ? "rgba(9, 9, 11, 0.56)" : "rgba(5, 5, 8, 0.72)";
  const transitionConfig = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <AnimatePresence>
      {open && currentStep && (
        <div
          className="dx-tour-root"
          data-theme={theme}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            pointerEvents: "none",
          }}
        >
          {/* SVG Backdrop Scrim with Spotlight Cutout */}
          <motion.svg
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }}
            width={viewport.width}
            height={viewport.height}
            viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            style={{
              position: "fixed",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "auto",
            }}
          >
            <defs>
              <mask id={maskId}>
                <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="white" />
                {targetRect && (
                  <motion.rect
                    rx={8}
                    ry={8}
                    fill="black"
                    initial={false}
                    animate={{
                      x: targetRect.left,
                      y: targetRect.top,
                      width: targetRect.width,
                      height: targetRect.height,
                    }}
                    transition={transitionConfig}
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width={viewport.width}
              height={viewport.height}
              fill={scrimFill}
              mask={`url(#${maskId})`}
            />
          </motion.svg>

          {/* Crisp Perimeter Highlight Ring Around Target */}
          {targetRect && (
            <motion.div
              aria-hidden="true"
              initial={false}
              animate={{
                left: targetRect.left,
                top: targetRect.top,
                width: targetRect.width,
                height: targetRect.height,
                opacity: 1,
              }}
              exit={{ opacity: 0 }}
              transition={transitionConfig}
              style={{
                position: "fixed",
                borderRadius: 8,
                border: `2px solid ${accentColor}`,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Accessible Walkthrough Card */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="dx-tour-card"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              left: position.left,
              top: position.top,
            }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={transitionConfig}
            style={{
              position: "fixed",
              width: "min(368px, calc(100vw - 32px))",
              backgroundColor: isLight ? "#FFFFFF" : "#111114",
              color: isLight ? "#09090B" : "#F4F4F5",
              border: `1px solid ${isLight ? "#71717A" : "#6B6B76"}`,
              borderRadius: 12,
              boxShadow: isLight
                ? "0 20px 48px rgba(9, 9, 11, 0.22)"
                : "0 24px 56px rgba(0, 0, 0, 0.72)",
              padding: "18px 20px 16px",
              fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              pointerEvents: "auto",
              zIndex: 125,
            }}
          >
            {/* Header Row: Step Index + Section Label + Close Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  lineHeight: 1.2,
                }}
              >
                <span style={{ color: accentColor, fontWeight: 600 }}>
                  {String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  style={{ color: isLight ? "#52525B" : "#94949E" }}
                >
                  /
                </span>
                <span style={{ color: isLight ? "#52525B" : "#94949E" }}>
                  {currentStep.sectionLabel}
                </span>
              </div>

              <button
                type="button"
                className="dx-tour-icon-btn"
                onClick={onSkip}
                aria-label="Close workspace tour"
                title="Close tour (Esc)"
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* Step Progress Track */}
            <div
              role="group"
              aria-label="Tour step progress"
              style={{
                display: "flex",
                gap: 5,
                marginBottom: 14,
              }}
            >
              {steps.map((step, idx) => {
                const isCurrent = idx === stepIndex;
                const isPast = idx < stepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className="dx-tour-step-segment"
                    onClick={() => setStepIndex(idx)}
                    aria-label={`Go to step ${idx + 1}: ${step.sectionLabel}`}
                    aria-current={isCurrent ? "step" : undefined}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: "100%",
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: isCurrent
                          ? accentColor
                          : isPast
                          ? isLight
                            ? "#09090B"
                            : "#F4F4F5"
                          : isLight
                          ? "#D4D4D8"
                          : "#2E2E36",
                        transition: prefersReducedMotion ? "none" : "background-color 0.2s ease",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Title & Description */}
            <h2
              id={titleId}
              style={{
                margin: "0 0 8px",
                fontSize: "1.0625rem",
                lineHeight: 1.35,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: isLight ? "#09090B" : "#F4F4F5",
              }}
            >
              {currentStep.title}
            </h2>

            <p
              id={descId}
              style={{
                margin: 0,
                fontSize: "0.875rem",
                lineHeight: 1.55,
                color: isLight ? "#3F3F46" : "#B4B4BC",
              }}
            >
              {currentStep.description}
            </p>

            {currentStep.shortcutHint && (
              <p
                style={{
                  margin: "10px 0 0",
                  paddingTop: 10,
                  borderTop: `1px solid ${isLight ? "#E4E4E7" : "#27272E"}`,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  lineHeight: 1.45,
                  color: isLight ? "#52525B" : "#94949E",
                }}
              >
                {currentStep.shortcutHint}
              </p>
            )}

            {/* Screen-reader live announcement */}
            <div className="sr-only" aria-live="polite">
              Step {stepIndex + 1} of {steps.length}: {currentStep.title}
            </div>

            {/* Footer Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 18,
                paddingTop: 14,
                borderTop: `1px solid ${isLight ? "#E4E4E7" : "#27272E"}`,
              }}
            >
              <button
                type="button"
                className="dx-tour-btn-ghost"
                onClick={onSkip}
              >
                Skip tour
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!isFirstStep && (
                  <button
                    type="button"
                    className="dx-tour-btn-secondary"
                    onClick={handleBack}
                  >
                    Back
                  </button>
                )}

                <button
                  ref={primaryButtonRef}
                  type="button"
                  className="dx-tour-btn-primary"
                  onClick={handleNext}
                >
                  {isFirstStep ? "Start walkthrough" : isLastStep ? "Finish tour" : "Next step"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
