---
globs: ["**/*", "!.git/**"]
description: Security standards to prevent vulnerabilities and data leaks
---

# Security Rules
- **Secret Management**: NEVER hardcode API keys, passwords, or tokens. Use environment variables and ensure `.env` files are in `.gitignore`.
- **Input Validation**: Systematically validate all user inputs at the boundary. Use validation libraries (e.g., Zod, Valibot) for TypeScript and robust validation tags/logic for Go.
- **SQL Injection**: Never concatenate strings to build queries. Use prepared statements or safe ORM methods.
- **XSS & Sanitization**: Ensure all user-generated content is sanitized before rendering. Trust Svelte's auto-escaping but be careful with `{@html ...}`.
- **Authentication/Authorization**: Always verify user permissions on the server side, even if the UI hides certain elements.
- **Dependency Audit**: Regularly check for vulnerable packages and suggest updates. Be cautious with new, obscure dependencies.
- **CORS & Headers**: Enforce strict CORS policies and suggest security headers (HSTS, CSP, X-Frame-Options).
