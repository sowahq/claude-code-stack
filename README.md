# Claude Code Stack (Personal Sandbox)

This is my personal workspace for testing and refining [Claude Code](https://code.anthropic.com/) configurations. I use this repository to organize my project instructions, rules, and agentic workflows.

## 🚀 Quick Bootstrap

You can initialize any project with this setup using a single command.

### Node.js (18+)
```bash
node -e "fetch('https://raw.githubusercontent.com/szerookii/claude-code-stack/main/setup.js').then(r=>r.text()).then(eval)"
```

### 🌍 Project vs Global Install
The installer first asks where to install. **Both scopes are non-destructive** — nothing you already have is overwritten:
- **Project** — installs into the target directory. Your existing `CLAUDE.md` is preserved (stack instructions go to `claude-code-stack.md`, pulled in via a managed `@`-import block); pre-existing rules/skills that the stack doesn't manage are skipped; `settings.json` is deep-merged. Everything is tracked in `.claude-code-stack-manifest.json` for a clean, reversible uninstall.
- **Global (`~/.claude`)** — same guarantees, applied to all projects. Your `~/.claude/CLAUDE.md`, `RTK.md` and `settings.json` are never clobbered.

### 🔌 MCP Servers
The installer can optionally wire MCP servers into Claude Code (`user` scope for global, `project` scope otherwise):
- **Svelte** (`@sveltejs/mcp`), **Ark UI** (`@ark-ui/mcp`), **Figma** (`@vkhanhqui/figma-mcp-go`), **Todoist** (HTTP, `https://ai.todoist.net/mcp` — authenticate via `/mcp` after install).

Already-configured servers are auto-detected (by package id, regardless of the name you gave them) and skipped, so it never prompts to re-add something you already have.

### ⚙️ Recommended settings.json
The installer can optionally apply a recommended `settings.json` (French language, no commit/PR attribution, `.env`/`secrets` read-denied). It is **deep-merged**: existing scalar values you already set are kept, `permissions` arrays are unioned and de-duplicated — nothing you configured is overwritten. On global uninstall the original `settings.json` is restored exactly (or removed if the stack created it), unless you changed it since install.

### 🔄 Update or Uninstall
To update your rules/skills or uninstall the stack, simply run the command above again. The installer detects the existing installation (via the manifest for global installs) and offers to **Reapply/Update** or **Uninstall**. Global uninstall removes only stack-managed files, the `@`-import block, and stack MCP servers — your base config stays intact.

## 🎯 Main Features

This setup automates the repetitive parts of project initialization:

- **Interactive Setup**: A CLI to pick exactly which rules and **custom skills** to apply.
- **Environment Check**: Verifies if Claude Code is installed and helps set it up.
- **Skill Laboratory**: Optional integration for experimental tools:
  - `caveman`: Token compression for terser communication.
  - `cavemem`: Local memory for cross-session context.
  - `ui-ux-pro-max`: Design intelligence for UI generation.
  - `rtk`: Rust Token Killer for command rewriting and token savings (requires Rust/Cargo).
- **Structured Knowledge**: 10+ rule files (`.claude/rules/`) and custom skills (`.claude/skills/`).

## 🤖 Agentic Workflow

This configuration transforms Claude into an orchestrator:

1. **Strategic Delegation**: Research, codebase investigation, and batch tasks (3+ files) are delegated to subagents — Claude picks whichever available agent best fits, keeping the main context lean.
2. **On-Demand Skills**: Custom skills like `/atomic-commit` are loaded only when needed to save context.
3. **Context Sync**: Uses `cavemem` to maintain facts and decisions across sessions.

## 🛠️ Rule & Skill Arsenal

| Rule/Skill | Focus |
| :--- | :--- |
| **atomic-commit** (Skill) | Logical breakdown of changes into atomic commits. |
| **typescript.md** | Type safety, strict typing, and Zod validation. |
| **svelte.md** | SvelteKit patterns, Svelte 5 Runes, and Tailwind tokens. |
| **golang.md** | Idiomatic Go and error handling. |
| **security.md** | Basic security standards and validation. |
| **performance.md** | Optimization and resource efficiency. |
| **database.md** | Migrations and indexing. |
| **testing.md** | Table-driven tests (Go) and Vitest (TS). |
| **devops.md** | Docker builds and CI workflows. |
| **prisma.md** / **drizzle.md** | ORM schema patterns and best practices. |

## 📄 License

MIT © [szerookii](https://github.com/szerookii)
