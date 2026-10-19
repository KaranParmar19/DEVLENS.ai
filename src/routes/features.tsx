import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/components/mf/pages";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({ meta: [{ title: "Features — DevLens AI" }, { name: "description", content: "Architecture maps, code flow tracing, a cited Q&A copilot and generated onboarding docs." }] }),
});
