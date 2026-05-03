import { z } from "zod";

/**
 * Wire schema for the cross-domain pilot-application ingest.
 * Mirrors the contract published to dosys.health.
 *
 * Notes:
 * - `monitoring` accepts the empty string from the form when the user did
 *   not pick an option. We coerce empty → undefined downstream so the DB
 *   never stores "".
 * - `submittedAt` must be ISO-8601. We parse it through Date() to confirm
 *   it's a valid timestamp, but persist the raw string so we keep the
 *   sender's exact byte sequence (useful when chasing skew issues).
 */
export const pilotApplicationIngestSchema = z.object({
  name: z.string().trim().min(1, "name required").max(200),
  title: z.string().trim().min(1, "title required").max(200),
  hospital: z.string().trim().min(1, "hospital required").max(300),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(40).optional(),
  beds: z.number().int().nonnegative().max(100_000).optional(),
  monitoring: z
    .enum(["trough", "auc-other", "manual", "none", ""])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  source: z.literal("dosys.health/pilot"),
  submittedAt: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: "submittedAt must be ISO-8601" }),
});

export type PilotApplicationIngest = z.infer<typeof pilotApplicationIngestSchema>;
