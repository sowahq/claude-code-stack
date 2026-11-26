---
globs: ["**/*.js", "**/*.mjs", "**/*.cjs"]
description: JavaScript coding standards, modern ES6+ syntax, and clean code rules
---

# JavaScript Rules
- **Modern Syntax**: ALWAYS use ES6+ features (arrow functions, destructuring, spread operator, template literals). Use `const` by default, `let` only when necessary. NEVER use `var`.
- **JSDoc Documentation**: Use JSDoc to document functions, parameters, and return types. This provides pseudo-type safety and better IDE support.
- **Async/Await**: Prefer `async/await` over raw Promises or callbacks for asynchronous logic.
- **Functional Patterns**: Favor functional programming patterns like `map`, `filter`, `reduce`, and `find` over traditional `for` loops where appropriate.
- **Modules**: Use ESM (`import`/`export`) by default unless the environment strictly requires CommonJS (`require`).
- **Clean Code**: Keep functions small and focused on a single responsibility. Use descriptive variable names.
- **No Global Scope**: Avoid polluting the global namespace. Use modules or closures to encapsulate logic.
- **Error Handling**: Use `try/catch` blocks for error-prone operations and provide meaningful error messages.
