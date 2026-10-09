"use client";
import { useId, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useLanguage } from "@/localization/LanguageProvider";
import { clinicalNumberError, parseClinicalNumber, parseCanonicalClinicalNumber, INVALID_CLINICAL_ENTRY, INVALID_NUMBER, NUMBER_RANGE, type NumberInterpretation } from "@/lib/parseClinicalNumber";
import NumberClarification from "./NumberClarification";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  /** Canonical decimal text or INVALID_CLINICAL_ENTRY, never unresolved raw entry. */
  value: string;
  onValueChange: (canonical: string) => void;
};
export default function NumericTextInput({ value, onValueChange, min, max, step, ...props }: Props) {
  const { t } = useLanguage();
  const id = useId();
  const [raw, setRaw] = useState(value === INVALID_CLINICAL_ENTRY ? "" : value);
  // Parent values are canonical prefills. New raw edits always clear this choice.
  const [interpretation, setInterpretation] = useState<NumberInterpretation | undefined>(parseCanonicalClinicalNumber(value) !== null ? "decimal" : undefined);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setRaw(value === INVALID_CLINICAL_ENTRY ? "" : value);
    setInterpretation(parseCanonicalClinicalNumber(value) !== null ? "decimal" : undefined);
  }, [value]);
  const number = parseClinicalNumber(raw, interpretation);
  const outside = (n: number | null) => n !== null && ((min !== undefined && n < Number(min)) || (max !== undefined && n > Number(max)) || (String(step) === "1" && !Number.isInteger(n)));
  const error = clinicalNumberError(raw, interpretation) || (value === INVALID_CLINICAL_ENTRY && !raw.trim() ? INVALID_NUMBER : null) || (outside(number) ? NUMBER_RANGE : null);
  const emit = (text: string, choice?: NumberInterpretation) => {
    const n = parseClinicalNumber(text, choice);
    const canonical = clinicalNumberError(text, choice) || outside(n) ? INVALID_CLINICAL_ENTRY : n === null ? "" : String(n);
    lastEmitted.current = canonical;
    onValueChange(canonical);
  };
  return <span className="block min-w-0 flex-1">
    <input {...props} type="text" inputMode={props.inputMode ?? "decimal"} autoComplete="off" value={raw}
      onChange={e => { setRaw(e.target.value); setInterpretation(undefined); emit(e.target.value); }}
      data-clinical-number="true" aria-invalid={Boolean(error) || props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], error ? id : null].filter(Boolean).join(" ") || undefined}
      ref={(node) => { node?.setCustomValidity(error ? t(error) : ""); }} />
    {error && <span id={id} role="status" className="mt-1 block text-xs text-red-700">{t(error)}</span>}
    <NumberClarification raw={raw} interpretation={interpretation} onChoose={choice => { setInterpretation(choice); emit(raw, choice); }} />
  </span>;
}
