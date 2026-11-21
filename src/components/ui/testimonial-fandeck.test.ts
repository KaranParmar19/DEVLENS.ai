import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMPARISON_CARDS,
  calculateFandeckOverlap,
} from "./testimonial-fandeck";

describe("TestimonialFanDeck data & calculations", () => {
  it("provides 5 complete comparison cards covering key AST capabilities", () => {
    expect(DEFAULT_COMPARISON_CARDS).toHaveLength(5);

    const categories = DEFAULT_COMPARISON_CARDS.map((c) => c.category);
    expect(categories).toContain("01 / CALL GRAPH");
    expect(categories).toContain("02 / BLAST RADIUS");
    expect(categories).toContain("03 / CITATIONS");
    expect(categories).toContain("04 / ONBOARDING");
    expect(categories).toContain("05 / ISOLATION");
  });

  it("ensures each card defines verified headlines, descriptions, and status", () => {
    DEFAULT_COMPARISON_CARDS.forEach((card) => {
      expect(card.id).toBeDefined();
      expect(card.category).toBeDefined();
      expect(card.badge).toBeDefined();
      expect(card.headline).toBeDefined();
      expect(card.description).toBeDefined();
      expect(card.footerTag).toBeDefined();
      expect(card.status).toBeDefined();
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
    const overlap = calculateFandeckOverlap(5, 285, 46, 1400, false);
    expect(overlap).toBe(46);
  });

  it("increases overlap responsively when container width is constrained", () => {
    const overlap = calculateFandeckOverlap(5, 285, 46, 900, false);
    expect(overlap).toBeGreaterThan(46);
  });

  it("preserves natural spacing on mobile mode", () => {
    const overlap = calculateFandeckOverlap(5, 285, 46, 375, true);
    expect(overlap).toBe(46);
  });
});
