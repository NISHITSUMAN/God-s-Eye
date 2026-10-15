import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { EventsBody } from "@/components/te/pages";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Events — Third Eye" },
      { name: "description", content: "Browse detected candidate events by phenomenon, severity and confidence." },
      { property: "og:title", content: "Events — Third Eye" },
      { property: "og:description", content: "Browse detected candidate events by phenomenon, severity and confidence." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="EVENTS" title="Event catalog" intro="Candidate events with supporting evidence. Terms like candidate and potential reflect real scientific uncertainty.">
      <EventsBody />
    </PageShell>
  ),
});
