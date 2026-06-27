import pdfParse from "pdf-parse";

export async function extractPdfText(buffer: Buffer) {
  const result = await pdfParse(buffer);
  const text = result.text.replace(/\s+\n/g, "\n").trim();

  if (!text) {
    throw new Error("Could not extract text from this PDF. Please paste your CV text manually.");
  }

  return text;
}
