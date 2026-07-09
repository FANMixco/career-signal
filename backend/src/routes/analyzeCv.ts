// POST /api/analyze-cv
// Builds the job-specific reconstruction plan only after a precheck result is
// supplied. Weak prechecks stay blocked unless the user explicitly continues.
import { Router } from "express";
import { ZodError } from "zod";
import { proceedRecommendationValues } from "../rules/cvRules.js";
import { runAnalysis } from "../services/aiProviderService.js";
import { planToText } from "../services/textFormatter.js";
import { errorMessage, localizeErrorText } from "../utils/messages.js";
import { analyzeCvSchema } from "../utils/validation.js";

export const analyzeCvRouter = Router();

analyzeCvRouter.post("/", async (req, res) => {
  const requestedLanguage = req.body?.outputLanguage;

  try {
    const body = analyzeCvSchema.parse(req.body);
    const recommendation = body.precheckResult.proceedRecommendation;

    if (recommendation === proceedRecommendationValues.improve && !body.continueDespiteWeakPrecheck) {
      res.status(400).json({
        error: errorMessage("weakPrecheckBlocked", body.outputLanguage)
      });
      return;
    }

    const analysis = await runAnalysis({
      aiProvider: body.aiProvider,
      aiModel: body.aiModel,
      apiKey: body.aiApiKey || body.openaiApiKey,
      ollamaBaseUrl: body.ollamaBaseUrl,
      cvText: body.cvText,
      precheckResult: body.precheckResult,
      companyName: body.companyName,
      companyDescription: body.companyDescription,
      targetStyle: body.targetStyle,
      experienceSelectionMode: body.experienceSelectionMode,
      outputLanguage: body.outputLanguage,
      jobDescription: body.jobDescription
    });

    res.json({
      analysis,
      downloadableText: planToText(analysis, body.outputLanguage)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues.map((issue) => localizeErrorText(issue.message, requestedLanguage)).join(" ")
      });
      return;
    }

    const message = error instanceof Error ? localizeErrorText(error.message, requestedLanguage) : errorMessage("couldNotGeneratePlan", requestedLanguage);
    const status = /API key|clave API|cle API|API-Schluessel/.test(message) ? 401 : 400;
    res.status(status).json({ error: message });
  }
});
