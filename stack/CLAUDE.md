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

# Fact-Checking
- Validate every assumption with Grep, Glob, or Read before acting on it.

# Engineering Standards
- **Quality**: No shortcuts, no mocks in production code.
- **No Code Comments**: NEVER write inline/explanatory comments. Code self-documents through naming and structure. Exception: structured API docs (JSDoc, GoDoc, rustdoc, docstrings) where a rule calls for them.
- **Validation**: Every task includes tests or verification.
- **Safety**: Ask before destructive operations.
