import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/te/PageShell";
import { SettingsBody } from "@/components/te/pages";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — Third Eye" },
      { name: "description", content: "Units, motion, and display preferences for Third Eye." },
      { property: "og:title", content: "Settings — Third Eye" },
      { property: "og:description", content: "Units, motion, and display preferences for Third Eye." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="SETTINGS" title="Settings" intro="Preferences for display and behaviour.">
      <SettingsBody />
    </PageShell>
  ),
});
