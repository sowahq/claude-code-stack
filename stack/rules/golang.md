---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go

- Handle every error. Wrap it with context using `fmt.Errorf("load config %s: %w", path, err)` so callers can still match it with `errors.Is` and `errors.As`; compare sentinel errors with `errors.Is`, never with `==` or string matching. Discarding an error with `_` needs a one-line comment saying why it cannot fail or does not matter.
- Return errors instead of panicking. `panic` is for broken invariants and `init`-time setup, not for input or I/O failures.
- Pass `context.Context` as the first parameter of anything that does I/O or may block, and respect its cancellation. Never store a context in a struct.
- Log with `log/slog` and structured attributes, not `fmt.Println` or `log.Printf`.
- Every goroutine has a clear owner and exit: a `sync.WaitGroup`, an `errgroup.Group` or a closed channel. A goroutine that can block forever is a leak.
- Accept interfaces, return concrete types. Define an interface where it is consumed, and only when there are two implementations or a test needs one.
- Code is `gofmt`-clean and passes `go vet`. Check package behaviour with `go doc` instead of guessing.
