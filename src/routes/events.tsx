import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { EventsBody } from "@/components/te/pages";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Events — Third Eye" },
      { name: "description", content: "Explore live NISAR acquisition coverage, source-reported public events and separately labelled sample candidates." },
      { property: "og:title", content: "Events — Third Eye" },
      { property: "og:description", content: "Browse detected candidate events by phenomenon, severity and confidence." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="EVENTS" title="Event catalog" intro="Inspect satellite acquisitions and public context. Sample phenomenon candidates are illustrative until a validated processing workflow produces detections.">
      <EventsBody />
    </PageShell>
  ),
});
