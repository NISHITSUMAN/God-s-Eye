import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
        const hasProviderKey = Boolean(process.env.AI_API_KEY);
        return Response.json({
          ok: true,
          service: "third-eye",
          timestamp: new Date().toISOString(),
          services: { nasaCmr: "public", ai: hasGateway || hasProviderKey ? "configured" : "configuration-required" },
          configuration: {
            aiGatewayKeyPresent: hasGateway,
            aiProviderKeyPresent: hasProviderKey,
            modelConfigured: Boolean(process.env.AI_MODEL),
          },
        }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
