## ADDED Requirements

### Requirement: PocketBase role normalization
The system SHALL normalize PocketBase user records into Requixen `role`, `roles`, and `isAdmin` values using `role`, `roles`, `isAdmin`, and compatible legacy fields.

#### Scenario: User has roles array
- **WHEN** a PocketBase user record includes `roles` as an array containing `admin` and `analyst`
- **THEN** the mapped Requixen user includes both roles and can activate either role

### Requirement: Multi-role active role switching
The system SHALL allow a user to switch active role only to a role present in that user's normalized `roles` list.

#### Scenario: User selects unauthorized role
- **WHEN** a user attempts to activate a role not included in their normalized roles
- **THEN** the system keeps the previous active role

### Requirement: Role-derived permissions
The system SHALL derive UI permissions and server authorization decisions from normalized Requixen roles.

#### Scenario: Analyst permissions
- **WHEN** a user has normalized role `analyst`
- **THEN** the system allows analyst actions and does not collapse the user to stakeholder behavior

### Requirement: Participant role compatibility
The system SHALL map project participant roles to `analyst`, `stakeholder`, or `validator`, and SHALL NOT store `admin` as a project participant role.

#### Scenario: Admin is assigned to a project
- **WHEN** an admin user is added as a participant
- **THEN** the participant role is stored as a valid project role
