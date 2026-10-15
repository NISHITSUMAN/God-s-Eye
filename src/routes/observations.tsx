import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { ObservationsBody } from "@/components/te/pages";

export const Route = createFileRoute("/observations")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Observations — Third Eye" },
      { name: "description", content: "Live NISAR acquisition metadata and browse quicklooks, plus a separate illustrative sample catalog." },
      { property: "og:title", content: "Observations — Third Eye" },
      { property: "og:description", content: "NISAR acquisitions, products, orbits and quality states." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="OBSERVATIONS" title="NISAR observations" intro="Inspect catalogued NISAR granules and source records. Example observations are clearly labelled as sample data.">
      <ObservationsBody />
    </PageShell>
  ),
});
