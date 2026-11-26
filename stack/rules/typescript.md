---
globs: ["**/*.ts", "**/*.tsx"]
description: TypeScript coding standards and type safety rules
---

# TypeScript & Type Safety
- **Strict Typing**: Use strict modes. Avoid `any` at all costs. Use `unknown` or explicit generics if needed.
- **Interfaces over Types**: Prefer `interface` for object shapes and `type` for unions, intersections, or primitives.
- **Explicit Returns**: Always declare return types for functions, especially public APIs and complex logic.
- **Discriminated Unions**: Use discriminated unions for complex state or API responses to ensure exhaustive checks.
- **Type Guards**: Use custom type guards (`isX(val): val is X`) to narrow down types in conditionals.
- **Runtime Validation**: Use validation libraries (e.g., Zod, Valibot) for runtime type checking of external data (API, forms, user input).
- **Utility Types**: Leverage built-in utility types like `Partial`, `Pick`, `Omit`, and `Record` to avoid duplication.
- **No Casts**: Avoid `as` type assertions unless absolutely necessary (e.g., third-party library limitations). Prefer narrowing.
