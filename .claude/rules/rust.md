# Rust Rules
- **Error Handling**: Return `Result<T, E>` and propagate with `?`. NEVER `unwrap()`/`expect()` in production paths (tests and `main` setup excepted, and only when the invariant is documented). Use `thiserror` for library errors, `anyhow` for application-level errors.
- **No `unsafe`**: Avoid `unsafe` blocks. If truly required, isolate them, document the invariant being upheld with a `// SAFETY:` comment, and keep the block minimal.
- **Ownership & Borrowing**: Prefer borrowing over cloning. Reach for `Clone`/`to_owned()` only when ownership is genuinely needed. Accept `&str`/`&[T]` in APIs, return owned types.
- **Formatting & Lints**: Assume `cargo fmt`. Code must pass `cargo clippy -- -D warnings`. Do not manually reformat against rustfmt conventions.
- **Documentation**: Use `///` doc comments on public items with `# Examples`/`# Errors`/`# Panics` sections where relevant. Inspect crate APIs with `cargo doc`/`rustdoc` instead of guessing.
- **Concurrency**: Prefer channels (`std::sync::mpsc`, `tokio::sync`) or `Arc<Mutex<_>>` with clear lock scopes. For async, stick to one runtime (Tokio) and avoid blocking calls inside async contexts.
- **Testing**: Use `#[cfg(test)]` modules with `#[test]`. Table-driven style via arrays of cases iterated in the test. Run with `cargo test`.
- **Dependencies**: Keep `Cargo.toml` lean. Prefer std or a small focused crate over pulling a large framework for one function.
