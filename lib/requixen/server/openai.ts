import type { ElicitationChatMessage, Project, User } from "@/lib/requixen/types";
import { serverEnv } from "./env";

type OpenAiTextContent = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  type?: string;
  content?: OpenAiTextContent[];
};

type OpenAiResponse = {
  output_text?: string;
  output?: OpenAiOutputItem[];
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
};

type OpenAiEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
};

type OpenAiTranscriptionResponse = {
  text?: string;
};

export async function generateMediatorReply({
  project,
  user,
  message,
  recentMessages,
  roomContext,
  retrievedContext,
  mode = "elicitation",
}: {
  project: Project;
  user: User;
  message: string;
  recentMessages: ElicitationChatMessage[];
  roomContext?: string;
  retrievedContext?: string;
  mode?: "elicitation" | "project-context" | "analyst-processing";
}) {
  const env = serverEnv();

  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const instructions =
    mode === "project-context"
      ? [
          "You are the Requixen Mediador for a project-context chat in Early Requirements Engineering for digital government.",
          "Reply in Spanish unless the user writes in English.",
          "When replying in Spanish, call yourself 'Mediador', never 'Mediator'.",
          "Help the stakeholder understand the project, available sources, parallel contributions, open questions, municipal area context, and how their knowledge can fit the elicitation work.",
          "Do not invent facts. If something is not present in the supplied project data, say that it is not available yet.",
          "Do not produce final requirements in this mode.",
          "Keep the answer grounded and complete. Prefer 4 short sections maximum and always finish with a brief 'Siguiente paso sugerido' section.",
        ].join(" ")
      : mode === "analyst-processing"
        ? [
            "You are the Requixen Mediador supporting an RE analyst in Early Requirements Engineering for digital government.",
            "Reply in Spanish.",
            "Call yourself 'Mediador', never 'Mediator'.",
            "The analyst needs a complete, actionable, bounded response. Do not leave numbered items unfinished.",
            "Structure the answer with concise sections and prioritize CTAs for the analyst.",
            "Separate confirmed facts, assumptions, open questions, traceability risks, and recommended next actions.",
            "If the supplied context includes analyst clarification requests and stakeholder responses, incorporate those answers as first-class evidence in the reevaluation.",
            "When an earlier open question was answered by a stakeholder, update the assessment instead of repeating it as pending.",
            "Do not invent facts. If information is missing, mark it as pending clarification.",
        ].join(" ")
      : [
          "You are the Requixen Mediador for Early Requirements Engineering in digital government.",
          "Reply in Spanish unless the user writes in English.",
          "When replying in Spanish, call yourself 'Mediador', never 'Mediator'.",
          "Help elicit needs, actors, exceptions, evidence, ambiguities, and risks.",
          project.institutionalRequest?.templateId === "school-health-survey"
            ? "This project is an institutional request from Secretaria de Salud to Modernizacion for a municipal school health survey. Conduct the conversation as a guided interview covering health objective, students and schools in scope, data to collect, authorizations, field operation, responsible people, schedule, expected reports, privacy constraints, access levels, alerts, and success criteria. Do not jump to software requirements until the operational need is clear."
            : "",
          "Do not invent final requirements; mark assumptions explicitly.",
          "Keep the answer complete and finish with a concrete next question or next step.",
        ].filter(Boolean).join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openAiModel,
      instructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Project: ${project.name}`,
                `Organization: ${project.municipality}`,
                `Summary: ${project.summary}`,
                `Institutional request: ${formatInstitutionalRequest(project)}`,
                `Current user: ${user.name} (${user.role})`,
                `Interaction mode: ${mode}`,
                `Retrieved project context from indexed documents:\n${retrievedContext || "No indexed project context was retrieved for this turn."}`,
                `Full elicitation room context supplied by the app:\n${roomContext || "No broader room context was supplied for this turn."}`,
                `Recent room messages: ${recentMessages.map((item) => `${item.authorName}: ${item.body}`).join("\n")}`,
                `New message: ${message}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      max_output_tokens: mode === "project-context" ? 1200 : mode === "analyst-processing" ? 2600 : 1100,
      store: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as OpenAiResponse;
  const text = extractOutputText(data);

  if (data.status === "incomplete" || data.incomplete_details?.reason) {
    return [
      text,
      "",
      "**Nota:** la respuesta del modelo llego incompleta. Vuelve a ejecutar la accion para regenerarla con mas foco.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return text || "Registre el aporte. Necesito una aclaracion adicional sobre actores, excepciones y evidencia disponible.";
}

function formatInstitutionalRequest(project: Project) {
  const request = project.institutionalRequest;

  if (!request) {
    return "No institutional request metadata is registered.";
  }

  return [
    `Template: ${request.templateName || request.templateId || "not specified"}`,
    `Requesting area: ${request.requestingArea || "not specified"}`,
    `Receiving area: ${request.receivingArea || "not specified"}`,
    `Contact: ${request.contactPerson || "not specified"}`,
    `Requested action: ${request.requestedAction || "not specified"}`,
    `Target population: ${request.targetPopulation || "not specified"}`,
    `Urgency: ${request.urgency}`,
  ].join("\n");
}

export async function createEmbeddings(input: string[]) {
  const env = serverEnv();

  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (input.length === 0) {
    return [];
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openAiEmbeddingModel,
      input,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as OpenAiEmbeddingResponse;
  return [...(data.data ?? [])]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => item.embedding ?? []);
}

export async function transcribeAudio(file: File, language = "es") {
  const env = serverEnv();

  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const formData = new FormData();
  formData.append("model", env.openAiTranscriptionModel);
  formData.append("file", file, file.name || "voice.webm");
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI transcription request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as OpenAiTranscriptionResponse;
  return data.text?.trim() ?? "";
}

export function embeddingDimensionsForModel(model: string) {
  return model.includes("large") ? 3072 : 1536;
}

function extractOutputText(data: OpenAiResponse) {
  if (data.output_text) {
    return data.output_text;
  }

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}
