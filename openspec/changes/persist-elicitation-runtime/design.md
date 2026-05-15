## Context

The elicitation room currently persists messages opportunistically in `requixen_elicitation_messages`, while session metadata and clarification events are encoded as special message kinds. Contributions are reconstructed mostly from message content and local deterministic detection. This was enough for the MVP, but it makes reloads, multi-user collaboration, clarification tracking, and later traceability brittle.

The hardened foundation already requires authenticated APIs and server-side project access checks. This change builds on that foundation by making Phase 1 runtime records explicit.

## Goals / Non-Goals

**Goals:**

- Store sessions, messages, contributions, and clarifications as first-class PocketBase records.
- Reconstruct an elicitation room deterministically on project load.
- Preserve current UI flows for creating chats, renaming/deleting chats, sending messages, attaching files, synthesizing, and clarifications.
- Keep fallback behavior when optional collections are missing so demos and incremental PocketBase setup still work.
- Keep project access enforcement server-side for all runtime reads/writes.

**Non-Goals:**

- Implementing real-time subscriptions.
- Implementing full audit/event sourcing.
- Persisting downstream Analysis, Negotiation, Validation artifacts.
- Replacing PocketBase with a different database.
- Redesigning the elicitation UI.

## Decisions

### Decision 1: Introduce explicit runtime collections

Use separate collections for sessions, messages, contributions, and clarifications. This avoids overloading message records with session metadata or workflow events.

Alternative considered: keep encoding everything into messages. That preserves fewer collections, but makes querying and reconstruction ambiguous.

### Decision 2: Add one runtime aggregate endpoint

Add an authenticated project-scoped API that returns the complete elicitation runtime for a project. The frontend should prefer this endpoint, while the existing messages endpoint can remain temporarily for compatibility.

Alternative considered: frontend calls four separate APIs. That increases request count and leaves more reconstruction logic in the client.

### Decision 3: Keep writes granular

Use granular write APIs/actions for session metadata, messages, contributions, and clarifications so UI interactions can persist independently and fail gracefully.

Alternative considered: save the whole room as one JSON blob. That is simpler but creates conflict risk when multiple users participate.

### Decision 4: Tolerate missing optional collections

If a new runtime collection does not exist or rejects records, the API should return available data and include an integration warning rather than breaking the whole room. This matches the current incremental integration style.

Alternative considered: fail hard until all collections exist. That would be stricter, but would make local and partial deployments painful.

### Decision 5: Preserve deterministic fallback reconstruction

When contributions or clarifications are not yet persisted, the app may reconstruct them from persisted messages using the current deterministic logic. Persisted first-class records should take precedence.

Alternative considered: remove fallback immediately. That risks data loss for existing deployments that only have messages.

## Risks / Trade-offs

- Multiple collections require PocketBase setup -> Document required fields and tolerate missing collections.
- Partial writes can create inconsistent runtime state -> Aggregate loader deduplicates and falls back where possible.
- No real-time sync yet -> Users see persisted state on load/reload, not live updates from other browsers.
- Client component remains large -> Keep implementation focused on persistence paths; broad UI modularization belongs to a later cut.
- Existing message records include metadata events -> Loader must continue to understand legacy `session-meta` and clarification event messages.

## Migration Plan

1. Add environment collection names for contributions and clarifications.
2. Add server-side runtime mappers and PocketBase helpers.
3. Add runtime aggregate GET endpoint and granular POST/PATCH endpoints where needed.
4. Migrate frontend loading to runtime aggregate endpoint with fallback to existing message reconstruction.
5. Persist session create/rename/delete as session records.
6. Persist messages, detected contributions, and clarification events as first-class records.
7. Update integration docs with collection fields.
8. Add tests for mappers/reconstruction and protected runtime API boundaries.

## Open Questions

- Should future real-time collaboration use PocketBase realtime subscriptions or periodic refresh?
- Should confidence scores for deterministic contributions be stored as model output or computed metadata?
- Should clarification records eventually drive notifications for targeted stakeholders?
