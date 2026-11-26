---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
---

# Rust

- Return `Result` and propagate with `?`. `unwrap()` and `expect()` stay out of production paths; in tests and `main` setup, `expect("why this cannot fail")` documents the invariant. Libraries define errors with `thiserror`, applications use `anyhow` with `.context(...)`.
- Avoid `unsafe`. When it is required, keep the block minimal and put a `// SAFETY:` comment above it stating the invariant that makes it sound.
- Borrow before cloning. Accept `&str` and `&[T]` in parameters, return owned types, and reach for `clone()` only when ownership is really needed.
- Code is `cargo fmt`-clean and passes `cargo clippy -- -D warnings`.
- Public items carry `///` docs with `# Errors` and `# Panics` sections where they apply. Check crate APIs with `cargo doc` instead of guessing.
- One async runtime (Tokio). No blocking calls inside async code: use `spawn_blocking` for CPU-heavy or blocking work. Keep `Mutex` guards short and never hold one across an `.await`.
- Keep `Cargo.toml` lean: prefer std or a small focused crate, and enable only the features you use.
