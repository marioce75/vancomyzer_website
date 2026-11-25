import { shouldHoldEmpiricProfile } from "@/lib/empiricReview";
import type { CalculateRequest } from "@/types/calculator";
import { computeInitialRegimen, InitialRegimenInputError } from "@/lib/initialRegimen";
import { validateRawInput } from "@/lib/pk/validate/validateRawInput";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";

/** Fictional owner demo. Same released PK engines with the published default
 * policy, never an institutional override or a request to the calculation API. */
export function calculateClassicInBrowser(request: CalculateRequest): Response {
  const fail = (message: string, field_errors?: Record<string, string>) =>
    Response.json({ error_type: "validation_error", message, field_errors }, { status: 400 });
  // The production transport omits undefined keys. Preserve that contract.
  const input: CalculateRequest = JSON.parse(JSON.stringify(request));
  const errors = validateRawInput(input, input.mode !== "initial_regimen");
  if (Object.keys(errors).length) return fail("Invalid or unsupported inputs.", errors);
  const levels = input.levels ?? [];
  const empiric = () => {
    try {
      return Response.json(computeInitialRegimen(input.patient));
    } catch (e) {
      if (!(e instanceof InitialRegimenInputError)) throw e;
      return fail(e.message, e.field_errors);
    }
  };
  if (input.mode === "initial_regimen") return empiric();
  if (!input.regimen) return fail("A documented regimen is required.");
  if (input.regimen.doses_given !== 1 && levels.length === 0) return fail("At least one level is required for existing regimen evaluation.");
  if (levels.length === 0 && shouldHoldEmpiricProfile(input.patient)) return empiric();
  const result = runExistingRegimenPipeline({
    patient: { ...input.patient }, regimen: { ...input.regimen }, levels: levels.map(level => ({ ...level })),
  });
  if ("ok" in result && result.ok === false) {
    const { error_type, message, field_errors, recovery_guidance, fallback_workflow } = result;
    return Response.json({ error_type, message, field_errors, recovery_guidance, fallback_workflow }, { status: 400 });
  }
  return Response.json(result);
}
