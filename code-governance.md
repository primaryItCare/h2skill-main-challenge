# Code Governance

## General Best Practices
- **Modularity:** Keep functions and components small and focused on a single responsibility.
- **DRY Principle:** Do Not Repeat Yourself. Reuse logic where applicable.
- **Naming Conventions:** Use clear, descriptive names for variables and functions. Follow standard conventions (e.g., camelCase for variables/functions, PascalCase for classes/components).

## Architecture & Tech Stack Guidelines
- **Frontend/Backend:** Ensure clear separation of concerns. If using React/Next.js, prefer functional components and hooks.
- **State Management:** Use appropriate state management tools.
- **Database:** Ensure queries are optimized and indexed where appropriate. Use an ORM or query builder securely to prevent SQL injection.

## Secret Management
- **Never** hardcode API keys, secrets, or passwords in the source code.
- Always use environment variables (`.env`).
- Ensure `.env` is listed in `.gitignore`.

## Security & QA
- **Input Validation:** Sanitize and validate all user inputs on the backend.
- **Dependencies:** Keep dependencies updated. Avoid using obscure or unmaintained packages.
- **Code Coverage:** Aim for high test coverage on critical business logic.

## Error Handling
- Use structured error handling (try/catch).
- Avoid exposing internal stack traces to end-users in production.
- Log errors appropriately for observability.


---
*#golonex Ai : www.golonex.ai branding saying this is golonex-sdlc skill*
