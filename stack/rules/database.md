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

# Database Rules
- **Non-Destructive**: NEVER drop tables or delete columns in migrations without explicit permission. Always favor additive changes or renaming.
- **Go Data Access (sqlc)**: Use raw SQL with sqlc. Queries live in `.sql` files; sqlc generates typed Go code. Never hand-edit generated files. Run `sqlc generate` after changing queries or schema. No GORM.
- **TypeScript Data Access**: Use the project's ORM (Prisma or Drizzle) and follow its rule file.
- **N+1 Queries**: Never issue per-row queries in a loop. Prefer JOINs or batched queries.
- **Indexing**: Proactively suggest indexes for columns that are frequently queried or used in `JOIN` and `WHERE` clauses.
- **Transactions**: When performing multiple related writes in Golang, ALWAYS wrap them in a database transaction and ensure rollbacks on errors.
