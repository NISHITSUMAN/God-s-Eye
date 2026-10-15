<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Earth rendering uses CesiumJS/Resium for 3D and MapLibre for 2D, both lazy-loaded behind `<ClientOnly>` so WebGL never enters SSR.
- Shared app state lives in a single zustand store (`src/lib/store.ts`) so the AI agent and UI drive the same state.
- The Third Eye AI is a frontend simulator (`src/lib/ai-agent.ts`) emitting step/message events; replace its internals with a real tool-calling backend while keeping that contract.
- Geographic UI reads through the typed provider in `src/lib/earth-data.ts` so sample data can be replaced without rewriting views.
- All sample records and geometries must be visibly labelled as sample data — never present them as live NASA/NISAR measurements.
