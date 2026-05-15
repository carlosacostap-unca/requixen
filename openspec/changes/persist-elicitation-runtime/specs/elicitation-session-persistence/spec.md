## ADDED Requirements

### Requirement: Persist project chat sessions
The system SHALL persist elicitation chat sessions as project-scoped records containing session id, project id, title, creator, deleted state, creation timestamp, and update timestamp.

#### Scenario: Session created
- **WHEN** an authenticated project participant creates a new elicitation chat
- **THEN** the system stores a session record for that project and session

### Requirement: Persist session updates
The system SHALL persist session title changes and deleted state without encoding those changes as chat messages.

#### Scenario: Session renamed
- **WHEN** an authenticated project participant renames a chat session
- **THEN** the system updates the session record title and updated timestamp

### Requirement: Exclude deleted sessions by default
The system SHALL exclude deleted sessions from the active room reconstruction unless needed for legacy recovery.

#### Scenario: Session deleted
- **WHEN** a session has deleted state set to true
- **THEN** the reconstructed room does not show the session as an available chat
