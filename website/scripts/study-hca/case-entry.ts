/**
 * Offline single-case entry screen (bundled into case-entry.html).
 * Runs entirely in the page: no fetch, no storage, no external resources. The
 * page's Content-Security-Policy is default-src 'none', so the browser itself
 * blocks any network request.
 */
import { predictAtDraw, type TimedCaseInput, type TimedPredictionResult } from "../../src/lib/studyTimed/predictAtDraw";
import { resultsToCsv } from "../../src/lib/studyTimed/batch";
import { RELEASE_LABEL } from "../../src/lib/studyTimed/release";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function doseRow(): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input class="d-start" aria-label="Dose start" required></td>
    <td><input class="d-mg" type="number" step="any" min="1" aria-label="Dose mg" required></td>
    <td><input class="d-min" type="number" step="any" min="1" aria-label="Infusion minutes"></td>
    <td><input class="d-end" aria-label="Infusion end (instead of minutes)"></td>
    <td><button type="button" class="d-del" aria-label="Remove dose">✕</button></td>`;
  (tr.querySelector(".d-del") as HTMLButtonElement).onclick = () => tr.remove();
  return tr;
}

function readForm(): TimedCaseInput {
  const basis = ($("basis") as HTMLSelectElement).value as TimedCaseInput["time_basis"];
  const time = (s: string): string | number => {
    const t = s.trim();
    return basis === "elapsed_hours" && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : t;
  };
  const num = (s: string) => (s.trim() === "" ? (undefined as unknown as number) : Number(s));
  const doses = Array.from(document.querySelectorAll<HTMLTableRowElement>("#doses tbody tr")).map((tr) => {
    const v = (c: string) => (tr.querySelector(c) as HTMLInputElement).value;
    const d: Record<string, unknown> = { start: time(v(".d-start")), dose_mg: num(v(".d-mg")) };
    if (v(".d-min").trim() !== "") d.infusion_minutes = num(v(".d-min"));
    if (v(".d-end").trim() !== "") d.end = time(v(".d-end"));
    return d as unknown as TimedCaseInput["doses"][number];
  });
  return {
    study_case_id: ($("caseId") as HTMLInputElement).value.trim(),
    time_basis: basis,
    age_years: num(($("age") as HTMLInputElement).value),
    weight_kg: num(($("weight") as HTMLInputElement).value),
    serum_creatinine_mg_dl: num(($("scr") as HTMLInputElement).value),
    scr_collected_at: time(($("scrAt") as HTMLInputElement).value),
    renal_replacement_therapy: ($("rrt") as HTMLSelectElement).value === "true" ? true : ($("rrt") as HTMLSelectElement).value === "false" ? false : (undefined as unknown as boolean),
    history_complete_attested: ($("attest") as HTMLInputElement).checked,
    draw_time: time(($("draw") as HTMLInputElement).value),
    doses,
  };
}

let last: { input: TimedCaseInput; result: TimedPredictionResult } | null = null;

function show(r: TimedPredictionResult) {
  const out = $("result");
  out.replaceChildren();
  const p = (text: string, cls = "") => { const e = document.createElement("p"); e.textContent = text; if (cls) e.className = cls; out.appendChild(e); };
  if (r.status === "predicted") {
    p(`${r.predicted_concentration_mg_l!.toFixed(1)} mg/L`, "big");
    p(`Unrounded ${r.predicted_concentration_mg_l} mg/L at ${r.draw_elapsed_hours} h after the first dose; ${r.doses_used} dose(s) used.`);
  } else p("No prediction was made.", "big refused");
  for (const w of r.warnings) p(`Warning ${w.code}: ${w.message}`, "warn");
  for (const x of r.reasons) p(`${x.code}: ${x.message}`, "refused");
  p(r.release, "small");
  ($("save") as HTMLButtonElement).disabled = false;
}

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

function init() {
  $("release").textContent = RELEASE_LABEL;
  const body = document.querySelector("#doses tbody")!;
  body.appendChild(doseRow());
  $("addDose").onclick = () => body.appendChild(doseRow());
  ($("form") as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    const input = readForm();
    const result = predictAtDraw(input);
    last = { input, result };
    show(result);
  };
  $("save").onclick = () => {
    if (!last) return;
    const id = last.result.study_case_id ?? "case";
    download(`${id}-prediction.csv`, resultsToCsv([last.result]), "text/csv");
  };
  $("clear").onclick = () => { ($("form") as HTMLFormElement).reset(); body.replaceChildren(doseRow()); $("result").replaceChildren(); last = null; ($("save") as HTMLButtonElement).disabled = true; };
}

init();
