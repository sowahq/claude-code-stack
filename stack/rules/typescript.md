---
paths:
  - "**/*.{ts,tsx,mts,cts}"
---

# TypeScript

- Keep `strict` on. No `any`: use `unknown` and narrow it, or a generic.
- Narrow instead of casting. `as` is acceptable only for a third-party type that cannot be expressed otherwise; prefer type guards (`isOrder(value): value is Order`) and `satisfies` to check a literal against a type without widening it.
- Model state with discriminated unions so every branch is checked; an exhaustive `switch` ends with a `never` check.
- `interface` for object shapes, `type` for unions, intersections and mapped types. Derive related types with `Pick`, `Omit` and `Partial` instead of duplicating them.
- Declare return types on exported functions and on any function whose inferred type would be non-obvious.
- Parse external data (API responses, forms, env, JSON files) with the project's schema library at the boundary, then trust the inferred type inside.
- ES modules only, with `import type` for type-only imports. Prefer `const`, `async`/`await` and array methods; no `var`, no enums when a union of string literals does the job.
