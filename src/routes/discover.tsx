import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { DiscoverBody } from "@/components/te/pages";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Discover — Third Eye" },
      { name: "description", content: "Real NISAR acquisition records with clearly labelled illustrative change-candidate examples." },
      { property: "og:title", content: "Discover — Third Eye" },
      { property: "og:description", content: "Curated Earth stories and notable changes detected across the planet." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="DISCOVER" title="Notable changes" intro="Browse live NISAR product coverage and quicklooks. Demo change candidates are labelled separately and are not computed detections.">
      <DiscoverBody />
    </PageShell>
  ),
});
