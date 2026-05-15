## Why

Requixen is moving from a functional MVP toward a tool that can safely operate with real PocketBase, OpenAI, uploaded documents, and project data. The next foundation cut should make access control, role handling, API failures, and permission tests explicit so future product features do not inherit demo-only assumptions.

## What Changes

- Require authenticated server-side access checks for all APIs that expose users, project data, OpenAI usage, audio transcription, files, messages, or project mutations.
- Enforce role-based permissions on the server for project creation, admin operations, project access, and phase actions.
- Normalize PocketBase `role` and `roles` fields so multi-role users behave consistently across UI and APIs.
- Replace the public login user directory with a privacy-safe access experience.
- Standardize API error responses for unauthenticated, forbidden, invalid, and unexpected failures.
- Add a frontend API client layer for bearer token handling, JSON parsing, and error normalization.
- Add tests covering authentication boundaries and core permission decisions.

## Capabilities

### New Capabilities

- `api-access-control`: Server-side authentication, authorization, and project access rules for Requixen APIs.
- `role-aware-users`: Consistent handling of PocketBase roles, multi-role users, active role switching, and role-derived permissions.
- `api-error-contract`: Stable API error response shape and status codes for UI handling and tests.
- `frontend-api-client`: Shared client-side API access helpers for authenticated requests and normalized errors.
- `permission-test-coverage`: Automated tests for unauthenticated access, forbidden role actions, and project visibility boundaries.

### Modified Capabilities

- None.

## Impact

- Affected APIs: `app/api/auth/user-directory`, `app/api/auth/login`, `app/api/projects`, `app/api/projects/[projectId]/*`, `app/api/users`, `app/api/areas`, `app/api/elicitation/*`, `app/api/files/upload`, `app/api/audio/transcribe`.
- Affected server modules: `lib/requixen/server/pocketbase.ts`, `lib/requixen/server/openai.ts`, and any new authorization/error helpers.
- Affected frontend: `app/requixen-workspace.tsx` and any extracted API client module.
- Affected tests: Playwright API/UI tests under `tests/e2e`.
- No new external dependencies are expected.
