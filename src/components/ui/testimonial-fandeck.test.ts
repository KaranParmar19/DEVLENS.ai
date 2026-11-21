import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMPARISON_CARDS,
  calculateFandeckOverlap,
} from "./testimonial-fandeck";

describe("TestimonialFanDeck data & calculations", () => {
  it("provides 5 complete comparison cards covering key AST capabilities", () => {
    expect(DEFAULT_COMPARISON_CARDS).toHaveLength(5);

    const tasks = DEFAULT_COMPARISON_CARDS.map((c) => c.task);
    expect(tasks).toContain("Cross-file call hierarchy");
    expect(tasks).toContain("Commit impact check");
    expect(tasks).toContain("Source code citations");
    expect(tasks).toContain("New engineer onboarding");
    expect(tasks).toContain("Code privacy & memory");
  });

  it("ensures each card defines verified AST advantages and failure modes", () => {
    DEFAULT_COMPARISON_CARDS.forEach((card) => {
      expect(card.category).toBeDefined();
      expect(card.task).toBeDefined();
      expect(card.grepFlaw).toBeDefined();
      expect(card.llmFlaw).toBeDefined();
      expect(card.devlensAdvantage).toBeDefined();
      expect(card.badge).toBeDefined();
      expect(typeof card.rotation).toBe("number");
    });
  });

  it("calculates symmetrical rotation angles centered around 0 degrees", () => {
    const rotations = DEFAULT_COMPARISON_CARDS.map((c) => c.rotation);
    expect(rotations).toEqual([-7, -3.5, 0, 3.5, 7]);
    // Center card must be flat at 0 deg
    expect(rotations[2]).toBe(0);
  });

  it("computes default overlap when container has ample width", () => {
    const overlap = calculateFandeckOverlap(5, 280, 48, 1400, false);
    expect(overlap).toBe(48);
  });

  it("increases overlap responsively when container width is constrained", () => {
    // 5 cards of 280px = 1400px. With 48px overlap, width is 1400 - 192 = 1208px.
    // If container is 900px, max allowed width is 860px.
    // Needed overlap increases to pack cards nicely without overflow.
    const overlap = calculateFandeckOverlap(5, 280, 48, 900, false);
    expect(overlap).toBeGreaterThan(48);
  });

  it("preserves natural spacing on mobile mode", () => {
    const overlap = calculateFandeckOverlap(5, 280, 48, 375, true);
    expect(overlap).toBe(48);
  });
});
