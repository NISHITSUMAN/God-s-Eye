import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Sidebar } from "@/components/te/Sidebar";
import { useApp } from "@/lib/store";


function NotFoundComponent() {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="label-xs">ERROR 404</div>
        <h1 className="mt-2 text-xl font-medium">No signal at this location</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Return to Explore</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or head back.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Third Eye — Earth Intelligence" },
      { name: "description", content: "Earth-observation explorer with real NASA NISAR catalogue coverage, public context feeds, historical timeline, and clearly marked illustrative science layers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function LiveDataBootstrap() {
  useEffect(() => {
    const refresh = () => {
      void useApp.getState().refreshLiveData();
      void useApp.getState().refreshNISARData();
    };
    refresh();

    let debounceId: number | undefined;
    const unsubscribe = useApp.subscribe((state, previous) => {
      const areaChanged = state.aoi !== previous.aoi;
      const timeWindowChanged = state.time.start !== previous.time.start || state.time.end !== previous.time.end;
      const selectedDateChanged = state.time.current !== previous.time.current;
      const playbackStopped = previous.playing && !state.playing;

      // During playback the cursor advances quickly. Refresh after a settled
      // date instead of issuing one catalog request per playback tick.
      if (!areaChanged && !timeWindowChanged && !playbackStopped && (!selectedDateChanged || state.playing)) return;
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        if (useApp.getState().playing) return;
        void useApp.getState().refreshNISARData();
      }, 900);
    });

    const refreshId = window.setInterval(refresh, 30 * 60 * 1000);
    return () => {
      unsubscribe();
      window.clearTimeout(debounceId);
      window.clearInterval(refreshId);
    };
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LiveDataBootstrap />
      <div className="app-frame flex h-dvh w-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="root-main relative min-w-0 flex-1"><Outlet /></main>
      </div>
    </QueryClientProvider>
  );
}
