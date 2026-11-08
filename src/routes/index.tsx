import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/mf/home";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "DevLens | See the shape of any codebase" },
      {
        name: "description",
        content:
          "Paste a GitHub repository to inspect its dependency graph, trace request paths, and ask questions with exact line citations.",
      },
    ],
  }),
});
