## ADDED Requirements

### Requirement: Persist clarification requests
The system SHALL persist clarification requests with project id, session id, question, target user, requester, status, and creation timestamp.

#### Scenario: Analyst sends clarification
- **WHEN** an analyst sends a clarification request to a stakeholder
- **THEN** the system stores a clarification record with status `sent`

### Requirement: Persist clarification responses
The system SHALL persist stakeholder responses with responder metadata, response body, response timestamp, and answered status.

#### Scenario: Stakeholder answers clarification
- **WHEN** a stakeholder submits a clarification response
- **THEN** the system updates the clarification record and marks it answered

### Requirement: Preserve clarification legacy recovery
The system SHALL reconstruct clarification requests and responses from legacy clarification event messages when first-class clarification records are unavailable.

#### Scenario: Only legacy clarification events exist
- **WHEN** the clarification collection is unavailable but legacy clarification messages exist
- **THEN** the room reconstructs the clarification inbox from those messages
