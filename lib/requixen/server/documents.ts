import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AttachedDocument } from "@/lib/requixen/types";
type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{
      items: Array<{ str?: string }>;
    }>;
    cleanup(): void;
  }>;
  destroy(): Promise<void>;
};

type MammothModule = {
  extractRawText(input: { buffer: Buffer }): Promise<{ value?: string }>;
};

export type ExtractedDocumentText = {
  text: string;
  status: AttachedDocument["indexingStatus"];
  detail: string;
};

const TEXTUAL_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/tab-separated-values",
  "text/xml",
]);

const TEXTUAL_EXTENSIONS = [".csv", ".json", ".md", ".txt", ".xml", ".yaml", ".yml"];
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractTextFromFile(file: File): Promise<ExtractedDocumentText> {
  if (isPdfFile(file)) {
    return extractPdfText(file);
  }

  if (isDocxFile(file)) {
    return extractDocxText(file);
  }

  if (!isTextualFile(file)) {
    return {
      text: "",
      status: "skipped",
      detail: "El archivo quedo almacenado, pero aun no hay extractor de texto para este formato.",
    };
  }

  const text = normalizeText(await file.text());

  if (!text) {
    return {
      text: "",
      status: "skipped",
      detail: "El archivo no contiene texto indexable.",
    };
  }

  return {
    text,
    status: "indexed",
    detail: "Texto extraido e indexado en Qdrant.",
  };
}

async function extractPdfText(file: File): Promise<ExtractedDocumentText> {
  let document: PdfDocumentProxy | undefined;

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
    ).href;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    document = (await loadingTask.promise) as PdfDocumentProxy;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      );
      page.cleanup();
    }

    const text = normalizeText(pageTexts.join(" "));

    if (!text) {
      return {
        text: "",
        status: "skipped",
        detail: "El PDF no contiene texto extraible. Probablemente requiere OCR.",
      };
    }

    return {
      text,
      status: "indexed",
      detail: "Texto PDF extraido e indexado en Qdrant.",
    };
  } catch (error) {
    return {
      text: "",
      status: "failed",
      detail: error instanceof Error ? `No se pudo extraer texto del PDF: ${error.message}` : "No se pudo extraer texto del PDF.",
    };
  } finally {
    await document?.destroy().catch(() => undefined);
  }
}

async function extractDocxText(file: File): Promise<ExtractedDocumentText> {
  try {
    const mammoth = (await import("mammoth")) as MammothModule;
    const result = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
    const text = normalizeText(result.value ?? "");

    if (!text) {
      return {
        text: "",
        status: "skipped",
        detail: "El DOCX no contiene texto indexable.",
      };
    }

    return {
      text,
      status: "indexed",
      detail: "Texto DOCX extraido e indexado en Qdrant.",
    };
  } catch (error) {
    return {
      text: "",
      status: "failed",
      detail: error instanceof Error ? `No se pudo extraer texto del DOCX: ${error.message}` : "No se pudo extraer texto del DOCX.",
    };
  }
}

export function chunkDocumentText(text: string, maxChunkLength = 1200, overlap = 180) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + maxChunkLength, normalized.length);
    const rawChunk = normalized.slice(cursor, end);
    const chunk = rawChunk.trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end === normalized.length) {
      break;
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

function isTextualFile(file: File) {
  const mimeType = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return mimeType.startsWith("text/") || TEXTUAL_MIME_TYPES.has(mimeType) || TEXTUAL_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isPdfFile(file: File) {
  return file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isDocxFile(file: File) {
  return file.type.toLowerCase() === DOCX_MIME_TYPE || file.name.toLowerCase().endsWith(".docx");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
