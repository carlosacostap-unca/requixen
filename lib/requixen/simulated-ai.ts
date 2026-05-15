import type {
  Artifact,
  AuditEntry,
  LayerGeneration,
  LayerId,
  Project,
  RiskFlag,
  TraceLink,
} from "./types";

type ArtifactSeed = Omit<Artifact, "status">;
type RiskSeed = RiskFlag;
type TraceSeed = TraceLink;

const artifactSeeds: Record<LayerId, ArtifactSeed[]> = {
  mediator: [
    {
      id: "req-01",
      layerId: "mediator",
      title: "REQ-01",
      type: "Raw requirement",
      body: "The system shall allow citizens to register infrastructure complaints.",
      confidence: 0.92,
      source: "Interview transcript: paper form for potholes or broken streetlights.",
      generatedBy: "Mediator",
    },
    {
      id: "req-02",
      layerId: "mediator",
      title: "REQ-02",
      type: "Raw requirement",
      body: "The system shall notify Public Works when a complaint is registered.",
      confidence: 0.88,
      source: "Interview transcript: form is taken to Public Works.",
      generatedBy: "Mediator",
    },
    {
      id: "req-03",
      layerId: "mediator",
      title: "REQ-03",
      type: "Raw requirement",
      body: "The system shall track the resolution status of complaints.",
      confidence: 0.84,
      source: "Interview transcript: citizens call back asking what is going on.",
      generatedBy: "Mediator",
    },
    {
      id: "req-04",
      layerId: "mediator",
      title: "REQ-04",
      type: "Raw requirement",
      body: "The system shall allow citizens to check the status of their complaints.",
      confidence: 0.7,
      source: "Inferred from repeated citizen status calls.",
      generatedBy: "Mediator",
    },
    {
      id: "glossary-complaint",
      layerId: "mediator",
      title: "Complaint",
      type: "Glossary entry",
      body: "Report initiated by a citizen about a municipal infrastructure issue requiring intervention.",
      confidence: 0.9,
      source: "Synthesized from the municipal scenario.",
      generatedBy: "Mediator",
    },
    {
      id: "clarify-photo",
      layerId: "mediator",
      title: "Clarifying question",
      type: "Clarification log",
      body: "Should citizens be able to attach photographs of the issue?",
      confidence: 0.82,
      source: "Derived from complaint registration workflow.",
      generatedBy: "Mediator",
    },
  ],
  cocreator: [
    {
      id: "story-citizen-submit",
      layerId: "cocreator",
      title: "Citizen complaint submission",
      type: "User story",
      body: "As a citizen, I want to submit a complaint with a description and an optional photo, so that the municipality can identify and address the issue.",
      confidence: 0.86,
      source: "REQ-01 and clarification log.",
      generatedBy: "Co-creator",
    },
    {
      id: "ac-citizen-submit",
      layerId: "cocreator",
      title: "Submission acceptance criteria",
      type: "Acceptance criteria",
      body: "The form includes location, category, description and optional photo. On submission, the citizen receives a tracking number. Public Works receives a notification within 5 minutes.",
      confidence: 0.78,
      source: "REQ-01, REQ-02 and scenario assumptions.",
      generatedBy: "Co-creator",
    },
    {
      id: "ambiguity-notify",
      layerId: "cocreator",
      title: "Undefined notification channel",
      type: "Ambiguity flag",
      body: "REQ-02 specifies notification but does not define whether the channel is email, dashboard alert, SMS or push notification.",
      confidence: 0.91,
      source: "REQ-02.",
      generatedBy: "Co-creator",
    },
    {
      id: "gap-prioritization",
      layerId: "cocreator",
      title: "Missing prioritization and escalation policy",
      type: "Gap report",
      body: "No requirement addresses complaint prioritization, response time commitments or escalation procedures.",
      confidence: 0.83,
      source: "Raw requirement set.",
      generatedBy: "Co-creator",
    },
  ],
  facilitator: [
    {
      id: "conflict-priority",
      layerId: "facilitator",
      title: "Priority conflict",
      type: "Conflict matrix",
      body: "Public Works prefers severity-based prioritization. Citizen Service prefers chronological processing to preserve perceived fairness.",
      confidence: 0.87,
      source: "Gap report and stakeholder priorities.",
      generatedBy: "Facilitator",
    },
    {
      id: "tradeoff-options",
      layerId: "facilitator",
      title: "Resolution options",
      type: "Trade-off analysis",
      body: "Option A: severity-based. Option B: chronological. Option C: hybrid two-tier system where safety-critical complaints are prioritized and all others follow submission order.",
      confidence: 0.82,
      source: "Priority conflict.",
      generatedBy: "Facilitator",
    },
    {
      id: "agreement-hybrid",
      layerId: "facilitator",
      title: "Agreed requirement",
      type: "Compromise proposal",
      body: "Safety-critical complaints shall be prioritized regardless of submission order; non-critical complaints shall be processed chronologically.",
      confidence: 0.85,
      source: "Option C selected by stakeholders in the scenario.",
      generatedBy: "Facilitator",
    },
  ],
  assistant: [
    {
      id: "validation-report",
      layerId: "assistant",
      title: "Completeness and consistency report",
      type: "Validation report",
      body: "REQ-03 lacks a corresponding user story. Photo upload criteria lack max file size and accepted formats. REQ-02 notification mechanism remains undefined. Non-functional requirements have not been specified.",
      confidence: 0.9,
      source: "Agreed requirements and generated artifacts.",
      generatedBy: "Assistant",
    },
    {
      id: "traceability-matrix",
      layerId: "assistant",
      title: "Traceability matrix",
      type: "Traceability matrix",
      body: "REQ-01 maps to citizen complaint submission and submission acceptance criteria. REQ-02 maps to notification ambiguity. The hybrid prioritization agreement maps to the priority conflict.",
      confidence: 0.81,
      source: "Artifact provenance metadata.",
      generatedBy: "Assistant",
    },
    {
      id: "issue-list",
      layerId: "assistant",
      title: "Residual issue list",
      type: "Issue list",
      body: "Define notification channel, add status tracking story, specify upload constraints and capture performance, availability and accessibility requirements.",
      confidence: 0.88,
      source: "Validation report.",
      generatedBy: "Assistant",
    },
  ],
};

const riskSeeds: Record<LayerId, RiskSeed[]> = {
  mediator: [
    {
      id: "risk-req-04",
      artifactId: "req-04",
      layerId: "mediator",
      kind: "hallucination",
      label: "Potential inferred requirement",
      detail: "The transcript mentions citizens calling back, but does not explicitly request a self-service status query.",
      severity: "medium",
      confidence: 0.7,
    },
  ],
  cocreator: [
    {
      id: "risk-ac-channel",
      artifactId: "ac-citizen-submit",
      layerId: "cocreator",
      kind: "domain-bias",
      label: "Operational assumption",
      detail: "A 5-minute notification target is plausible but not stated by the stakeholder.",
      severity: "medium",
      confidence: 0.62,
    },
    {
      id: "risk-ambiguity-notify",
      artifactId: "ambiguity-notify",
      layerId: "cocreator",
      kind: "traceability",
      label: "Needs source confirmation",
      detail: "Notification channel must be confirmed before downstream design decisions.",
      severity: "low",
      confidence: 0.91,
    },
  ],
  facilitator: [
    {
      id: "risk-tradeoff-estimate",
      artifactId: "tradeoff-options",
      layerId: "facilitator",
      kind: "domain-bias",
      label: "No empirical estimate",
      detail: "Trade-off claims should be validated with municipal service data before commitment.",
      severity: "medium",
      confidence: 0.66,
    },
  ],
  assistant: [
    {
      id: "risk-traceability-matrix",
      artifactId: "traceability-matrix",
      layerId: "assistant",
      kind: "traceability",
      label: "Trace links require analyst review",
      detail: "Generated traceability links are useful candidates, not authoritative evidence.",
      severity: "high",
      confidence: 0.74,
    },
  ],
};

const traceSeeds: Record<LayerId, TraceSeed[]> = {
  mediator: [],
  cocreator: [
    {
      id: "trace-req01-story",
      fromArtifactId: "req-01",
      toArtifactId: "story-citizen-submit",
      relation: "refined into",
    },
    {
      id: "trace-req02-ambiguity",
      fromArtifactId: "req-02",
      toArtifactId: "ambiguity-notify",
      relation: "flagged by",
    },
  ],
  facilitator: [
    {
      id: "trace-gap-conflict",
      fromArtifactId: "gap-prioritization",
      toArtifactId: "conflict-priority",
      relation: "triggered",
    },
    {
      id: "trace-conflict-agreement",
      fromArtifactId: "conflict-priority",
      toArtifactId: "agreement-hybrid",
      relation: "resolved by",
    },
  ],
  assistant: [
    {
      id: "trace-agreement-validation",
      fromArtifactId: "agreement-hybrid",
      toArtifactId: "validation-report",
      relation: "validated by",
    },
    {
      id: "trace-report-issues",
      fromArtifactId: "validation-report",
      toArtifactId: "issue-list",
      relation: "produced",
    },
  ],
};

const actions: Record<LayerId, string> = {
  mediator: "Mediator generated raw requirements, glossary entries and clarification questions.",
  cocreator: "Co-creator proposed structured analysis artifacts for analyst approval.",
  facilitator: "Facilitator produced neutral conflict and trade-off artifacts.",
  assistant: "Assistant executed requested validation checks and traceability candidates.",
};

export function generateLayerArtifacts(layerId: LayerId, project: Project): LayerGeneration {
  const artifacts: Artifact[] = artifactSeeds[layerId].map((artifact) => ({
    ...artifact,
    status: layerId === "mediator" ? "draft" : "proposed",
  }));

  const audit: AuditEntry[] = [
    {
      id: `audit-${layerId}-${Date.now()}`,
      timestamp: new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
      layerId,
      action: `${actions[layerId]} Project context: ${project.name}.`,
      actor: "Simulated AI",
    },
  ];

  const riskAudit: AuditEntry[] = riskSeeds[layerId].map((risk) => ({
    id: `audit-${risk.id}`,
    timestamp: new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
    layerId,
    action: `Risk flag attached: ${risk.label}.`,
    actor: "Risk layer",
  }));

  return {
    artifacts,
    risks: riskSeeds[layerId],
    traces: traceSeeds[layerId],
    audit: [...audit, ...riskAudit],
  };
}
