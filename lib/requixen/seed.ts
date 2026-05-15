import type { Artifact, AuditEntry, Layer, Project, RiskFlag, RoleProfile, TraceLink, User } from "./types";

export const layers: Layer[] = [
  {
    id: "mediator",
    phase: "Elicitacion",
    role: "Mediador",
    genAiRole: "Puente de comunicacion",
    control: "Alta autonomia de la IA con revision posterior",
    input: "Transcripciones y documentos de stakeholders",
    output: "Candidatos iniciales, glosario y registro de aclaraciones",
  },
  {
    id: "cocreator",
    phase: "Analisis",
    role: "Co-creator",
    genAiRole: "Socio para construir artefactos",
    control: "Control compartido con aprobacion por artefacto",
    input: "Candidatos iniciales y glosario",
    output: "Historias de usuario, criterios de aceptacion, ambiguedades y reporte de brechas",
  },
  {
    id: "facilitator",
    phase: "Negociacion",
    role: "Facilitator",
    genAiRole: "Soporte neutral para la negociacion",
    control: "Modo consultivo, las personas deciden",
    input: "Artefactos aprobados y prioridades de stakeholders",
    output: "Matriz de conflictos, analisis de compensaciones, propuestas y acuerdos",
  },
  {
    id: "assistant",
    phase: "Validacion temprana",
    role: "Assistant",
    genAiRole: "Asistente dirigido de verificacion",
    control: "Ejecucion bajo demanda con control humano completo",
    input: "Requisitos acordados y artefactos acumulados",
    output: "Reporte de validacion, matriz de trazabilidad y lista de incidentes",
  },
];

export const roleProfiles: RoleProfile[] = [
  {
    role: "admin",
    label: "Administrator",
    description: "Configures projects, users and prototype governance. Full access in the MVP.",
    allowedLayers: ["mediator", "cocreator", "facilitator", "assistant"],
    permissions: {
      createProjects: true,
      generateArtifacts: true,
      approveArtifacts: true,
      runValidation: true,
      viewRisk: true,
      manageUsers: true,
    },
  },
  {
    role: "analyst",
    label: "RE Analyst",
    description: "Owns the Early RE workflow, reviews AI outputs and approves artifacts.",
    allowedLayers: ["mediator", "cocreator", "facilitator", "assistant"],
    permissions: {
      createProjects: true,
      generateArtifacts: true,
      approveArtifacts: true,
      runValidation: true,
      viewRisk: true,
      manageUsers: false,
    },
  },
  {
    role: "stakeholder",
    label: "Stakeholder",
    description: "Contributes domain knowledge and participates in negotiation without approving artifacts.",
    allowedLayers: ["mediator", "facilitator"],
    permissions: {
      createProjects: false,
      generateArtifacts: false,
      approveArtifacts: false,
      runValidation: false,
      viewRisk: true,
      manageUsers: false,
    },
  },
  {
    role: "validator",
    label: "Validator",
    description: "Focuses on early validation, traceability and risk review under analyst direction.",
    allowedLayers: ["assistant"],
    permissions: {
      createProjects: false,
      generateArtifacts: false,
      approveArtifacts: false,
      runValidation: true,
      viewRisk: true,
      manageUsers: false,
    },
  },
];

export const seedUsers: User[] = [
  {
    id: "user-admin",
    name: "Laura Molina",
    email: "admin@requixen.local",
    isAdmin: true,
    role: "admin",
    roles: ["admin"],
    organization: "Modernization Directorate",
    areaId: "demo-area-modernization",
    areaName: "Modernization Directorate",
  },
  {
    id: "user-analyst",
    name: "Carlos Acosta",
    email: "analyst@requixen.local",
    isAdmin: false,
    role: "analyst",
    roles: ["analyst"],
    organization: "Requirements Engineering Team",
    areaId: "demo-area-requirements",
    areaName: "Requirements Engineering Team",
  },
  {
    id: "user-stakeholder",
    name: "Marina Quiroga",
    email: "stakeholder@requixen.local",
    isAdmin: false,
    role: "stakeholder",
    roles: ["stakeholder"],
    organization: "Citizen Service",
    areaId: "demo-area-citizen-service",
    areaName: "Citizen Service",
  },
  {
    id: "user-validator",
    name: "German Rios",
    email: "validator@requixen.local",
    isAdmin: false,
    role: "validator",
    roles: ["validator"],
    organization: "Quality and Compliance",
    areaId: "demo-area-quality",
    areaName: "Quality and Compliance",
  },
];

export const seedProject: Project = {
  id: "municipal-complaints",
  name: "Citizen complaint management system",
  domain: "Digital government",
  municipality: "San Fernando del Valle de Catamarca, Argentina",
  summary:
    "Modernization of a manual municipal workflow for infrastructure complaints, status tracking and inter-area coordination.",
  transcript:
    "When someone comes to complain about a pothole or a broken streetlight, we fill out a paper form. Then we take the form to Public Works. Sometimes weeks pass before anything happens, and the citizen calls back asking what's going on, and we have no way to tell them.",
  status: "elicitation",
  createdAt: "2026-04-25",
  updatedAt: "2026-04-25",
  documents: [
    {
      id: "doc-transcript",
      name: "initial-interview-transcript.txt",
      type: "text/plain",
      size: 1180,
      origin: "seed",
    },
  ],
  participants: seedUsers.map(({ id, name, email, role }) => ({
    userId: id,
    name,
    email,
    role: role === "admin" ? "stakeholder" : role,
  })),
};

export const seedProjects: Project[] = [
  seedProject,
  {
    id: "permit-modernization",
    name: "Commercial permit modernization",
    domain: "Digital government",
    municipality: "Municipal Government of Catamarca, Argentina",
    summary:
      "Initial intake for replacing paper-based commercial permit submissions with a traceable digital workflow.",
    transcript:
      "Applicants bring printed forms to the front desk. Missing documents are usually detected late, and business owners return several times before the permit can move to technical review.",
    status: "intake",
    createdAt: "2026-04-24",
    updatedAt: "2026-04-24",
    documents: [
      {
        id: "doc-permit-form",
        name: "current-permit-form.pdf",
        type: "application/pdf",
        size: 246000,
        origin: "seed",
      },
    ],
    participants: seedUsers.map(({ id, name, email, role }) => ({
      userId: id,
      name,
      email,
      role: role === "admin" ? "stakeholder" : role,
    })),
  },
];

export const initialArtifacts: Artifact[] = [];
export const initialRisks: RiskFlag[] = [];
export const initialTraces: TraceLink[] = [];

export const initialAudit: AuditEntry[] = [
  {
    id: "audit-seed",
    timestamp: "09:00",
    layerId: "mediator",
    action: "Demo project loaded with municipal complaint scenario.",
    actor: "Analyst",
  },
];
