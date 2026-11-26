---
paths:
  - "**/*_test.go"
  - "**/*.rs"
  - "**/*.{test,spec}.{ts,tsx,js,mts,mjs}"
  - "**/tests/**"
  - "**/__tests__/**"
---

# Testing

- Test behaviour through the public surface, not implementation details: a refactor that keeps behaviour must not break a test.
- Every bug fix comes with a test that fails before the fix and passes after it.
- Mock only the boundaries you do not own (network, clock, filesystem, third-party APIs). Use the real code for everything inside the project.
- One reason to fail per test, and a name that states the scenario and the expected result.
- No sleeps or wall-clock timing. Wait on a signal: a `sync.WaitGroup` or channel in Go, an awaited promise in TypeScript, an injected clock.
- Use the project's existing runner and helpers before adding a new one.

## Per language
- Go: table-driven tests with a slice of named cases run through `t.Run`, standard `testing` package. Run with `go test -race ./...`.
- Rust: `#[cfg(test)]` modules with `#[test]`, cases as an array iterated in the test. Run with `cargo test`.
- TypeScript and Svelte: Vitest for unit and component tests unless the project already uses another runner.
