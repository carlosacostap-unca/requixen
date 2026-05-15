export function serverEnv() {
  return {
    pocketBaseUrl: process.env.POCKETBASE_URL?.replace(/\/$/, "") ?? "",
    pocketBaseUsersCollection: process.env.POCKETBASE_USERS_COLLECTION || "users",
    pocketBaseProjectsCollection: process.env.POCKETBASE_PROJECTS_COLLECTION || "requixen_projects",
    pocketBaseFilesCollection: process.env.POCKETBASE_FILES_COLLECTION || "requixen_files",
    pocketBaseAreasCollection: process.env.POCKETBASE_AREAS_COLLECTION || "requixen_areas",
    pocketBaseInstitutionalTemplatesCollection:
      process.env.POCKETBASE_INSTITUTIONAL_TEMPLATES_COLLECTION || "requixen_institutional_templates",
    pocketBaseElicitationSessionsCollection:
      process.env.POCKETBASE_ELICITATION_SESSIONS_COLLECTION || "requixen_elicitation_sessions",
    pocketBaseElicitationMessagesCollection:
      process.env.POCKETBASE_ELICITATION_MESSAGES_COLLECTION || "requixen_elicitation_messages",
    pocketBaseElicitationContributionsCollection:
      process.env.POCKETBASE_ELICITATION_CONTRIBUTIONS_COLLECTION || "requixen_elicitation_contributions",
    pocketBaseClarificationsCollection:
      process.env.POCKETBASE_CLARIFICATIONS_COLLECTION || "requixen_clarifications",
    pocketBaseArtifactsCollection:
      process.env.POCKETBASE_ARTIFACTS_COLLECTION || "requixen_artifacts",
    pocketBaseRisksCollection:
      process.env.POCKETBASE_RISKS_COLLECTION || "requixen_risks",
    pocketBaseTracesCollection:
      process.env.POCKETBASE_TRACES_COLLECTION || "requixen_traces",
    pocketBaseAuditCollection:
      process.env.POCKETBASE_AUDIT_COLLECTION || "requixen_audit",
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    openAiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    openAiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    openAiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    qdrantUrl: process.env.QDRANT_URL?.replace(/\/$/, "") ?? "",
    qdrantApiKey: process.env.QDRANT_API_KEY ?? "",
    qdrantCollection: process.env.QDRANT_COLLECTION || "requixen_document_chunks",
  };
}

export function integrationStatus() {
  const env = serverEnv();

  return {
    pocketBase: Boolean(env.pocketBaseUrl),
    openAi: Boolean(env.openAiApiKey),
    openAiModel: env.openAiModel,
    openAiTranscriptionModel: env.openAiTranscriptionModel,
    embeddings: Boolean(env.openAiApiKey),
    openAiEmbeddingModel: env.openAiEmbeddingModel,
    qdrant: Boolean(env.qdrantUrl && env.qdrantApiKey),
    qdrantCollection: env.qdrantCollection,
    collections: {
      users: env.pocketBaseUsersCollection,
      projects: env.pocketBaseProjectsCollection,
      files: env.pocketBaseFilesCollection,
      areas: env.pocketBaseAreasCollection,
      institutionalTemplates: env.pocketBaseInstitutionalTemplatesCollection,
      elicitationSessions: env.pocketBaseElicitationSessionsCollection,
      elicitationMessages: env.pocketBaseElicitationMessagesCollection,
      elicitationContributions: env.pocketBaseElicitationContributionsCollection,
      clarifications: env.pocketBaseClarificationsCollection,
      artifacts: env.pocketBaseArtifactsCollection,
      risks: env.pocketBaseRisksCollection,
      traces: env.pocketBaseTracesCollection,
      audit: env.pocketBaseAuditCollection,
    },
  };
}
