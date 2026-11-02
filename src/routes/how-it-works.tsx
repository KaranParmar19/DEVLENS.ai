import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/mf/how-it-works-page";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How it works | DevLens" },
      {
        name: "description",
        content: "See how DevLens clones, parses, and maps a GitHub repository in seconds.",
      },
    ],
  }),
});
