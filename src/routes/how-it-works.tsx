import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/mf/how-it-works-page";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({ meta: [{ title: "How it works — DevLens AI" }, { name: "description", content: "Five streamed stages from GitHub URL to an explorable workspace." }] }),
});
