# Security

- Secrets come from environment variables or a secret store, never from code, fixtures or logs. `.env` files stay in `.gitignore`.
- Validate external input once, at the boundary where it enters (request handler, CLI parser, message consumer), with the project's schema library, and pass typed data inward.
- Build SQL with parameters or the ORM's query builder. String concatenation into a query is a vulnerability even for "trusted" values.
- Check authorization on the server for every action and for every identifier the client sends: loading `/orders/:id` must verify the order belongs to the caller. Hiding a button is not access control.
- Treat user-supplied URLs and paths as hostile: restrict outbound requests to expected hosts (SSRF), and resolve paths against a fixed root before reading or writing (path traversal).
- Rendered user content goes through the framework's escaping. Every `{@html}`, `innerHTML` or equivalent needs sanitized input.
- Logs and error messages carry no secrets, tokens or personal data. Errors returned to clients do not expose stack traces or internal paths.
- A new dependency needs a reason: check its maintenance and known vulnerabilities before adding it.
