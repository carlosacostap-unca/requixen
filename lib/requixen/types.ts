export type Locale = "es" | "en";

export type LayerId = "mediator" | "cocreator" | "facilitator" | "assistant";

export type ReviewStatus = "draft" | "proposed" | "approved" | "needs-review";

export type ProjectStatus = "intake" | "elicitation" | "analysis" | "negotiation" | "validation";

export type UserRole = "admin" | "analyst" | "stakeholder" | "validator";
export type ProjectRole = Exclude<UserRole, "admin">;

export type RiskKind =
  | "hallucination"
  | "domain-bias"
  | "context-loss"
  | "traceability";

export interface InstitutionalRequest {
  templateId?: string;
  templateName?: string;
  requestingArea: string;
  receivingArea: string;
  contactPerson: string;
  requestedAction: string;
  targetPopulation: string;
  urgency: "low" | "medium" | "high";
}

export interface Layer {
  id: LayerId;
  phase: string;
  role: string;
  genAiRole: string;
  control: string;
  input: string;
  output: string;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  municipality: string;
  areaId?: string;
  summary: string;
  transcript: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  documents: AttachedDocument[];
  participants: ProjectParticipant[];
  institutionalRequest?: InstitutionalRequest;
}

export interface ProjectParticipant {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  areaId?: string;
  areaName?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  role: UserRole;
  roles: UserRole[];
  organization: string;
  areaId: string;
  areaName: string;
}

export interface MunicipalArea {
  id: string;
  name: string;
  code: string;
  description: string;
  parentAreaId: string;
  parentAreaName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleProfile {
  role: UserRole;
  label: string;
  description: string;
  allowedLayers: LayerId[];
  permissions: {
    createProjects: boolean;
    generateArtifacts: boolean;
    approveArtifacts: boolean;
    runValidation: boolean;
    viewRisk: boolean;
    manageUsers: boolean;
  };
}

export interface AttachedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  origin: "seed" | "upload";
  url?: string;
  storageRecordId?: string;
  projectId?: string;
  sessionId?: string;
  indexingStatus?: "indexed" | "skipped" | "failed";
  indexingDetail?: string;
  indexedChunks?: number;
}

export interface ChatMessage {
  id: string;
  role: "analyst" | "mediator";
  body: string;
  timestamp: string;
}

export interface ElicitationContribution {
  id: string;
  authorName: string;
  authorRole: UserRole | "mediator-ai";
  body: string;
  kind: "need" | "constraint" | "question" | "synthesis" | "risk-note";
  timestamp: string;
  sourceMessageId?: string;
  confidence?: number;
}

export interface ElicitationChatMessage {
  id: string;
  authorName: string;
  authorRole: UserRole | "mediator-ai";
  body: string;
  timestamp: string;
  stream?: boolean;
}

export interface ElicitationChatSession {
  id: string;
  title: string;
  createdBy: string;
  messages: ElicitationChatMessage[];
  attachments: AttachedDocument[];
  createdAt: string;
  updatedAt: string;
}

export type ClarificationStatus = "draft" | "sent" | "answered" | "closed";

export interface ClarificationRequest {
  id: string;
  projectId: string;
  question: string;
  targetUserId: string;
  targetName: string;
  requestedBy: string;
  requestedByName: string;
  status: ClarificationStatus;
  createdAt: string;
  sentAt?: string;
  response?: string;
  respondedBy?: string;
  respondedByName?: string;
  respondedAt?: string;
}

export interface ElicitationRoomState {
  activeSessionId: string;
  sessions: ElicitationChatSession[];
  contributions: ElicitationContribution[];
  attachments: AttachedDocument[];
  clarifications: ClarificationRequest[];
}

export interface Artifact {
  id: string;
  layerId: LayerId;
  title: string;
  type: string;
  body: string;
  status: ReviewStatus;
  confidence: number;
  source: string;
  generatedBy: string;
  assumptions?: string;
}

export interface RiskFlag {
  id: string;
  artifactId: string;
  layerId: LayerId;
  kind: RiskKind;
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

export interface TraceLink {
  id: string;
  fromArtifactId?: string;
  fromEvidenceId?: string;
  fromLabel?: string;
  toArtifactId: string;
  relation: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  layerId: LayerId;
  action: string;
  actor: string;
}

export interface LayerGeneration {
  artifacts: Artifact[];
  risks: RiskFlag[];
  traces: TraceLink[];
  audit: AuditEntry[];
}
