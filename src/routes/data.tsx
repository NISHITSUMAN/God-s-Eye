import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { DataBody } from "@/components/te/pages";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Data Explorer — Third Eye" },
      { name: "description", content: "Explore the NISAR product family and complementary datasets." },
      { property: "og:title", content: "Data Explorer — Third Eye" },
      { property: "og:description", content: "Explore the NISAR product family and complementary datasets." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="DATA" title="Data explorer" intro="Products and complementary datasets available to analyses.">
      <DataBody />
    </PageShell>
  ),
});
