import { describe, it, expect } from "vitest";
import {
  extractHeadings,
  extractHeroSplit,
  buildClientMermaidFallback,
  parseBracketCitation,
  hasMermaidEdges,
  stripRawHtmlTags,
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

  it("filters out dotfiles and config noise and builds connected subgraphs for multi-package repos", () => {
    const fallback = buildClientMermaidFallback({
      nodes: [
        { id: ".gitignore", label: ".gitignore", path: ".gitignore" },
        { id: "README.md", label: "README.md", path: "README.md" },
        { id: ".dockerignore", label: ".dockerignore", path: ".dockerignore" },
        { id: "Dockerfile", label: "Dockerfile", path: "Dockerfile" },
        { id: "package.json", label: "package.json", path: "package.json" },
        { id: "collector/src/index.js", label: "index.js", path: "collector/src/index.js", is_entry: true },
        { id: "collector/src/routes/ingest.js", label: "ingest.js", path: "collector/src/routes/ingest.js" },
        { id: "dashboard/src/app/demo/page.jsx", label: "page.jsx", path: "dashboard/src/app/demo/page.jsx", is_entry: true },
        { id: "dashboard/src/app/projects/page.jsx", label: "page.jsx", path: "dashboard/src/app/projects/page.jsx" },
        { id: "dashboard/src/components/EndpointsTable.jsx", label: "EndpointsTable.jsx", path: "dashboard/src/components/EndpointsTable.jsx" },
      ],
      edges: [
        ["collector/src/index.js", "collector/src/routes/ingest.js"],
        ["dashboard/src/app/demo/page.jsx", "dashboard/src/components/EndpointsTable.jsx"],
        ["dashboard/src/app/projects/page.jsx", "dashboard/src/components/EndpointsTable.jsx"],
      ],
    });

    expect(fallback).not.toBeNull();
    expect(fallback).not.toContain(".gitignore");
    expect(fallback).not.toContain("README.md");
    expect(fallback).not.toContain("Dockerfile");
    expect(fallback).toContain('subgraph SG_0["collector/"]');
    expect(fallback).toContain('subgraph SG_1["dashboard/"]');
    expect(fallback).toContain("demo/page.jsx");
    expect(fallback).toContain("projects/page.jsx");
    expect(hasMermaidEdges(fallback!)).toBe(true);
  });

  it("parses bare, backtick-wrapped, line-range, and dynamic-route bracket citations cleanly", () => {
    expect(parseBracketCitation("[[collector/src/index.js]]")).toEqual({
      filePath: "collector/src/index.js",
      lineRange: undefined,
      displayLabel: "collector/src/index.js",
    });

    expect(parseBracketCitation("`[[collector/src/seed.js]]`")).toEqual({
      filePath: "collector/src/seed.js",
      lineRange: undefined,
      displayLabel: "collector/src/seed.js",
    });

    expect(parseBracketCitation("[[dashboard/src/app/projects/[id]/page.jsx:12-40]]")).toEqual({
      filePath: "dashboard/src/app/projects/[id]/page.jsx",
      lineRange: "12-40",
      displayLabel: "projects/[id]/page.jsx:12-40",
    });

    expect(parseBracketCitation("`npm run dev`")).toBeNull();
  });

  it("strips raw HTML README tags while converting strong/em and preserving inline code", () => {
    expect(stripRawHtmlTags('<h1 align="center">Lantern APM</h1>')).toBe("Lantern APM");
    expect(
      stripRawHtmlTags("<strong>Lightweight, self-hosted APM for Node.js</strong>"),
    ).toBe("**Lightweight, self-hosted APM for Node.js**");
    expect(stripRawHtmlTags("Renders `<div>` via `React.FC<Props>` cleanly.")).toBe(
      "Renders `<div>` via `React.FC<Props>` cleanly.",
    );
  });
});
