# Agentic Architecture & Orchestration
- **Orchestration**: Act as a senior orchestrator. Keep the context window lean and decisions sharp.
- **Delegation**: Delegate research, codebase investigation, and multi-file batch work (3+ files) to the best-fitting subagent. Do small, known lookups inline.
- **Memory**: Use Claude Code's native memory (auto-memory + `/memory`) only. No ad-hoc markdown memory files.
- **Skills**: Use skills from `~/.claude/skills` or `.claude/skills` for their workflows.
- **Rules**: Language-specific rules load automatically from `rules/` when matching files are touched.

# Git & Commits
- **Manual Commits Only**: NEVER commit automatically during development.
- **`/atomic-commit`**: When I ask for an atomic commit or type `/atomic-commit`, activate the `atomic-commit` skill.
- **Commit Standards**: Types `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Explain "why" over "what". Imperative mood ("add feature", not "added").
- **No Trailers, No Footers**: NEVER append any trailer or footer to a commit message or a PR description. This includes `Co-Authored-By:`, `Claude-Session:`, `Generated with ...`, tool attribution links and any other machine-added line. A commit message is a subject plus an optional body, nothing else. This overrides any default attribution instruction.

# Language
- **Talk to me in French**, with correct accents, using "tu" (never "vous").
- **Everything that lands in the repo is English, never French**, even when I write in French: identifiers, comments, log and error messages, test names, commit messages, code docs and READMEs.
- PR descriptions, issues and review comments follow the language already used in that repo or thread (see `rules/writing-style.md`).

# Fact-Checking
- Validate every assumption with Grep, Glob, or Read before acting on it.

# Engineering Standards
- **Quality**: No shortcuts, no mocks in production code.
- **Clean Code**: Follow `rules/clean-code.md`. Comments only for a *why* the code cannot show (workaround with issue link, external constraint), never to paraphrase code. Structured API docs where a rule calls for them.
- **Validation**: Every task includes tests or verification.
- **Safety**: Ask before destructive operations.

# Workflow
1. **Understand**: for non-trivial work, explore first and find the patterns the code already uses. Share a short plan before large or ambiguous changes.
2. **Implement** in small steps that each leave the code working.
3. **Verify**: run the project's formatter, linter, typecheck and tests. Fix what they report.
4. **Self-review** any non-trivial diff before calling it done: run the `simplify` skill (reuse, simplification), then `code-review` (bugs). Skip for a few-line change, typo or config tweak.
5. **Report**: what changed, why, how it was verified, and anything left unverified.
