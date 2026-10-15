import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { TimelineBody } from "@/components/te/pages";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Timeline — Third Eye" },
      { name: "description", content: "A chronological view of observations and events through 2026." },
      { property: "og:title", content: "Timeline — Third Eye" },
      { property: "og:description", content: "A chronological view of observations and events through 2026." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="TIMELINE" title="2026 chronology" intro="Observations and candidate events in time order.">
      <TimelineBody />
    </PageShell>
  ),
});
