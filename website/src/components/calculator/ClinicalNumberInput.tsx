"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import { parseClinicalNumber } from "@/lib/parseClinicalNumber";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "onBlur" | "className"
>;

export interface ClinicalNumberInputProps extends NativeInputProps {
  /** The parent's number. 0 is the calculator's "empty" value and shows a blank field. */
  value: number;
  /**
   * Called on every edit with the parsed number, or 0 when the text is empty or
   * not a valid number. The field then reads as missing, so validation flags it
   * instead of a stale or truncated value being used.
   */
  onValueChange: (value: number) => void;
  /**
   * Called on blur with the parsed number (null when empty or invalid), the raw
   * text, and a message when the text is not a usable number (null otherwise).
   */
  onBlurValue?: (value: number | null, raw: string, error: string | null) => void;
  /**
   * Treat text such as "1,000" or "1.500" (a separator followed by exactly three
   * digits) as invalid. parseClinicalNumber reads it as a decimal (1.0, 1.5),
   * but in a dose or creatinine field it is far more likely a thousands
   * separator, which would be a 1000-fold error.
   */
  rejectThousandsGrouping?: boolean;
  /** Class names, or a function that receives whether the text is not a usable number. */
  className?: string | ((invalidText: boolean) => string);
}

/** Inline message for text that parseClinicalNumber rejects. */
export const INVALID_NUMBER_MESSAGE =
  "Not a valid number. Use digits with one decimal point or comma (e.g. 1.2 or 1,2), without units or thousands separators.";

/** Inline message for "1,000"-style text in a field that rejects thousands grouping. */
export const AMBIGUOUS_THOUSANDS_MESSAGE =
  "Ambiguous number: a comma or point followed by three digits may be a thousands separator. Enter it without a separator (e.g. 1000) or with fewer decimals (e.g. 1.5).";

const THOUSANDS_GROUPING_PATTERN = /^-?[1-9][0-9]{0,2}[.,][0-9]{3}$/;

function describe(raw: string, rejectThousandsGrouping: boolean): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (text === "") return { value: null, error: null };
  if (rejectThousandsGrouping && THOUSANDS_GROUPING_PATTERN.test(text)) {
    return { value: null, error: AMBIGUOUS_THOUSANDS_MESSAGE };
  }
  const value = parseClinicalNumber(text);
  return value === null ? { value: null, error: INVALID_NUMBER_MESSAGE } : { value, error: null };
}

/**
 * Text input for clinical numbers. Accepts "1.2" or "1,2" (see
 * parseClinicalNumber), keeps the typed text while the clinician edits so a
 * trailing separator is not rewritten, and shows the number as it was read
 * (e.g. "1,2" becomes "1.2") when the field loses focus.
 */
export default function ClinicalNumberInput({
  value,
  onValueChange,
  onBlurValue,
  rejectThousandsGrouping = false,
  className,
  inputMode = "decimal",
  autoComplete = "off",
  ...rest
}: ClinicalNumberInputProps) {
  const [raw, setRaw] = useState<string>(() => (value ? String(value) : ""));

  // Follow changes made outside this field (reset, pre-fill, loaded case)
  // without rewriting what the clinician is typing: resync only when the
  // parent's number differs from what the current text parses to.
  useEffect(() => {
    const parsed = describe(raw, rejectThousandsGrouping).value;
    if (!value) {
      if (parsed !== null && parsed !== 0) setRaw("");
    } else if (parsed !== value) {
      setRaw(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the parent's value changes
  }, [value]);

  const invalidText = describe(raw, rejectThousandsGrouping).error !== null;

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={raw}
      aria-invalid={invalidText ? true : rest["aria-invalid"]}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        onValueChange(describe(next, rejectThousandsGrouping).value ?? 0);
      }}
      onBlur={() => {
        const { value: parsed, error } = describe(raw, rejectThousandsGrouping);
        if (parsed !== null && String(parsed) !== raw) setRaw(String(parsed));
        onBlurValue?.(parsed, raw, error);
      }}
      className={typeof className === "function" ? className(invalidText) : className}
    />
  );
}
