## Context

Requixen currently supports demo mode plus real PocketBase/OpenAI/Qdrant integrations. The MVP already has route handlers, bearer-token calls, role-aware UI, project participants, document uploads, elicitation messages, and OpenAI-mediated responses. The weak points are that some API decisions still rely on client-provided objects or UI-only permission checks, and the frontend repeats request/error handling directly in a large workspace component.

This change hardens the foundation for real municipal usage while preserving demo mode for local validation.

## Goals / Non-Goals

**Goals:**

- Make server-side authorization the source of truth for protected routes.
- Normalize PocketBase roles consistently, including multi-role users.
- Provide stable API errors that the UI and tests can rely on.
- Introduce a small frontend API client to centralize bearer token and error handling.
- Add tests that prove sensitive endpoints and role boundaries are enforced.

**Non-Goals:**

- Replacing PocketBase authentication with a custom session or cookie system.
- Implementing full rate limiting, audit persistence, or advanced threat detection.
- Rebuilding the UI architecture beyond API-client extraction.
- Implementing phases 2, 3, and 4 as full product screens.

## Decisions

### Decision 1: Keep bearer token auth for this cut

Route handlers will continue receiving the PocketBase bearer token from the frontend and validating it server-side through PocketBase. This fits the current architecture and avoids introducing cookie/session migration before the product model is stable.

Alternative considered: move to httpOnly app sessions immediately. That would improve browser token handling, but it is a larger migration and would distract from closing server-side permission gaps first.

### Decision 2: Centralize authorization helpers

Server code will use helpers such as `bearerToken`, `requireAuthenticatedUser`, `requireRole`, `requireAnyRole`, and `requireProjectAccess`. Route handlers should avoid duplicating token parsing or directly trusting `user`, `project`, `participants`, or `uploadedBy` values from request bodies.

Alternative considered: keep authorization inline in each route. That is simpler locally, but it has already led to inconsistent checks.

### Decision 3: Server-derived identity overrides client identity

Protected APIs may accept client context needed for UX, such as active role or recent messages, but identity, project access, project data, and upload ownership must be derived from PocketBase on the server.

Alternative considered: validate that the client-provided user matches the token. Server-derived identity is simpler and safer.

### Decision 4: Standardize API errors without overbuilding

Route handlers will return `{ error: { code, message } }` or a compatibility wrapper while the UI migrates. Status codes must distinguish `401`, `403`, `400`, and `500`.

Alternative considered: introduce a full error class hierarchy immediately. A small helper is enough for this cut.

### Decision 5: Extract a minimal frontend API client

The UI should call shared helpers for authenticated JSON, multipart upload, and response parsing. This reduces repeated `fetch` setup in `requixen-workspace.tsx` and makes later component extraction easier.

Alternative considered: defer all frontend cleanup. That would keep the app working but make each new feature repeat auth/error boilerplate.

## Risks / Trade-offs

- Auth checks can break demo flows -> Keep demo mode paths local and only call protected APIs when a token exists.
- PocketBase schemas may vary between deployments -> Normalize `role`, `roles`, `isAdmin`, and JSON/string role values defensively.
- Existing UI may expect flat `{ error: string }` responses -> Migrate carefully or provide compatibility during this cut.
- E2E tests may require real credentials for full role coverage -> Start with unauthenticated boundary tests and add fixture-based/mockable tests for roles.
- Frontend extraction can become a broad refactor -> Keep API client focused on request/error behavior only.

## Migration Plan

1. Add server authorization and error helpers.
2. Update protected route handlers to use server-derived identity and project access.
3. Correct PocketBase role normalization.
4. Replace the login user directory with a privacy-safe experience.
5. Add frontend API client helpers and migrate high-risk calls first.
6. Add/expand tests for unauthorized and forbidden access.
7. Run lint, build, and e2e tests.

Rollback is straightforward because changes are localized to route handlers, server helpers, frontend request calls, and tests. If needed, revert the API client migration while keeping server authorization helpers intact.

## Open Questions

- Should the next cut move bearer tokens into httpOnly cookies for stronger browser-side protection?
- Should demo profiles remain visible when PocketBase is configured, or only when integration mode is unavailable?
- What exact PocketBase schema should become the canonical source for `roles`: JSON field, select field, or text field containing JSON?
