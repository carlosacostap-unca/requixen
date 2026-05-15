## ADDED Requirements

### Requirement: Unauthenticated boundary tests
The system SHALL include automated tests proving protected APIs reject unauthenticated requests.

#### Scenario: Protected API called without token
- **WHEN** an automated test calls a protected API without a bearer token
- **THEN** the test verifies the response status is `401`

### Requirement: Forbidden role tests
The system SHALL include automated tests proving authenticated users cannot perform actions outside their roles.

#### Scenario: Stakeholder forbidden from project creation
- **WHEN** an authenticated stakeholder calls the project creation API
- **THEN** the test verifies the response status is `403`

### Requirement: Project visibility tests
The system SHALL include automated tests proving non-admin users only access projects where they are participants.

#### Scenario: Non-participant requests project messages
- **WHEN** an authenticated non-admin requests messages for a project they do not participate in
- **THEN** the test verifies the response status is `403`

### Requirement: Role mapping tests
The system SHALL include automated or unit-level tests for role normalization from PocketBase records.

#### Scenario: Multi-role record is mapped
- **WHEN** a test maps a PocketBase record with multiple roles
- **THEN** the test verifies all valid roles are preserved
