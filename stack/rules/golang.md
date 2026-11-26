---
globs: ["**/*.go"]
description: Standards and rules for the Golang backend
---

# Golang Rules
- **Error Handling**: Always handle errors explicitly. Do not use `_` to ignore errors unless absolutely necessary and justified with a comment.
- **Documentation**: Use native CLI tools like `go doc` to inspect standard library or third-party packages instead of guessing.
- **Formatting**: Assume all code is formatted with `go fmt`. Do not manually reformat code in a way that breaks standard Go conventions.
- **Concurrency**: When using goroutines, always ensure wait groups (`sync.WaitGroup`) or channels are properly managed to prevent memory leaks.
