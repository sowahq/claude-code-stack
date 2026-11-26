---
globs: ["**/schema.prisma", "**/prisma/**/*", "src/lib/prisma.ts"]
description: Prisma ORM schema management and client usage best practices
---

# Prisma Rules
- **Schema Naming**: Use PascalCase for models and camelCase for fields. Ensure relationship names are descriptive.
- **Enums**: Use enums for fields with a fixed set of values to ensure type safety at the database level.
- **Migrations**: Always use `prisma migrate dev` for development changes. NEVER manually edit the database schema.
- **Client Singleton**: Always use a singleton pattern for the Prisma Client to prevent connection limit issues, especially in SvelteKit or serverless environments.
- **Validation**: Combine Prisma with Zod for robust input validation that matches your database schema.
- **Performance**: Use `select` to only fetch necessary fields. Avoid `include` for deeply nested relationships unless required.
