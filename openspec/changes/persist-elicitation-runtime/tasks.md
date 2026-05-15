## 1. Server Runtime Model

- [x] 1.1 Add environment collection names for elicitation contributions and clarifications.
- [x] 1.2 Add shared server-side runtime record types and mappers for sessions, messages, contributions, and clarifications.
- [x] 1.3 Add PocketBase helpers to list runtime records by project with project-access checks.
- [x] 1.4 Add PocketBase helpers to upsert sessions, create messages, create contributions, create clarifications, and answer clarifications.
- [x] 1.5 Ensure missing optional collections return warnings instead of failing complete runtime load.

## 2. Runtime APIs

- [x] 2.1 Add authenticated aggregate runtime GET endpoint for project elicitation room loading.
- [x] 2.2 Add authenticated session persistence endpoint for create/rename/delete.
- [x] 2.3 Add authenticated contribution persistence endpoint.
- [x] 2.4 Add authenticated clarification persistence endpoint for request and response workflows.
- [x] 2.5 Keep the existing messages endpoint compatible with current frontend calls.

## 3. Frontend Integration

- [x] 3.1 Migrate project runtime load to the aggregate runtime endpoint with fallback to legacy messages.
- [x] 3.2 Persist session creation, rename, and delete through first-class session records.
- [x] 3.3 Persist detected contributions as first-class records when messages are sent.
- [x] 3.4 Persist clarification request and response workflows through first-class records.
- [x] 3.5 Prefer persisted contributions and clarifications during room reconstruction.

## 4. Documentation

- [x] 4.1 Update integration docs with new PocketBase collections and fields.
- [x] 4.2 Document fallback behavior when optional runtime collections are missing.

## 5. Tests and Verification

- [x] 5.1 Add tests for runtime mappers and deterministic reconstruction.
- [x] 5.2 Add unauthenticated boundary tests for new runtime endpoints.
- [x] 5.3 Add tests for missing optional collection fallback behavior where practical.
- [x] 5.4 Run `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e`, and `npm.cmd run openspec:validate`.
