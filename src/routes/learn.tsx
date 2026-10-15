import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { LearnBody } from "@/components/te/pages";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Learn — Third Eye" },
      { name: "description", content: "Understand radar, InSAR and how Third Eye interprets Earth change." },
      { property: "og:title", content: "Learn — Third Eye" },
      { property: "og:description", content: "Understand radar, InSAR and how Third Eye interprets Earth change." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="LEARN" title="How Third Eye sees" intro="Short primers on the science behind the platform.">
      <LearnBody />
    </PageShell>
  ),
});
