import { describe, it, expect } from "vitest";
import { generateMermaidDiagram, generatePlantUmlDiagram, generateJsonExport } from "./export-utils";

describe("studio export utilities", () => {
  const sampleEdges: [string, string][] = [
    ["src/main.ts", "src/router.ts"],
    ["src/router.ts", "src/controllers/auth.ts"],
    ["src/controllers/auth.ts", "src/models/user.ts"],
  ];

  it("generates clean Mermaid TD graph syntax", () => {
    const mermaid = generateMermaidDiagram(sampleEdges);
    expect(mermaid).toContain("graph TD");
    expect(mermaid).toContain("src_main_ts --> src_router_ts");
    expect(mermaid).toContain("src_controllers_auth_ts --> src_models_user_ts");
  });

  it("caps Mermaid edges to avoid oversized unreadable diagrams", () => {
    const manyEdges: [string, string][] = Array.from({ length: 120 }, (_, i) => [
      `node_${i}`,
      `node_${i + 1}`,
    ]);
    const mermaid = generateMermaidDiagram(manyEdges, 50);
    const lines = mermaid.split("\n");
    // 1 header line + 50 edge lines
    expect(lines.length).toBe(51);
  });

  it("generates valid PlantUML diagram text", () => {
    const puml = generatePlantUmlDiagram(sampleEdges, "DevLens");
    expect(puml).toContain("@startuml");
    expect(puml).toContain("title DevLens Architecture");
    expect(puml).toContain("[main.ts] --> [router.ts]");
    expect(puml).toContain("[auth.ts] --> [user.ts]");
    expect(puml).toContain("@enduml");
  });

  it("formats JSON export cleanly with indentation", () => {
    const data = { nodes: [{ id: "n1" }], edges: [["n1", "n2"]] };
    const json = generateJsonExport(data);
    expect(json).toBe(JSON.stringify(data, null, 2));
  });
});
