// PDF text extraction for uploaded CVs.
// The AI services receive plain text only; the uploaded PDF itself is never sent
// to a model by this backend.
import pdfParse from "pdf-parse";
import { errorMessage } from "../utils/messages.js";

export async function extractPdfText(buffer: Buffer, outputLanguage?: string) {
  const result = await pdfParse(buffer);
  const text = result.text.replace(/\s+\n/g, "\n").trim();

  if (!text) {
    throw new Error(errorMessage("couldNotExtractPdf", outputLanguage));
  }

  return text;
}
