import { z } from "zod";

/**
 * `aiHandoff` in an AI endpoint's body (nga_central_mis EXTERNAL_AI_CONTRACT.md §1):
 * { mode:"prompt", pupilConsent? } or { mode:"import", text }. validateBody strips unknown
 * keys, so schemas that use it must list this field. Read by services/aiHandoff.ts.
 */
export const aiHandoffSchema = z
  .object({
    mode: z.enum(["prompt", "import"]),
    pupilConsent: z.boolean().optional(),
    text: z.string().max(200_000, "That answer is too long to import.").optional(),
  })
  .nullish();
