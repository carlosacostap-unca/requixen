## Why

The current elicitation room mixes local runtime state with partial message persistence, which makes real PocketBase usage fragile after reloads and across users. Persisting the elicitation runtime as first-class project data turns Phase 1 into a reliable collaborative workspace instead of a mostly in-memory demo.

## What Changes

- Persist elicitation chat sessions as their own records rather than encoding session metadata as special messages.
- Persist chat messages with session/project ownership and reconstruct them on project load.
- Persist detected contributions with kind, source message, confidence, timestamp, and author metadata.
- Persist clarification requests and responses as first-class records with status and target user metadata.
- Preserve graceful fallback when optional PocketBase collections are not configured or not yet created.
- Keep the current UI behavior while replacing in-memory-only reconstruction paths with persisted runtime loading.
- Add tests for runtime reconstruction and protected persistence boundaries.

## Capabilities

### New Capabilities

- `elicitation-session-persistence`: Persistent chat sessions per project, including title, active/deleted state, creator, and timestamps.
- `elicitation-message-persistence`: Persistent project/session messages with secure reconstruction on project load.
- `elicitation-contribution-persistence`: Persistent detected contributions with source, kind, confidence, and author data.
- `clarification-persistence`: Persistent clarification requests/responses with assignee, status, and response metadata.
- `elicitation-runtime-reconstruction`: Deterministic reconstruction of the complete elicitation room from persisted records with fallback behavior.

### Modified Capabilities

- None.

## Impact

- Affected APIs: `app/api/elicitation/messages`, new or expanded elicitation runtime endpoints, and any session/contribution/clarification routes.
- Affected server modules: PocketBase helpers, auth/project access helpers, and new runtime mapping helpers.
- Affected frontend: `app/requixen-workspace.tsx`, especially session creation/rename/delete, message send, contribution detection, clarification workflows, and room loading.
- Affected docs: integration documentation should describe new PocketBase collections and fields.
- No new external dependencies are expected.
