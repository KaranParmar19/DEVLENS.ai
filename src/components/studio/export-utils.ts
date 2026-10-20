/**
 * DevLens AI — Studio Diagram & Graph Export Helpers
 */

export function generateMermaidDiagram(edges: [string, string][], cap = 80): string {
  const lines = ["graph TD"];
  const slice = edges.slice(0, cap);
  for (const [u, v] of slice) {
    const uClean = u.replace(/[^a-zA-Z0-9]/g, "_");
    const vClean = v.replace(/[^a-zA-Z0-9]/g, "_");
    lines.push(`  ${uClean} --> ${vClean}`);
  }
  return lines.join("\n");
}

export function generatePlantUmlDiagram(edges: [string, string][], repoLabel = "Repository", cap = 80): string {
  const lines = ["@startuml", `title ${repoLabel} Architecture`];
  const slice = edges.slice(0, cap);
  for (const [u, v] of slice) {
    const uClean = u.split("/").pop() || u;
    const vClean = v.split("/").pop() || v;
    lines.push(`  [${uClean}] --> [${vClean}]`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}

export function generateJsonExport(graphData: unknown): string {
  return JSON.stringify(graphData ?? {}, null, 2);
}
