## 1. Server Authorization Foundation

- [x] 1.1 Add shared server helpers for bearer parsing, authenticated user lookup, role checks, and project access checks.
- [x] 1.2 Update protected route handlers to use shared auth helpers and remove duplicated token parsing.
- [x] 1.3 Ensure project-scoped APIs derive project data and access from PocketBase instead of trusting client-provided project objects.
- [x] 1.4 Ensure identity-sensitive APIs derive user identity and upload ownership from the bearer token instead of request body fields.
- [x] 1.5 Enforce server-side `admin` or `analyst` role for project creation.
- [x] 1.6 Enforce server-side admin role for user directory, user management, area management, and participant assignment.

## 2. Role Normalization

- [x] 2.1 Update PocketBase user mapping to read `role`, `roles`, `isAdmin`, and legacy-compatible fields.
- [x] 2.2 Preserve valid multi-role arrays and comma/JSON-string role values.
- [x] 2.3 Prevent active role switching to roles not present in the normalized user.
- [x] 2.4 Ensure project participant role mapping stores only valid project roles.

## 3. API Error Contract

- [x] 3.1 Add shared API error helpers for `401`, `403`, `400`, and `500` responses.
- [x] 3.2 Migrate protected route handlers to return stable error codes and messages.
- [x] 3.3 Verify provider failures do not expose secrets or credentials in API responses.
- [x] 3.4 Preserve temporary compatibility for UI code that still reads flat `error` strings, if needed during migration.

## 4. Frontend API Client

- [x] 4.1 Add a frontend API client module for authenticated JSON requests.
- [x] 4.2 Add multipart upload helper that sends bearer auth without overriding multipart `Content-Type`.
- [x] 4.3 Migrate high-risk UI calls for projects, messages, OpenAI responses, audio transcription, uploads, users, and areas to the API client.
- [x] 4.4 Replace the public login user directory table with a privacy-safe login experience.
- [x] 4.5 Confirm demo mode still uses local simulated behavior without protected API calls.

## 5. Test Coverage

- [x] 5.1 Add unauthenticated API boundary tests for protected endpoints.
- [x] 5.2 Add role normalization tests for PocketBase user records.
- [x] 5.3 Add forbidden-action tests for stakeholder project creation and non-admin management APIs.
- [x] 5.4 Add project visibility/access tests for non-participant project messages.
- [x] 5.5 Run `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:e2e`.
