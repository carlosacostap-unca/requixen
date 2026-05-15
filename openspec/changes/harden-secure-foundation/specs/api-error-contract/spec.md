## ADDED Requirements

### Requirement: Stable error response shape
The system SHALL return API errors in a stable machine-readable shape containing an error code and human-readable message.

#### Scenario: Invalid request payload
- **WHEN** a protected API receives an invalid request payload
- **THEN** the response includes an error code and message suitable for UI display or logging

### Requirement: Authentication status codes
The system SHALL return `401` for missing or invalid authentication and `403` for authenticated users without permission.

#### Scenario: Authenticated user lacks permission
- **WHEN** an authenticated user calls an API they are not allowed to use
- **THEN** the system returns `403`

### Requirement: Validation status code
The system SHALL return `400` for malformed or incomplete request data.

#### Scenario: Required field missing
- **WHEN** a request omits a required field
- **THEN** the system returns `400`

### Requirement: Unexpected failure status code
The system SHALL return `500` for unexpected server-side failures without exposing secrets or provider credentials.

#### Scenario: Provider failure
- **WHEN** PocketBase, OpenAI, Qdrant, or file storage fails unexpectedly
- **THEN** the system returns `500` with a safe error message
