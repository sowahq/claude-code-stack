---
globs: ["**/*.svelte", "src/**/*.ts", "tailwind.config.js", "app.css"]
description: Svelte best practices, styling, and UI/UX rules
---

# Styling & UI Frameworks
- **No Freestyling**: Tailwind CSS and/or specific UI libraries (e.g., shadcn-svelte, Flowbite) are likely configured. ALWAYS check `package.json` and `tailwind.config.js` to understand the styling stack.
- **Strict Adherence**: Strictly use the existing utility classes, design tokens, and pre-built components. DO NOT write custom CSS in `<style>` blocks or introduce new UI paradigms.
- **Theming & Tokens**: NEVER hardcode hex colors (e.g., `#FFFFFF`), spacing values (e.g., `13px`), or font sizes. ALWAYS use the project's theme tokens (e.g., `text-primary`, `bg-background`, `p-4`, `rounded-lg`). If using shadcn/ui or other design systems, strictly follow the CSS variable conventions defined in the project CSS.

# Svelte & SvelteKit Rules
- **Reactivity**: Prefer Svelte 5 Runes (`$state`, `$derived`, `$effect`).
- **Routing**: Respect SvelteKit file-based routing conventions (`+page.svelte`, `+layout.svelte`, `+page.server.ts`).
- **Tooling & MCP**: Prioritize the Svelte MCP server if available. Otherwise, rely on native CLI commands like `svelte-check` to validate your code.
