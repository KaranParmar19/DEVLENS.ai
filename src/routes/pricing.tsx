import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/mf/pages";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({ meta: [{ title: "Pricing — DevLens AI" }, { name: "description", content: "Start free. Upgrade for private repos, unlimited questions and team workspaces." }] }),
});
