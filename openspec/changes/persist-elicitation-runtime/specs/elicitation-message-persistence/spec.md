## ADDED Requirements

### Requirement: Persist elicitation messages
The system SHALL persist each elicitation chat message with project id, session id, author metadata, body, kind, and timestamp.

#### Scenario: User sends message
- **WHEN** an authenticated project participant sends a message in an elicitation session
- **THEN** the system persists the message under that project and session

### Requirement: Secure message listing
The system SHALL return persisted messages only after verifying server-side project access.

#### Scenario: Non-participant requests messages
- **WHEN** an authenticated non-participant requests messages for a project
- **THEN** the system returns `403`

### Requirement: Preserve legacy message compatibility
The system SHALL continue reading existing message records created before first-class sessions, contributions, and clarifications exist.

#### Scenario: Only legacy messages exist
- **WHEN** a project has message records but no session records
- **THEN** the system reconstructs sessions from message session ids and legacy metadata where available
