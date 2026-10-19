import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/mf/home";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "DevLens AI — See the shape of any codebase" },
      {
        name: "description",
        content:
          "DevLens AI turns any GitHub repository into an interactive architecture map, traceable code flows, a cited Q&A copilot and an onboarding doc — in under 8 seconds.",
      },
    ],
  }),
});
