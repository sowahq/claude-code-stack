# Clean Code

Write code a reviewer can read once and trust. Every item below is checkable in a diff.

## Fit the codebase
- Read the surrounding code before writing. Reuse its naming, error handling, file layout and helpers. Do not introduce a second style.
- Search before writing a block that resembles existing code. Reuse or extract instead of copy-pasting. Logic repeated twice gets a named helper next to similar shared code. The trigger is repetition, not anticipation.

## Keep the diff small
- Smallest change that solves the problem. No drive-by refactors, no reformatting of untouched lines.
- No speculative abstractions, options, parameters or extension points. Add them when a second real use appears.
- Never mix a refactor and a behaviour change in one commit.
- A diff beyond ~400 lines is a signal to split it into reviewable steps.
- Optimize only for a measured problem (benchmark, profile, measured latency) and say which measurement justified it. Without one, write the simple version: no cache, pool or memoization on a hunch. The cheap wins need no measurement: no work repeated inside a loop, no N+1 queries, no unbounded reads into memory.

## Names
- Names state intent in the domain's vocabulary. No abbreviations except universal ones (`id`, `url`, `ctx`).
- Functions are verbs, booleans read as questions (`isActive`, `hasAccess`), collections are plural.
- One concept, one name across the codebase.

## Functions
- One job at one level of abstraction. A function needing "and" in its description does two things.
- Guard clauses and early returns over nesting. More than 2-3 levels of nesting is a signal to extract.
- ~30 lines is a signal, not a limit: past it, justify or extract. Never split mechanically if it hurts reading.
- No boolean parameters that switch behaviour: write two functions. Past 3 parameters, take an object.
- Keep the core pure. Push I/O, time, randomness and global state to the edges so the logic is testable.

## Data and types
- Make invalid states unrepresentable: discriminated unions, enums of values, non-optional fields when always present.
- Validate external input once at the boundary and pass typed data inward.
- No magic numbers or strings: named constants next to their use.
- Immutable by default. Mutate only local state you own.

## Errors
- Never swallow an error. Handle it, or propagate it with context saying what failed and with which input.
- Fail fast on broken invariants. One error strategy per layer.

## Structure
- Group by feature, not by technical kind. Keep the public surface minimal; export only what callers use.
- No circular dependencies. Dependencies point from features toward shared core.
- A file beyond ~300-400 lines, or with unrelated responsibilities, is a signal to split.

## Ship working code
- Code and config must run as delivered. Never leave a placeholder such as `[version]`, `<digest>` or `TODO_URL` where a value is expected: read the real value from the project, or use a concrete current value and say in your answer that it should be checked.
- Add only what was asked. No extra endpoint, healthcheck, flag or dependency the request and the code do not call for.

## Leave nothing dead
- No commented-out code, debug logs, unused imports, exports, parameters or flags.
- No TODO without a ticket reference.

## Comments
- Code, comments and messages are in English only.
- Code explains *what* through names and structure. Never comment to paraphrase code.
- A one-line comment is allowed only for a *why* the code cannot show: a workaround with its issue link, an external constraint, a counter-intuitive choice.
- Structured API docs (JSDoc, GoDoc, rustdoc, docstrings) follow the language rules.
