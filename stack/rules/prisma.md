---
paths:
  - "**/*.prisma"
  - "**/prisma/**"
  - "**/prisma.config.*"
---

# Prisma

Read the installed `prisma` major in `package.json` and follow its conventions; the project's existing setup wins over these defaults.

- Prisma 7: CLI and connection settings live in `prisma.config.ts`, the client uses the `prisma-client` generator with an explicit `output`, and a driver adapter is passed when creating the client. Environment variables are not loaded automatically: load them where the config expects. On Prisma 6, keep the existing `prisma-client-js` setup.
- Create one client per process and reuse it (a module-level instance), so serverless and dev reloads do not exhaust connections.
- Models are PascalCase, fields camelCase, relations named for what they mean. Fixed value sets are enums.
- Change the schema, then run `prisma migrate dev` to create the migration. Never edit the database by hand or rewrite an applied migration.
- Fetch only what is used: `select` the fields, and avoid deep `include` chains unless the caller needs them.
- Validate input with the project's schema library before it reaches Prisma.
