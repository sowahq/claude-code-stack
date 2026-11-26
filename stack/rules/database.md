---
globs: ["**/*.sql", "db/migrations/**", "internal/db/**"]
description: Database schema, migrations, and query rules
---

# Database Rules
- **Non-Destructive**: NEVER drop tables or delete columns in migrations without explicit permission. Always favor additive changes or renaming.
- **Raw SQL vs ORM**: [Ajuste selon ton choix : "Use raw SQL with sqlc" ou "Use GORM"]. Follow the chosen paradigm strictly.
- **Indexing**: Proactively suggest indexes for columns that are frequently queried or used in `JOIN` and `WHERE` clauses.
- **Transactions**: When performing multiple related writes in Golang, ALWAYS wrap them in a database transaction and ensure rollbacks on errors.
