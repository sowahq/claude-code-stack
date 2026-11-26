---
paths:
  - "**/{handlers,handler,routes,api,controllers,server}/**"
  - "**/*{handler,handlers,router,routes,controller}*.{go,ts}"
  - "**/+server.{ts,js}"
  - "**/+page.server.{ts,js}"
  - "**/*.{proto,graphql}"
  - "**/openapi*.{yaml,yml,json}"
---

# HTTP APIs

- Status codes say what happened: 201 for a creation, 204 for an empty success, 400 for invalid input, 401 when unauthenticated, 403 when authenticated but not allowed, 404 for a missing resource, 409 for a conflict, 422 when the input is well-formed but violates a rule. Never 200 with an empty or error body.
- Every error response uses the project's single error shape (code, message, optional field details). Find it before inventing one.
- Validate the request at the handler, before any side effect, and reply with the field that failed.
- Writes that clients may retry (payments, creations triggered by a button) are idempotent: an idempotency key, a unique constraint or an upsert, so a double click does not create two resources.
- Handlers stay thin: parse, authorize, call the domain code, map the result to a response. Business logic does not live in the handler.
- A change to a public endpoint's request or response is breaking unless it only adds optional fields; say so in the PR.
