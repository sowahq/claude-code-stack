---
globs: ["**/schema.ts", "**/drizzle/**/*", "drizzle.config.ts"]
description: Drizzle ORM schema definition and migration rules
---

# Drizzle Rules
- **Type Safety**: Strictly use Drizzle's `inferSelect` and `inferInsert` to derive TypeScript types from your schema.
- **Schema Organization**: For large projects, split the schema into multiple files (e.g., `users.ts`, `posts.ts`) and export them from a central `index.ts`.
- **Naming Strategy**: Use `snake_case` for database column names and `camelCase` for JavaScript property names.
- **Migrations**: Use `drizzle-kit generate` to create migrations. Review generated SQL before applying with `drizzle-kit migrate`.
- **Query API**: Favor the Relational Query API (`db.query`) for complex fetches and the Standard API for simple, high-performance CRUD.
- **Zod Integration**: Use `drizzle-zod` to automatically generate validation schemas from your database definitions.
