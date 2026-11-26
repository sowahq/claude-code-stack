# claude-code-stack

This repo is the source of a Claude Code config. `stack/` is the payload copied into `~/.claude` or a project `.claude/`; it is not this repo's own config, so it lives outside `.claude/` to avoid loading twice.

- `src/*.mts`: installer, strict TypeScript. `cli.mts` is the entrypoint (`install`, `uninstall`, `doctor`). Planning is pure (`plan.mts`, `settings.mts`), side effects live in `apply.mts`, `mcp.mts`, `extras.mts`.
- `src/hooks/`: guard hook sources. Must run on macOS, Linux and Windows.
- `dist/`: compiled output of `src/` (`npm run build`), committed because `npx` runs `dist/cli.mjs`. Never edit by hand: rebuild. Hooks are installed from `dist/hooks/`.
- `stack/`: payload (CLAUDE.md, rules, agents, skills, settings, flags).
- `test/`: `node --test`. Table-driven. `cli.test.mts` runs the compiled `dist/cli.mjs` against temp dirs with `CLAUDE_CONFIG_DIR` and a PATH without `claude`.

Constraints:
- No runtime dependencies. Use only Node built-ins. Dev dependencies are `typescript` and `@types/node` only.
- Run `npm run build` before committing and commit `dist/`. The manual CI fails when it is stale.
- Never spawn through a shell. Use `run()` from `src/exec.mts`, which handles `.cmd` shims on Windows.
- Paths written into settings.json use forward slashes.
- Any change to what the stack writes needs a matching uninstall path and a test.
