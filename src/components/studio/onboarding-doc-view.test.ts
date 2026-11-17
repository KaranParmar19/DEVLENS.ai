import { describe, it, expect } from "vitest";
import {
  extractHeadings,
  extractHeroSplit,
  buildClientMermaidFallback,
} from "./onboarding-doc-view";

describe("Code Wiki OnboardingDocView helpers", () => {
  const sampleWiki = `# acme/sdk: Onboarding Guide

## 1. Project Overview & Architecture
\`\`\`mermaid
graph TD
    Client --> Transports
    Transports --> Server
\`\`\`

The SDK separates client session management from server request dispatch.

- Supports stdio and Streamable HTTP transports.
- Validates payloads against typed schemas.

## 2. How It Works
Calls enter via \`ClientSession\` in [[src/client.py]].

### Client-Side Development
Clients manage OAuth2 refresh and caching in [[src/client.py]].

## 3. Quick Start
- Install: \`pip install -e .\`
`;

  it("extracts headings cleanly while ignoring headings inside code fences", () => {
    const withFence = `${sampleWiki}\n\`\`\`bash\n## not-a-heading\n\`\`\`\n`;
    const headings = extractHeadings(withFence);
    expect(headings.map((h) => h.title)).toEqual([
      "1. Project Overview & Architecture",
      "2. How It Works",
      "Client-Side Development",
      "3. Quick Start",
    ]);
    expect(headings.map((h) => h.level)).toEqual([2, 2, 3, 2]);
  });

  it("extracts Hero Split mermaid diagram and narrative prose cleanly", () => {
    const hero = extractHeroSplit(sampleWiki);
    expect(hero).not.toBeNull();
    expect(hero?.headingTitle).toBe("1. Project Overview & Architecture");
    expect(hero?.mermaidCode).toContain("Client --> Transports");
    expect(hero?.proseMarkdown).toContain("The SDK separates client session management");
    expect(hero?.proseMarkdown).toContain("- Supports stdio and Streamable HTTP transports.");
    expect(hero?.restMarkdown.trimStart().startsWith("## 2. How It Works")).toBe(true);
  });

  it("returns null for Hero Split when Section 1 has no mermaid diagram", () => {
    const noDiagram = `# acme/plain\n\n## 1. Overview\nJust prose here.\n\n## 2. Quick Start\nRun tests.`;
    expect(extractHeroSplit(noDiagram)).toBeNull();
  });

  it("builds client-side fallback mermaid diagram when graphData has nodes and edges", () => {
    const fallback = buildClientMermaidFallback({
      nodes: [
        { id: "1", label: "App.tsx", path: "src/App.tsx" },
        { id: "2", label: "client.ts", path: "src/client.ts" },
      ],
      edges: [["1", "2"]],
    });
    expect(fallback).not.toBeNull();
    expect(fallback).toContain("graph TD");
    expect(fallback).toContain("App.tsx");
    expect(fallback).toContain("-->|\"imports\"|");
  });

  it("returns null fallback diagram when graphData is null or empty", () => {
    expect(buildClientMermaidFallback(null)).toBeNull();
    expect(buildClientMermaidFallback({ nodes: [], edges: [] })).toBeNull();
  });
});
