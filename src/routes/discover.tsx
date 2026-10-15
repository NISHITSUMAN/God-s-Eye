import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { DiscoverBody } from "@/components/te/pages";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Discover — Third Eye" },
      { name: "description", content: "Curated Earth stories and notable changes detected across the planet." },
      { property: "og:title", content: "Discover — Third Eye" },
      { property: "og:description", content: "Curated Earth stories and notable changes detected across the planet." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="DISCOVER" title="Notable changes" intro="Curated candidates the system surfaced this season. Select one to open it on the globe.">
      <DiscoverBody />
    </PageShell>
  ),
});
