## ADDED Requirements

### Requirement: Protected API authentication
The system SHALL require a valid bearer token for every API that exposes users, project data, elicitation messages, files, OpenAI responses, audio transcription, or project mutations.

#### Scenario: Missing token
- **WHEN** a request without a bearer token calls a protected API
- **THEN** the system returns `401` and does not call PocketBase, OpenAI, Qdrant, or file storage for protected work

### Requirement: Server-side project access
The system SHALL verify project access on the server before returning or mutating project-scoped messages, documents, knowledge, participants, or AI responses.

#### Scenario: Non-participant requests project data
- **WHEN** an authenticated non-admin user is not listed as a participant of a project
- **THEN** the system returns `403` and does not expose that project's data

### Requirement: Server-derived identity
The system SHALL derive authenticated user identity, project access, and upload ownership from the bearer token instead of trusting client-provided `user`, `project`, or `uploadedBy` values.

#### Scenario: Spoofed user payload
- **WHEN** an authenticated user sends a request body claiming another user identity
- **THEN** the system uses the identity associated with the bearer token

### Requirement: Role-gated project creation
The system SHALL allow only users with `admin` or `analyst` role to create projects through the API.

#### Scenario: Stakeholder creates project
- **WHEN** an authenticated stakeholder calls the project creation API
- **THEN** the system returns `403` and no project is created

### Requirement: Admin-only management APIs
The system SHALL restrict user management, municipal area management, participant assignment, and user directory listing to authenticated admin users.

#### Scenario: Non-admin manages users
- **WHEN** an authenticated non-admin calls a user management API
- **THEN** the system returns `403` and no user data is changed
