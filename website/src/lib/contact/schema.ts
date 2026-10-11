import { z } from "zod";
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120).refine(s => !/[\r\n]/.test(s)),
  email: z.string().trim().email().max(254),
  topic: z.enum(["restricted_access", "hospital", "research", "clinical", "technical", "other"]),
  message: z.string().trim().min(10).max(6000),
  locale: z.enum(["en", "es", "fr", "pt-BR"]).default("en"),
  acknowledgement: z.boolean().default(false),
  website: z.string().max(0).optional(),
});
