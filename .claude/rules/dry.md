# DRY / factorization

- Before writing a block that resembles existing code, search for it and reuse
  or extract a shared function/component instead of copy-pasting.
- If the same logic appears 2+ times, factor it out (helper, hook, component,
  util) rather than repeating it. Name it clearly and put it where similar
  shared code lives.
- Prefer a small abstraction over duplicated boilerplate — but don't
  over-abstract a single use. The trigger is repetition, not anticipation.