# Claude Code Stack (Personal Sandbox)

This is my personal workspace for testing and refining [Claude Code](https://code.anthropic.com/) configurations. I use this repository to organize my project instructions, rules, and agentic workflows.

## 🚀 Quick Bootstrap

You can initialize any project with this setup using a single command.

### Node.js (18+)
```bash
node -e "fetch('https://raw.githubusercontent.com/szerookii/claude-code-stack/main/setup.js').then(r=>r.text()).then(eval)"
```

### 🌍 Project vs Global Install
The installer first asks where to install:
- **Project** — writes `CLAUDE.md` + `.claude/` into the target directory (current behaviour).
- **Global (`~/.claude`)** — applies to all projects **without overwriting your base config**. Your existing `~/.claude/CLAUDE.md`, `RTK.md` and `settings.json` are never touched: the stack instructions are written to `~/.claude/claude-code-stack.md` and pulled in via a managed `@`-import block. Rules/skills that already exist and aren't managed by the stack are skipped. Everything installed is tracked in `~/.claude/.claude-code-stack-manifest.json` for a clean, reversible uninstall.

### 🔌 MCP Servers
The installer can optionally wire MCP servers into Claude Code (`user` scope for global, `project` scope otherwise):
- **Svelte** (`@sveltejs/mcp`), **Ark UI** (`@ark-ui/mcp`), **Figma** (`@vkhanhqui/figma-mcp-go`), **Todoist** (HTTP, `https://ai.todoist.net/mcp` — authenticate via `/mcp` after install).

Already-configured servers are auto-detected (by package id, regardless of the name you gave them) and skipped, so it never prompts to re-add something you already have.

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

1. **Strategic Delegation**: Research is handled by `codebase_investigator`, and batch tasks (3+ files) by the `generalist` sub-agent.
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
