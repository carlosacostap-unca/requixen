## ADDED Requirements

### Requirement: Authenticated JSON requests
The system SHALL provide a frontend API helper for JSON requests that attaches the bearer token when present and normalizes success and error responses.

#### Scenario: Authenticated request
- **WHEN** the UI calls a protected JSON API with an auth token
- **THEN** the helper sends the `Authorization: Bearer <token>` header

### Requirement: Multipart upload requests
The system SHALL provide a frontend API helper for multipart upload requests that attaches the bearer token without overriding browser-generated multipart boundaries.

#### Scenario: File upload
- **WHEN** the UI uploads files through the helper
- **THEN** the helper sends authorization and leaves `Content-Type` unset for the browser to generate

### Requirement: Centralized API error handling
The system SHALL parse API errors consistently so UI code can display stable messages without duplicating response parsing.

#### Scenario: API returns error
- **WHEN** an API responds with a non-OK status
- **THEN** the helper returns or throws a normalized error containing status, code, and message

### Requirement: Demo mode compatibility
The system SHALL preserve local demo flows that do not require a bearer token.

#### Scenario: Demo user sends local-only action
- **WHEN** the app runs in demo mode without a token
- **THEN** local simulated actions continue without calling protected real-mode APIs
