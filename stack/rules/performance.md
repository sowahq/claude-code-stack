---
globs: ["**/*.{ts,svelte,go}", "src/**/*", "internal/**/*"]
description: Optimization rules for bundle size, query speed, and resource management
---

# Performance Rules
- **Lazy Loading**: In Svelte, prioritize dynamic imports for heavy components or routes to minimize the initial bundle size.
- **Database Efficiency**: Prevent N+1 query problems. Always prefer JOINs or batched queries. Ensure all queried columns are indexed.
- **Memory Management (Go)**: Avoid unnecessary allocations in hot loops. Use `sync.Pool` for frequently reused objects.
- **Caching**: Proactively suggest caching strategies (Redis, SWR, or browser cache) for expensive computations or frequent API calls.
- **Asset Optimization**: Use modern image formats (WebP/Avif) and ensure proper sizing. Prevent layout shifts (CLS).
- **Bundle Analysis**: Be wary of importing large libraries for single functions. Suggest lightweight alternatives (e.g., `date-fns` over `moment`).
