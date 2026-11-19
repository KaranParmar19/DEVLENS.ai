import { describe, it, expect } from "vitest";

describe("GitHubAuthGate logic and repo parsing", () => {
  function parseCleanRepo(repoUrl: string) {
    const cleanRepo = repoUrl
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/, "");

    const parts = cleanRepo.split("/");
    if (parts.length >= 2) {
      return { owner: parts[0], repoName: parts.slice(1).join("/"), cleanRepo };
    }
    return { owner: "github", repoName: cleanRepo || "repository", cleanRepo };
  }

  it("correctly parses standard GitHub URL", () => {
    const result = parseCleanRepo("https://github.com/vercel/next.js");
    expect(result.owner).toBe("vercel");
    expect(result.repoName).toBe("next.js");
    expect(result.cleanRepo).toBe("vercel/next.js");
  });

  it("correctly parses repo URL with .git extension and trailing slash", () => {
    const result = parseCleanRepo("https://github.com/facebook/react.git/");
    expect(result.owner).toBe("facebook");
    expect(result.repoName).toBe("react");
    expect(result.cleanRepo).toBe("facebook/react");
  });

  it("handles shorthand repo identifiers", () => {
    const result = parseCleanRepo("fastapi/fastapi");
    expect(result.owner).toBe("fastapi");
    expect(result.repoName).toBe("fastapi");
    expect(result.cleanRepo).toBe("fastapi/fastapi");
  });

  it("handles deep or nested repo paths", () => {
    const result = parseCleanRepo("https://github.com/tailwindlabs/tailwindcss/tree/main");
    expect(result.owner).toBe("tailwindlabs");
    expect(result.repoName).toBe("tailwindcss/tree/main");
  });
});
