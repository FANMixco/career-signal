import { Router } from "express";
import multer from "multer";
import { runPrecheck } from "../services/openaiService.js";
import { extractPdfText } from "../services/pdfService.js";
import { agePrivacyWarning, metadataSchema, MIN_CV_LENGTH, parseFormValue } from "../utils/validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new Error("Only PDF files are supported."));
      return;
    }
    callback(null, true);
  }
});

export const precheckCvRouter = Router();

precheckCvRouter.post("/", upload.single("cvPdf"), async (req, res) => {
  try {
    const metadata = metadataSchema.parse({
      yearsOfExperience: parseFormValue(req.body.yearsOfExperience),
      hasDegree: parseFormValue(req.body.hasDegree),
      degreeYear: parseFormValue(req.body.degreeYear) || undefined,
      experienceSelectionMode: parseFormValue(req.body.experienceSelectionMode)
    });

    if (metadata.yearsOfExperience > 5 && req.body.hasDegree === undefined) {
      res.status(400).json({ error: "Study or education answer is required when experience is greater than five years." });
      return;
    }

    if (metadata.yearsOfExperience > 5 && metadata.hasDegree && !metadata.degreeYear) {
      res.status(400).json({ error: "Study completion year is required when you list studies and have more than five years of experience." });
      return;
    }

    let cvText = String(req.body.cvText || "").trim();

    if (!cvText && req.file) {
      cvText = await extractPdfText(req.file.buffer);
    }

    if (!cvText || cvText.length < MIN_CV_LENGTH) {
      res.status(400).json({ error: "Please provide a complete CV or LinkedIn PDF export." });
      return;
    }

    const precheck = await runPrecheck({
      apiKey: req.body.openaiApiKey,
      cvText,
      yearsOfExperience: metadata.yearsOfExperience,
      hasDegree: metadata.hasDegree,
      degreeYear: metadata.degreeYear,
      experienceSelectionMode: metadata.experienceSelectionMode
    });

    res.json({
      cvText,
      cvTextPreview: cvText.slice(0, 600),
      agePrivacyWarning: agePrivacyWarning(metadata.degreeYear),
      precheck,
      recommendedNextAction: precheck.proceedRecommendation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not run CV precheck.";
    const status = message.includes("AI API key") ? 401 : 400;
    res.status(status).json({ error: message });
  }
});

precheckCvRouter.use((error: Error, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
  const message = error.message || "Could not upload CV.";
  res.status(400).json({
    error: message.includes("File too large") ? "Maximum PDF upload size is 5MB." : message
  });
});
