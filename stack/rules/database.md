---
paths:
  - "**/*.sql"
  - "**/migrations/**"
  - "**/sqlc.{yaml,yml,json}"
  - "**/*.prisma"
  - "**/drizzle.config.*"
  - "**/db/**"
  - "**/*repository*.go"
  - "**/*store*.go"
---

# Databases

- Migrations are additive. Dropping a table or a column, or rewriting data, needs my explicit approval; prefer adding the new shape, migrating reads and writes, then removing the old one in a later migration.
- Go data access uses sqlc: queries live in `.sql` files, sqlc generates typed code that is never edited by hand, and `sqlc generate` runs after any change to queries or schema. No GORM.
- TypeScript data access uses the project's ORM (Prisma or Drizzle) and follows its rule file.
- No query inside a loop over rows. Use a join, a `WHERE id = ANY(...)` or the ORM's batched loading.
- Several related writes go in one transaction, rolled back on any error.
- When a query filters, joins or sorts on a column, check that an index covers it and add one in the migration if not.
