import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/mf/home";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "DevLens | SEE THE SHAPE OF ANY CODEBASE" },
      {
        name: "description",
        content:
          "Paste a GitHub repository to inspect its dependency graph, trace request paths, and ask questions with exact line citations.",
      },
    ],
  }),
});
