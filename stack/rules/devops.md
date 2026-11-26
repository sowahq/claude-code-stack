---
paths:
  - "**/Dockerfile*"
  - "**/*.dockerfile"
  - "**/.dockerignore"
  - "**/{docker-,}compose*.{yml,yaml}"
  - "**/.github/workflows/**"
  - "**/.github/dependabot.yml"
  - "**/.gitlab-ci.yml"
---

# Containers and CI

## Docker
- Multi-stage builds. Go compiles in a `golang` builder and runs the static binary on `scratch`, distroless or `alpine`; Node and SvelteKit build and run on `node:<version>-alpine`; Rust builds in a `rust` image, with `cargo-chef` for dependency caching.
- Take toolchain versions from the project (`go.mod`, `.nvmrc`, `package.json` engines, `rust-toolchain.toml`) and pin base images to that exact version tag (`golang:1.27.4-alpine`), never `latest`. Add the digest (`@sha256:...`) only when you looked it up; never write a guessed or placeholder digest. Dependabot can pin and update digests afterwards.
- The final stage runs as a dedicated non-root user.
- The final image holds only the runtime artifact: no compilers, package caches or source. Keep a `.dockerignore` that excludes `.git`, `node_modules`, build output and `.env` files.
- Secrets never go into layers or `ENV`: use build secrets (`RUN --mount=type=secret`) or runtime configuration.
- When the service already has a health endpoint, wire it into a `HEALTHCHECK` or the orchestrator's equivalent. Never invent an endpoint the code does not serve.

## GitHub Actions
- Pin third-party actions to a full commit SHA with the version in a trailing comment when you can look the SHA up; otherwise pin the exact version tag and say the SHA is still to add. Never write a guessed or placeholder SHA. Actions published by GitHub may use a version tag if the repo already does.
- Set `permissions:` at the top to the minimum (`contents: read`) and raise it only in the job that needs more.
- Cache dependencies with the setup action's built-in cache (`actions/setup-node` `cache: npm`, `actions/setup-go`), keyed on the lockfile.
- Never print secrets; pass them through `env` to the step that needs them, not through command arguments.
