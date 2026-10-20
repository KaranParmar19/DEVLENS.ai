import { describe, it, expect } from "vitest";
import { normalizeRepoUrl } from "./utils";

describe("normalizeRepoUrl", () => {
  it("normalizes bare owner/repo", () => {
    expect(normalizeRepoUrl("bottlepy/bottle")).toBe("https://github.com/bottlepy/bottle");
  });

  it("normalizes github.com/owner/repo", () => {
    expect(normalizeRepoUrl("github.com/bottlepy/bottle")).toBe("https://github.com/bottlepy/bottle");
  });

  it("normalizes www.github.com/owner/repo", () => {
    expect(normalizeRepoUrl("www.github.com/bottlepy/bottle")).toBe("https://github.com/bottlepy/bottle");
  });

  it("handles full https:// URL with trailing slash", () => {
    expect(normalizeRepoUrl("https://github.com/bottlepy/bottle/")).toBe("https://github.com/bottlepy/bottle");
  });

  it("strips .git extension", () => {
    expect(normalizeRepoUrl("https://github.com/bottlepy/bottle.git")).toBe("https://github.com/bottlepy/bottle");
  });

  it("normalizes SSH format", () => {
    expect(normalizeRepoUrl("git@github.com:bottlepy/bottle.git")).toBe("https://github.com/bottlepy/bottle");
  });

  it("recovers from nested github.com prefixes", () => {
    expect(normalizeRepoUrl("https://github.com/github.com/bottlepy/bottle")).toBe("https://github.com/bottlepy/bottle");
    expect(normalizeRepoUrl("github.com/github.com/bottlepy/bottle")).toBe("https://github.com/bottlepy/bottle");
  });

  it("returns empty string for empty inputs", () => {
    expect(normalizeRepoUrl("")).toBe("");
    expect(normalizeRepoUrl(null)).toBe("");
    expect(normalizeRepoUrl(undefined)).toBe("");
    expect(normalizeRepoUrl("   ")).toBe("");
  });
});
