"use client";
import { useId, type InputHTMLAttributes } from "react";
import { useLanguage } from "@/localization/LanguageProvider";
import { clinicalNumberError, parseClinicalNumber, NUMBER_RANGE } from "@/lib/parseClinicalNumber";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & { value: string };
/** Keep raw text in the form; all numeric boundaries must use parseClinicalNumber. */
export default function NumericTextInput({ value, min, max, step, ...props }: Props) {
  const { t } = useLanguage();
  const id = useId();
  const number = parseClinicalNumber(value);
  const rangeError = number !== null && ((min !== undefined && number < Number(min)) || (max !== undefined && number > Number(max)) || (String(step) === "1" && !Number.isInteger(number)));
  const error = clinicalNumberError(value) || (rangeError ? NUMBER_RANGE : null);
  return <>
    <input {...props} type="text" inputMode={props.inputMode ?? "decimal"} autoComplete="off" value={value}
      data-clinical-number="true" aria-invalid={Boolean(error) || props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], error ? id : null].filter(Boolean).join(" ") || undefined}
      ref={(node) => { node?.setCustomValidity(error ? t(error) : ""); }} />
    {error && <span id={id} role="status" className="mt-1 block text-xs text-red-700">{t(error)}</span>}
  </>;
}
