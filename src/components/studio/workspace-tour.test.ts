import { describe, it, expect, beforeEach } from "vitest";
import {
  WORKSPACE_TOUR_STORAGE_KEY,
  buildWorkspaceTourSteps,
  computeTourPopoverPosition,
  hasCompletedWorkspaceTour,
  markWorkspaceTourCompleted,
  resetWorkspaceTour,
} from "./workspace-tour-config";

const FORBIDDEN_BUZZWORDS = [
  "ai powered",
  "ai-powered",
  "seamless",
  "revolutionary",
  "cutting edge",
  "cutting-edge",
  "unlock",
  "elevate",
  "effortless",
  "next generation",
  "next-generation",
];

describe("workspace-tour-config", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          },
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it("builds 6 ordered steps targeting real studio regions with clean antislop copy", () => {
    const steps = buildWorkspaceTourSteps("facebook/react");
    expect(steps).toHaveLength(6);
    expect(steps[0].id).toBe("welcome");
    expect(steps[0].title).toContain("facebook/react");
    expect(steps[0].targetSelector).toBeNull();

    const selectors = steps.slice(1).map((s) => s.targetSelector);
    expect(selectors).toEqual([
      '[data-tour="studio-tabs"]',
      '[data-tour="studio-explorer"]',
      '[data-tour="studio-canvas"]',
      '[data-tour="studio-copilot"]',
      '[data-tour="studio-footer"]',
    ]);

    for (const step of steps) {
      const combined = `${step.sectionLabel} ${step.title} ${step.description} ${step.shortcutHint ?? ""}`;
      expect(combined).not.toContain("—");
      expect(combined).not.toContain("--");
      const lower = combined.toLowerCase();
      for (const word of FORBIDDEN_BUZZWORDS) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it("falls back to a neutral repository label when repoLabel is empty", () => {
    const steps = buildWorkspaceTourSteps("   ");
    expect(steps[0].title).toBe("Indexed this repository");
  });

  it("persists and resets completion state safely in localStorage", () => {
    expect(hasCompletedWorkspaceTour()).toBe(false);
    markWorkspaceTourCompleted();
    expect(window.localStorage.getItem(WORKSPACE_TOUR_STORAGE_KEY)).toBe("done");
    expect(hasCompletedWorkspaceTour()).toBe(true);
    resetWorkspaceTour();
    expect(hasCompletedWorkspaceTour()).toBe(false);
  });

  it("centers the popover when targetRect is null or placement is center", () => {
    const pos = computeTourPopoverPosition(
      null,
      { width: 368, height: 240 },
      { width: 1280, height: 800 },
      "center",
    );
    expect(pos.placement).toBe("center");
    expect(pos.left).toBe(456);
    expect(pos.top).toBe(280);
  });

  it("places below topbar tabs and flips above footer strip cleanly", () => {
    const belowTopbar = computeTourPopoverPosition(
      { left: 420, top: 8, width: 440, height: 40 },
      { width: 368, height: 220 },
      { width: 1280, height: 800 },
      "bottom",
    );
    expect(belowTopbar.placement).toBe("bottom");
    expect(belowTopbar.top).toBe(64);
    expect(belowTopbar.left).toBeGreaterThanOrEqual(16);
    expect(belowTopbar.left + 368).toBeLessThanOrEqual(1280 - 16);

    const aboveFooter = computeTourPopoverPosition(
      { left: 0, top: 768, width: 1280, height: 32 },
      { width: 368, height: 220 },
      { width: 1280, height: 800 },
      "top",
    );
    expect(aboveFooter.placement).toBe("top");
    expect(aboveFooter.top).toBe(768 - 220 - 16);
  });

  it("clamps cleanly on mobile viewports without horizontal or vertical overflow", () => {
    const mobileViewport = { width: 375, height: 667 };
    const popover = { width: 343, height: 240 };

    const nearTop = computeTourPopoverPosition(
      { left: 10, top: 10, width: 355, height: 50 },
      popover,
      mobileViewport,
      "bottom",
    );
    expect(nearTop.left).toBeGreaterThanOrEqual(16);
    expect(nearTop.left + popover.width).toBeLessThanOrEqual(mobileViewport.width - 16);
    expect(nearTop.top + popover.height).toBeLessThanOrEqual(mobileViewport.height - 16);

    const nearBottom = computeTourPopoverPosition(
      { left: 0, top: 630, width: 375, height: 37 },
      popover,
      mobileViewport,
      "top",
    );
    expect(nearBottom.placement).toBe("top");
    expect(nearBottom.top).toBe(16);
  });
});
