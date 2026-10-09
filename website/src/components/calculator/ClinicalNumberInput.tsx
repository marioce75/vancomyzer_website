"use client";

import { useLanguage } from "@/localization/LanguageProvider";
import { useEffect, useState, useId, type InputHTMLAttributes } from "react";
import { parseClinicalNumber, clinicalNumberError, formatClinicalInput, AMBIGUOUS_NUMBER, INVALID_NUMBER, NUMBER_RANGE } from "@/lib/parseClinicalNumber";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "onBlur" | "className"
>;

export interface ClinicalNumberInputProps extends NativeInputProps {
  /** The parent's number. 0 is the calculator's "empty" value and shows a blank field. */
  value: number;
  /**
   * Called on every edit with the parsed number, 0 when empty, or NaN when malformed. The field then reads as missing, so validation flags it
   * instead of a stale or truncated value being used.
   */
  onValueChange: (value: number) => void;
  /**
   * Called on blur with the parsed number (null when empty or invalid), the raw
   * text, and a message when the text is not a usable number (null otherwise).
   */
  onBlurValue?: (value: number | null, raw: string, error: string | null) => void;
  /** Class names, or a function that receives whether the text is not a usable number. */
  className?: string | ((invalidText: boolean) => string);
}

export const INVALID_NUMBER_MESSAGE = INVALID_NUMBER;
export const AMBIGUOUS_THOUSANDS_MESSAGE = AMBIGUOUS_NUMBER;
function describe(raw: string): { value: number | null; error: string | null } {
  return { value: parseClinicalNumber(raw), error: clinicalNumberError(raw) };
}

/**
 * Text input for clinical numbers. Accepts "1.2" or "1,2" (see
 * parseClinicalNumber), keeps the typed text while the clinician edits so a
 * trailing separator is not rewritten, and preserves the entered decimal mark on blur and language changes.
 */
export default function ClinicalNumberInput({
  value,
  onValueChange,
  onBlurValue,

  className,
  inputMode = "decimal",
  autoComplete = "off",
  min, max, step,
  ...rest
}: ClinicalNumberInputProps) {
  const { t } = useLanguage();
  const errorId = useId();
  const [raw, setRaw] = useState<string>(() => (value ? formatClinicalInput(value) : ""));

  // Follow changes made outside this field (reset, pre-fill, loaded case)
  // without rewriting what the clinician is typing: resync only when the
  // parent's number differs from what the current text parses to.
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    const parsed = describe(raw).value;
    if (!value) {
      if (parsed !== 0) setRaw("");
    } else if (parsed !== value) {
      setRaw(formatClinicalInput(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the parent's value changes
  }, [value]);

  const parsed = describe(raw);
  const rangeError = parsed.value !== null && ((min !== undefined && parsed.value < Number(min)) || (max !== undefined && parsed.value > Number(max)) || (String(step) === "1" && !Number.isInteger(parsed.value)));
  const error = parsed.error || (!Number.isFinite(value) && raw.trim() === "" ? INVALID_NUMBER : null) || (rangeError ? NUMBER_RANGE : null);
  const invalidText = error !== null;
  // Existing form wrappers display callback errors on blur; avoid repeating them.
  const showInlineError = Boolean(error && (!onBlurValue || (raw.trim() === "" && !Number.isFinite(value))));

  return (
    <span className="block min-w-0 flex-1">
    <input
      {...rest}
      data-clinical-number="true"
      aria-describedby={[rest["aria-describedby"], showInlineError ? errorId : null].filter(Boolean).join(" ") || undefined}
      ref={(node) => { node?.setCustomValidity(error ? t(error) : ""); }}
      placeholder={rest.placeholder ? t(rest.placeholder) : undefined}
      title={error ? t(error) : rest.title ? t(rest.title) : undefined}
      aria-label={rest["aria-label"] ? t(rest["aria-label"]) : undefined}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={raw}
      aria-invalid={invalidText ? true : rest["aria-invalid"]}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        const result = describe(next);
        const n = result.value;
        const outside = n !== null && ((min !== undefined && n < Number(min)) || (max !== undefined && n > Number(max)) || (String(step) === "1" && !Number.isInteger(n)));
        onValueChange(result.error || outside ? NaN : n ?? 0);
      }}
      onBlur={() => {
        const { value: parsed, error } = describe(raw);
        // Preserve the entered decimal mark and explicit precision on blur.
        onBlurValue?.(rangeError ? null : parsed, raw, error || (rangeError ? NUMBER_RANGE : null));
      }}
      className={typeof className === "function" ? className(invalidText) : className}
    />
    {showInlineError && error && <span id={errorId} role="status" className="mt-1 block text-xs text-red-700">{t(error)}</span>}
    </span>
  );
}
