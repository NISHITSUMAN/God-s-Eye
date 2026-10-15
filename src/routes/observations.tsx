import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { ObservationsBody } from "@/components/te/pages";

export const Route = createFileRoute("/observations")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Observations — Third Eye" },
      { name: "description", content: "NISAR acquisitions, products, orbits and quality states." },
      { property: "og:title", content: "Observations — Third Eye" },
      { property: "og:description", content: "NISAR acquisitions, products, orbits and quality states." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="OBSERVATIONS" title="NISAR observations" intro="Acquisitions indexed by product, orbit and polarization.">
      <ObservationsBody />
    </PageShell>
  ),
});
