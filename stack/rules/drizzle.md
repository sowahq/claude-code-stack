---
paths:
  - "**/drizzle.config.*"
  - "**/drizzle/**"
  - "**/db/schema/**"
  - "**/db/schema.ts"
---

# Drizzle

- Derive TypeScript types from the schema with `$inferSelect` and `$inferInsert` instead of writing them by hand.
- Columns are `snake_case` in the database and `camelCase` in TypeScript.
- Split a large schema into one file per domain (`users.ts`, `orders.ts`) re-exported from an `index.ts`.
- Generate migrations with `drizzle-kit generate`, read the generated SQL, then apply it with `drizzle-kit migrate`. `drizzle-kit push` is for local prototyping only.
- Use the relational query API (`db.query`) for nested reads and the core query builder for simple CRUD and anything performance-sensitive.
- Build validation schemas from the table definitions: `drizzle-zod` on Drizzle 0.x, `drizzle-orm/zod` on Drizzle 1.x. Check which major is installed.
