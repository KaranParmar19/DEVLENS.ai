import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/components/mf/pages";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features | DevLens" },
      {
        name: "description",
        content:
          "Dependency graphs, request flow tracing, commit impact checks, and codebase search with line citations.",
      },
    ],
  }),
});
