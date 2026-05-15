## ADDED Requirements

### Requirement: Persist detected contributions
The system SHALL persist elicitation contributions with project id, session id, optional source message id, author metadata, body, kind, confidence, and timestamp.

#### Scenario: Contribution detected
- **WHEN** the app detects an elicitation contribution from a chat message
- **THEN** the system stores the contribution as a first-class record

### Requirement: Prefer persisted contributions
The system SHALL prefer persisted contribution records over re-detected contributions when reconstructing the room.

#### Scenario: Contributions already persisted
- **WHEN** persisted contribution records exist for a project
- **THEN** the reconstructed room uses those records instead of duplicating deterministic detections

### Requirement: Contribution fallback
The system SHALL reconstruct contributions from messages when contribution records are unavailable.

#### Scenario: Contribution collection missing
- **WHEN** the contribution collection is unavailable but messages exist
- **THEN** the room still shows deterministic contribution insights derived from messages
