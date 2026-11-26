---
paths:
  - "**/*.svelte"
  - "**/*.svelte.{ts,js}"
  - "**/svelte.config.*"
  - "**/src/routes/**"
  - "**/src/lib/**"
  - "**/app.css"
---

# Svelte and SvelteKit

Read `package.json` first: the installed Svelte, SvelteKit and Tailwind majors decide the syntax below. Follow what the project already uses when it differs.

## Svelte 5
- Props come from `$props()` with a typed destructuring, never `export let`. Two-way props use `$bindable()`.
- State uses runes: `$state` for local state, `$derived` for values computed from it, `$effect` only for side effects that touch the outside world (DOM, timers, subscriptions), never to sync one piece of state into another.
- Events are attributes (`onclick={...}`), not `on:click`. A component notifies its parent through a callback prop (`onchange`), not `createEventDispatcher`.
- Pass markup with snippets (`{#snippet}` and `{@render}`), not slots.
- Use the Svelte MCP server for docs and its autofixer when available; otherwise validate with `svelte-check`.

## SvelteKit
- Respect file-based routing: `+page.svelte`, `+layout.svelte`, `+page.server.ts`, `+server.ts`. Server-only code stays in `.server` files or the `server` folder of the library alias (`$lib/server`, `#lib/server` on SvelteKit 3).
- On SvelteKit 3: configuration lives in the `sveltekit()` plugin in `vite.config.*`, the library alias is `#lib`, reactive app state comes from `$app/state` and environment flags from `$app/env`. On SvelteKit 2, keep `svelte.config.js`, `$lib` and the project's existing imports.
- Load heavy, rarely shown components with a dynamic `import()`, and check what a new dependency adds to the bundle before importing it for one function.

## Styling
- Use the styling stack the project has (Tailwind, shadcn-svelte, Flowbite) and its existing components before writing new markup.
- No hard-coded colours, spacing or font sizes and no `<style>` block with raw values: use the theme tokens. With Tailwind 4 the tokens are the `@theme` variables in the main CSS file (often `src/app.css`); with Tailwind 3 they are in `tailwind.config.*`.
