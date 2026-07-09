// POST /api/precheck-cv
// Accepts either pasted CV text or one uploaded PDF, extracts text if needed,
// validates profile metadata, then runs the evidence precheck before tailoring
// is allowed.
import { Router } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { detectSensitivePersonalDataWarnings } from "../rules/cvRules.js";
import { runPrecheck } from "../services/aiProviderService.js";
import { extractPdfText } from "../services/pdfService.js";
import { errorMessage, localizeErrorText } from "../utils/messages.js";
import { agePrivacyWarning, metadataSchema, MIN_CV_LENGTH, parseFormValue } from "../utils/validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new Error(errorMessage("pdfOnly", req.body?.outputLanguage)));
      return;
    }
    callback(null, true);
  }
});

export const precheckCvRouter = Router();

precheckCvRouter.post("/", upload.single("cvPdf"), async (req, res) => {
  const requestedLanguage = parseFormValue(req.body.outputLanguage);

  try {
    const metadata = metadataSchema.parse({
      yearsOfExperience: parseFormValue(req.body.yearsOfExperience),
      hasDegree: parseFormValue(req.body.hasDegree),
      degreeYear: parseFormValue(req.body.degreeYear) || undefined,
      experienceSelectionMode: parseFormValue(req.body.experienceSelectionMode),
      outputLanguage: parseFormValue(req.body.outputLanguage),
      aiProvider: parseFormValue(req.body.aiProvider),
      aiModel: parseFormValue(req.body.aiModel) || undefined,
      ollamaBaseUrl: parseFormValue(req.body.ollamaBaseUrl) || undefined
    });

    if (metadata.yearsOfExperience > 5 && req.body.hasDegree === undefined) {
      res.status(400).json({ error: errorMessage("studyAnswerRequired", metadata.outputLanguage) });
      return;
    }

    if (metadata.yearsOfExperience > 5 && metadata.hasDegree && !metadata.degreeYear) {
      res.status(400).json({ error: errorMessage("studyYearRequired", metadata.outputLanguage) });
      return;
    }

    let cvText = String(req.body.cvText || "").trim();

    if (!cvText && req.file) {
      cvText = await extractPdfText(req.file.buffer, metadata.outputLanguage);
    }

    if (!cvText || cvText.length < MIN_CV_LENGTH) {
      res.status(400).json({ error: errorMessage("completeCvRequired", metadata.outputLanguage) });
      return;
    }

    const precheck = await runPrecheck({
      aiProvider: metadata.aiProvider,
      aiModel: metadata.aiModel,
      apiKey: req.body.aiApiKey || req.body.openaiApiKey,
      ollamaBaseUrl: metadata.ollamaBaseUrl,
      cvText,
      yearsOfExperience: metadata.yearsOfExperience,
      hasDegree: metadata.hasDegree,
      degreeYear: metadata.degreeYear,
      experienceSelectionMode: metadata.experienceSelectionMode,
      outputLanguage: metadata.outputLanguage
    });

    res.json({
      cvText,
      cvTextPreview: cvText.slice(0, 600),
      agePrivacyWarning: agePrivacyWarning(metadata.degreeYear),
      personalDataWarnings: detectSensitivePersonalDataWarnings(cvText),
      precheck,
      recommendedNextAction: precheck.proceedRecommendation
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues.map((issue) => localizeErrorText(issue.message, requestedLanguage)).join(" ")
      });
      return;
    }

    const message = error instanceof Error ? localizeErrorText(error.message, requestedLanguage) : errorMessage("couldNotRunPrecheck", requestedLanguage);
    const status = /API key|clave API|cle API|API-Schluessel/.test(message) ? 401 : 400;
    res.status(status).json({ error: message });
  }
});

precheckCvRouter.use((error: Error, req: { body?: { outputLanguage?: unknown } }, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
  const outputLanguage = req.body?.outputLanguage;
  const message = error.message ? localizeErrorText(error.message, outputLanguage) : errorMessage("couldNotUploadCv", outputLanguage);
  res.status(400).json({
    error: message.includes("File too large") ? errorMessage("pdfTooLarge", outputLanguage) : message
  });
});
