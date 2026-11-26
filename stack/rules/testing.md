---
globs: ["**/*_test.go", "**/*.test.ts", "**/*.spec.ts", "e2e/**"]
description: Unit and Integration Testing conventions
---

# Testing Rules
- **Golang Testing**: Strictly use Table-Driven Tests (with slices of anonymous structs) for Go unit tests. It is the idiomatic Go way. Use the standard `testing` package.
- **Svelte Testing**: Use Vitest for unit tests and component tests.
- **No Flakes**: Do not write tests that depend on exact timing (`time.Sleep`). Use proper wait groups in Go or `await` patterns in TS.
