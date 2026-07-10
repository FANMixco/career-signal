// PDF text extraction for uploaded CVs.
// The AI services receive plain text only; the uploaded PDF itself is never sent
// to a model by this backend.
import pdfParse from "pdf-parse";
import { errorMessage } from "../utils/messages.js";

function isPdfFontWarning(args: unknown[]) {
  return args.length > 0 && typeof args[0] === "string" && /^Warning: TT: /.test(args[0]);
}

async function parsePdfWithoutFontNoise(buffer: Buffer) {
  const originalLog = console.log;

  // pdf-parse bundles an older pdf.js that prints benign TrueType font parser
  // warnings to stdout. Keep all other logs visible.
  console.log = (...args: unknown[]) => {
    if (!isPdfFontWarning(args)) {
      originalLog(...args);
    }
  };

  try {
    return await pdfParse(buffer);
  } finally {
    console.log = originalLog;
  }
}

export async function extractPdfText(buffer: Buffer, outputLanguage?: string) {
  const result = await parsePdfWithoutFontNoise(buffer);
  const text = result.text.replace(/\s+\n/g, "\n").trim();

  if (!text) {
    throw new Error(errorMessage("couldNotExtractPdf", outputLanguage));
  }

  return text;
}
