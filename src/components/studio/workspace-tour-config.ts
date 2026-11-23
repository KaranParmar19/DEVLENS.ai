import type { StudioTab } from "./studio-types";

export const WORKSPACE_TOUR_STORAGE_KEY = "devlens-studio-tour-v1";

export type TourPlacement = "bottom" | "top" | "left" | "right" | "center";

export interface TourStepStateSync {
  tab?: StudioTab;
  expandExplorer?: boolean;
  expandCopilot?: boolean;
}

export interface WorkspaceTourStep {
  id: string;
  targetSelector: string | null;
  sectionLabel: string;
  title: string;
  description: string;
  shortcutHint?: string;
  preferredPlacement: TourPlacement;
  ensureState?: TourStepStateSync;
}

export interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ComputedPopoverPosition {
  left: number;
  top: number;
  placement: TourPlacement;
}

export function buildWorkspaceTourSteps(repoLabel: string): WorkspaceTourStep[] {
  const cleanRepo = repoLabel.trim() || "this repository";

  return [
    {
      id: "welcome",
      targetSelector: null,
      sectionLabel: "Workspace Ready",
      title: `Indexed ${cleanRepo}`,
      description:
        "DevLens built the dependency graph, file tree, and code index for this repository. Take a quick six-step walkthrough of each panel, or skip straight to the code.",
      preferredPlacement: "center",
      ensureState: { tab: "architecture" },
    },
    {
      id: "views",
      targetSelector: '[data-tour="studio-tabs"]',
      sectionLabel: "View Switcher",
      title: "Switch between four analysis views",
      description:
        "Move between Architecture, Code Flow, Drift Timeline, and Onboarding Doc from this bar. Your active file selection stays synced across every view.",
      preferredPlacement: "bottom",
      ensureState: { tab: "architecture" },
    },
    {
      id: "explorer",
      targetSelector: '[data-tour="studio-explorer"]',
      sectionLabel: "Explorer Rail",
      title: "Filter files, modules, and entry points",
      description:
        "Search the file tree or switch to Entry to locate main application entry points. Selecting any file focuses its node on the graph and shows its dependents.",
      preferredPlacement: "right",
      ensureState: { expandExplorer: true },
    },
    {
      id: "canvas",
      targetSelector: '[data-tour="studio-canvas"]',
      sectionLabel: "Architecture Stage",
      title: "Inspect dependencies and blast radius",
      description:
        "Pan and zoom the module graph to check how files import one another. Click a node to inspect its source code drawer and see which files break if you edit it.",
      preferredPlacement: "left",
      ensureState: { tab: "architecture" },
    },
    {
      id: "copilot",
      targetSelector: '[data-tour="studio-copilot"]',
      sectionLabel: "Copilot Rail",
      title: "Ask questions grounded in exact lines",
      description:
        "Type @ to target a specific file, or run commands such as /blast, /cycles, and /explain. Every cited file path opens directly inside the workspace.",
      shortcutHint: "Shortcut: Ctrl+J (Cmd+J on macOS) focuses this input from any view.",
      preferredPlacement: "left",
      ensureState: { expandCopilot: true },
    },
    {
      id: "telemetry",
      targetSelector: '[data-tour="studio-footer"]',
      sectionLabel: "Health Strip",
      title: "Check cycles, fan-out, and exports",
      description:
        "This footer reports detected dependency cycles, maximum fan-out, average McCabe complexity, and total indexed modules. Use Export in the top bar anytime for Mermaid, PlantUML, or JSON.",
      preferredPlacement: "top",
    },
  ];
}

export function hasCompletedWorkspaceTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WORKSPACE_TOUR_STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

export function markWorkspaceTourCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_TOUR_STORAGE_KEY, "done");
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function resetWorkspaceTour(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKSPACE_TOUR_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes a viewport-clamped position for the floating tour card relative to
 * the highlighted element. Automatically flips sides if the preferred placement
 * overflows, and docks cleanly on narrow mobile viewports.
 */
export function computeTourPopoverPosition(
  targetRect: TourRect | null,
  popoverSize: PopoverSize,
  viewport: ViewportSize,
  preferredPlacement: TourPlacement,
): ComputedPopoverPosition {
  const margin = 16;
  const gap = 16;
  const maxLeft = Math.max(margin, viewport.width - popoverSize.width - margin);
  const maxTop = Math.max(margin, viewport.height - popoverSize.height - margin);

  // Centered modal fallback (welcome step or missing target)
  if (!targetRect || preferredPlacement === "center") {
    return {
      left: clamp(Math.round((viewport.width - popoverSize.width) / 2), margin, maxLeft),
      top: clamp(Math.round((viewport.height - popoverSize.height) / 2), margin, maxTop),
      placement: "center",
    };
  }

  // On narrow mobile viewports, dock top or bottom away from the highlighted region
  if (viewport.width < 640) {
    const targetMidY = targetRect.top + targetRect.height / 2;
    const placeTop = targetMidY > viewport.height * 0.55;
    const mobileLeft = clamp(Math.round((viewport.width - popoverSize.width) / 2), margin, maxLeft);
    const mobileTop = placeTop
      ? margin
      : clamp(viewport.height - popoverSize.height - margin, margin, maxTop);
    return {
      left: mobileLeft,
      top: mobileTop,
      placement: placeTop ? "top" : "bottom",
    };
  }

  const targetRight = targetRect.left + targetRect.width;
  const targetBottom = targetRect.top + targetRect.height;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const spaces: Record<Exclude<TourPlacement, "center">, number> = {
    bottom: viewport.height - targetBottom - margin,
    top: targetRect.top - margin,
    right: viewport.width - targetRight - margin,
    left: targetRect.left - margin,
  };

  const opposite: Record<Exclude<TourPlacement, "center">, Exclude<TourPlacement, "center">> = {
    bottom: "top",
    top: "bottom",
    left: "right",
    right: "left",
  };

  const fits = (side: Exclude<TourPlacement, "center">): boolean => {
    if (side === "top" || side === "bottom") {
      return spaces[side] >= popoverSize.height + gap;
    }
    return spaces[side] >= popoverSize.width + gap;
  };

  const candidateOrder: Array<Exclude<TourPlacement, "center">> = [
    preferredPlacement,
    opposite[preferredPlacement],
    "bottom",
    "top",
    "right",
    "left",
  ];

  let chosen: TourPlacement = "center";
  for (const side of candidateOrder) {
    if (fits(side)) {
      chosen = side;
      break;
    }
  }

  if (chosen === "center") {
    // Target fills almost the whole stage (e.g. Architecture Canvas): anchor cleanly inside bottom-left or top-right
    return {
      left: clamp(Math.round(targetRect.left + 24), margin, maxLeft),
      top: clamp(Math.round(targetBottom - popoverSize.height - 24), margin, maxTop),
      placement: "center",
    };
  }

  if (chosen === "bottom") {
    return {
      left: clamp(Math.round(targetCenterX - popoverSize.width / 2), margin, maxLeft),
      top: clamp(Math.round(targetBottom + gap), margin, maxTop),
      placement: "bottom",
    };
  }

  if (chosen === "top") {
    return {
      left: clamp(Math.round(targetCenterX - popoverSize.width / 2), margin, maxLeft),
      top: clamp(Math.round(targetRect.top - popoverSize.height - gap), margin, maxTop),
      placement: "top",
    };
  }

  if (chosen === "right") {
    return {
      left: clamp(Math.round(targetRight + gap), margin, maxLeft),
      top: clamp(Math.round(targetCenterY - popoverSize.height / 2), margin, maxTop),
      placement: "right",
    };
  }

  // chosen === "left"
  return {
    left: clamp(Math.round(targetRect.left - popoverSize.width - gap), margin, maxLeft),
    top: clamp(Math.round(targetCenterY - popoverSize.height / 2), margin, maxTop),
    placement: "left",
  };
}
