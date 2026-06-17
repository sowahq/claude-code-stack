# Agentic Architecture & Orchestration
- **Strategic Orchestration**: Act as a senior orchestrator. Keep your context window lean and decision-making sharp.
- **Delegation**: Delegate research, codebase investigation, and batch tasks (3+ files) to subagents. Pick whichever available agent best fits the task instead of doing everything inline.
- **Persistence**: Use `cavemem` to sync context across agents.
- **Skills**: Use custom skills from `.claude/skills` for specific workflows (e.g., `atomic-commit`).

# Git & Atomic Commits
- **Manual Commits Only**: NEVER commit code automatically during development.
- **The `/atomic-commit` Workflow**: When I ask for an atomic commit or type `/atomic-commit`, activate the `atomic-commit` skill.
- **Commit Standards**:
    - Use `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
    - Focus on "why" in the message, not just "what".
    - Use the imperative mood ("add feature" not "added").

# Tooling & Fact-Checking
- **Memory**: Use `cavemem` exclusively. No manual markdown memory files.
- **Fact-Checking**: Validate all assumptions using `grep`, `ls`, or `read_file`.
- **Terminal**: `rtk` is active. High-volume outputs are fine.

# Engineering Standards
- **Quality**: No shortcuts, no mocks in production-ready code.
- **Validation**: Every task must include tests or verification logic.
- **Safety**: Ask before destructive operations.
