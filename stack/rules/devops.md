---
globs: ["**/Dockerfile*", "**/docker-compose.yml", ".github/workflows/**"]
description: DevOps, Docker, and CI/CD best practices
---

# DevOps & Docker Rules
- **Golang Images**: ALWAYS use multi-stage builds for Golang. Compile in a `golang:alpine` or `golang:bookworm` builder stage, and run the binary in a `scratch` or `alpine` final image to keep it minimal.
- **Node/Svelte Images**: Use `node:alpine` for the SvelteKit build and execution environment.
- **Security**: Never run containers as the `root` user in the final stage. Always create a dedicated user (e.g., `appuser`).
- **Dependencies**: Never cache dependencies locally in a way that breaks CI/CD workflows.
