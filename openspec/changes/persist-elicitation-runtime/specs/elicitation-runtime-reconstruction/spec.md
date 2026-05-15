## ADDED Requirements

### Requirement: Load complete elicitation runtime
The system SHALL provide an authenticated project-scoped load path that reconstructs sessions, messages, attachments, contributions, and clarifications for the elicitation room.

#### Scenario: Project room opened
- **WHEN** an authenticated participant opens a project
- **THEN** the system returns a reconstructed elicitation runtime for that project

### Requirement: Create default room when empty
The system SHALL create or return a default welcome session when a project has no persisted elicitation runtime.

#### Scenario: New project has no runtime
- **WHEN** a project has no persisted sessions or messages
- **THEN** the reconstructed room contains a default welcome session

### Requirement: Deterministic ordering
The system SHALL order sessions and messages deterministically using persisted timestamps and update timestamps.

#### Scenario: Multiple sessions exist
- **WHEN** a project has multiple persisted sessions
- **THEN** the reconstructed room orders them consistently by latest activity

### Requirement: Integration warnings
The system SHALL expose non-fatal warnings when optional runtime collections are unavailable while still returning available runtime data.

#### Scenario: Optional collection missing
- **WHEN** an optional persistence collection is missing
- **THEN** the runtime response includes available data and a warning instead of failing the entire load
