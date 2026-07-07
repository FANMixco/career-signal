// PDF text extraction for uploaded CVs.
// The AI services receive plain text only; the uploaded PDF itself is never sent
// to a model by this backend.
import pdfParse from "pdf-parse";
import { messages } from "../utils/messages.js";

export async function extractPdfText(buffer: Buffer) {
  const result = await pdfParse(buffer);
  const text = result.text.replace(/\s+\n/g, "\n").trim();

  if (!text) {
    throw new Error(messages.errors.couldNotExtractPdf);
  }

  return text;
}
