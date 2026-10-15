import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { AnalyzeBody } from "@/components/te/pages";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Analyze — Third Eye" },
      { name: "description", content: "Discover real NISAR acquisitions for a selected area, product family and date range. Full raster processing is not executed by this frontend." },
      { property: "og:title", content: "Analyze — Third Eye" },
      { property: "og:description", content: "Run change detection, deformation and phenomenon analyses in five steps." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="ANALYZE" title="New analysis" intro="Area → product family → time range → live NASA CMR discovery → report.">
      <AnalyzeBody />
    </PageShell>
  ),
});
