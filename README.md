# claude-code-stack

My personal [Claude Code](https://code.claude.com/docs) configuration, and a cross-platform installer for it (macOS, Linux, Windows).

## Install

Requires Node.js 22.18+ (the guard hooks also run with `node`).

```bash
npx github:sowahq/claude-code-stack            # interactive
npx github:sowahq/claude-code-stack --dry-run  # show the plan, change nothing
```

From a clone: `node dist/cli.mjs [command] [options]`.

| Command | Effect |
| :--- | :--- |
| `install` (default) | Install or update. Re-running only applies what changed. |
| `uninstall` | Remove what the stack installed and restore your settings. |
| `doctor` | Check Node, the Claude CLI, installed files, settings and rules. |

| Option | Effect |
| :--- | :--- |
| `-g, --global` | Target `CLAUDE_CONFIG_DIR` or `~/.claude`. |
| `-p, --project [dir]` | Target a project (`<dir>/.claude` and `<dir>/CLAUDE.md`). |
| `-y, --yes` | Non-interactive. Reuses the previous selection, or installs everything. |
| `-n, --dry-run` | Print the plan only. |
| `-f, --force` | Also overwrite or remove files you edited (a backup is kept). |

## What it installs

| Component | Destination | Notes |
| :--- | :--- | :--- |
| `stack/CLAUDE.md` | `claude-code-stack.md` | Pulled into your `CLAUDE.md` with a managed `@` import block. Your content is untouched. |
| `stack/rules/` | `rules/` | Language rules use `paths:` frontmatter and load only when matching files are touched. `clean-code`, `security` and `writing-style` load every session. |
| `stack/agents/` | `agents/` | `go-reviewer`, `rust-reviewer`, `svelte-builder`, `db-guardian`, `devops-docker`, `security-auditor`, `investigator`. |
| `stack/skills/` | `skills/` | `atomic-commit`, `todoist`. |
| `src/hooks/` (compiled to `dist/hooks/`) | `hooks/claude-code-stack/` | One PreToolUse guard for Bash and PowerShell, written in Node with no `jq` or bash dependency. |
| `stack/settings.json` | `settings.json` | Merged. Keys you already set are never overridden. |
| MCP servers | `claude mcp add` | Svelte, Ark UI, Figma (figma-mcp-go), Todoist. Wrapped in `cmd /c` on Windows. |
| Plugins | `claude plugin install` | `gopls-lsp`, `rust-analyzer-lsp` and `frontend-design` from the official marketplace, `tsgo-lsp` from this repo, `i-have-adhd` with its always-on flag. Plugins you already had are never reinstalled or removed. |

### tsgo-lsp

TypeScript 7 no longer ships `tsserver`, so the official `typescript-lsp` plugin, which runs `typescript-language-server`, has nothing to drive in a TS 7 project. This repo is also a plugin marketplace whose `tsgo-lsp` plugin runs the native server, `tsc --lsp --stdio`, behind a small relay (`plugins/tsgo-lsp/src/relay.mts`): the TS 7 server only answers pulled diagnostics, while Claude Code only reads pushed ones, so the relay pulls them after each open or change and pushes them. It needs TypeScript 7 or later on PATH. When `tsc` is missing, the installer installs `typescript@7` globally with the package manager that launched it (`npx`, `pnpm dlx` or `bunx`), or else the first of pnpm, bun and npm it finds. An older `tsc` is only replaced in interactive mode, after the plan is confirmed; `--yes` leaves it and prints the command. Uninstall leaves TypeScript in place. The installer also replaces `typescript-lsp` with `tsgo-lsp` when the stack had installed `typescript-lsp`. To install it on its own:

```
/plugin install tsgo-lsp --marketplace sowahq/claude-code-stack
```

Optional tools offered on global installs: [rtk](https://github.com/rtk-ai/rtk) (needs cargo).

### Guard checks

Selectable at install time, and passed to `guard-bash.mjs` as arguments:

- `commit-trailers`: denies `git commit`, `git tag` and `gh pr create/edit` when the message carries `Co-Authored-By`, `Generated with ... Claude` or a session link.
- `dangerous-commands`: denies recursive deletes of root, home or system folders (`rm`, `Remove-Item`, `rd /s`), force pushes to or deletion of `main`/`master`, `git push --mirror`, `mkfs`, `dd` to a device. Asks before other force pushes, `git reset --hard` and `git clean -f`.
- `secret-reads`: denies reading `.env*` (except `.example`/`.sample`/`.template`), keys and certificates, `~/.ssh`, cloud and CLI credentials through `cat`, `grep`, `Get-Content`, `< file` and similar, and uploading them with `curl -F @file`. It covers Bash, which `permissions.deny` `Read(...)` rules do not.

The parser handles quotes, heredocs, `$(...)`, `sh -c`, `eval`, `pwsh -Command` and prefixes such as `sudo`, `env`, `xargs` and `rtk`. Hooks are guardrails, not a sandbox.

## How updates stay safe

- `.claude-code-stack-manifest.json` records every installed file with its sha256, and every settings entry the stack added.
- A file you edited is skipped on update and kept on uninstall, unless you pass `--force`.
- Settings entries the stack added are removed on update when the stack no longer ships them, and on uninstall, but only if you did not change them.
- Every file that is overwritten or removed is first copied to `.claude-code-stack/backups/<timestamp>/`.
- Installs made by the previous `setup.js` (manifest v1) are migrated automatically. v1 recorded no hashes, so edits to v1-installed files cannot be detected: the first v2 run updates them and keeps the old version in the backup. Settings keys are only claimed by the stack when a v1 template actually shipped them. The obsolete bash hook, `project-memory.md`, the `todoist.md` rule (now a skill) and the invalid `outputStyle` added by v1 are cleaned up.

## Development

The installer and the guard hooks are written in TypeScript (`src/`) and compiled to `dist/`. Runtime uses Node built-ins only; `typescript` and `@types/node` are dev dependencies.

```bash
npm install
npm run build              # compile src/ to dist/
npm run typecheck          # type-check src/ and test/
npm test                   # build, then hook parser, settings merge and end-to-end installer tests
node src/cli.mts doctor    # run from source (Node strips the types)
```

Commit `dist/` after `npm run build`: it is what `npx` runs, since Node cannot strip types inside `node_modules`.

CI is manual (`workflow_dispatch`, from the Actions tab or `gh workflow run test`). It runs typecheck and the suite on Ubuntu, macOS and Windows with Node 22, 24 and 26, and fails if `dist/` is not up to date.

## License

MIT © [szerookii](https://github.com/szerookii)
