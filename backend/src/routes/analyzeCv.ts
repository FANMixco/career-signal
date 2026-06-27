import { Router } from "express";
import { runAnalysis } from "../services/openaiService.js";
import { planToText } from "../services/textFormatter.js";
import { analyzeCvSchema } from "../utils/validation.js";

export const analyzeCvRouter = Router();

analyzeCvRouter.post("/", async (req, res) => {
  try {
    const body = analyzeCvSchema.parse(req.body);
    const recommendation = body.precheckResult.proceedRecommendation;

    if (recommendation === "Improve CV first" && !body.continueDespiteWeakPrecheck) {
      res.status(400).json({
        error:
          "The CV quality precheck recommends improving the CV first. Add concrete outcomes and numerical evidence before tailoring, or explicitly choose Continue anyway."
      });
      return;
    }

    const analysis = await runAnalysis({
      apiKey: body.openaiApiKey,
      cvText: body.cvText,
      precheckResult: body.precheckResult,
      companyName: body.companyName,
      targetStyle: body.targetStyle,
      experienceSelectionMode: body.experienceSelectionMode,
      jobDescription: body.jobDescription
    });

    res.json({
      analysis,
      downloadableText: planToText(analysis)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate reconstruction plan.";
    const status = message.includes("AI API key") ? 401 : 400;
    res.status(status).json({ error: message });
  }
});
