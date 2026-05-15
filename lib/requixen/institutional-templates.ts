import seedTemplates from "./institutional-templates.seed.json";
import type { InstitutionalInterviewTemplate } from "./types";

export const defaultInstitutionalInterviewTemplates = seedTemplates as InstitutionalInterviewTemplate[];

export function findInstitutionalInterviewTemplate(
  templates: InstitutionalInterviewTemplate[],
  templateId: string | undefined,
) {
  return templates.find((template) => template.id === templateId);
}
