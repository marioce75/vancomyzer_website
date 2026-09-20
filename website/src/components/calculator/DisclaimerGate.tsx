"use client";

/**
 * DisclaimerGate — blocks the calculator until the visitor accepts the legal
 * disclaimer.
 *
 *   <DisclaimerGate><CalculatorWorkspace /></DisclaimerGate>
 *
 * - `children` are NOT mounted until acceptance is confirmed, so the
 *   calculator cannot render or send calculation requests behind the pop-up.
 * - The server render and the hydration render both output a neutral
 *   "checking" placeholder. The stored acceptance is read in a layout effect
 *   right after mount (before paint), so there is no hydration mismatch and
 *   returning visitors see no flash of the pop-up.
 * - Acceptance is per browser, valid 30 days, and tied to DISCLAIMER_VERSION
 *   (src/lib/disclaimer.ts). It is independent of sign-in and of OPEN_ACCESS,
 *   so signed-in users are gated too.
 * - The only ways out are the two buttons. Escape, backdrop clicks and close
 *   controls intentionally do nothing.
 * - The legal text is SECTIONS from DisclaimerModal (single source of truth).
 *   The informational DisclaimerModal opened from the calculator is unchanged.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DISCLAIMER_COPYRIGHT,
  SECTIONS,
  linkifyDosys,
} from "@/components/calculator/DisclaimerModal";
import { hasValidDisclaimerAcceptance, recordDisclaimerAcceptance } from "@/lib/disclaimer";
import { track } from "@/lib/analytics";

type GateStatus = "checking" | "required" | "accepted";

// useLayoutEffect warns during server rendering, where effects never run anyway.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// LEGAL REVIEW: this attestation wording should be reviewed by counsel.
// Changing it requires bumping DISCLAIMER_VERSION in src/lib/disclaimer.ts.
const ATTESTATION_TEXT =
  "I am a healthcare professional or healthcare trainee, and I have read, understand, and agree to the terms above.";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Roughly the height of CalculatorWorkspace (h-screen) so the site footer does
// not jump up and back down while acceptance is being checked.
const PLACEHOLDER_STYLE = { minHeight: "100vh" } as const;

/*
 * Styles live in a scoped <style> block instead of inline style objects:
 *  - globals.css forces fonts, heading colours and corner radii with
 *    `body.theme-basic ... !important` rules (including
 *    `body.theme-basic [style] { font-family: inherit !important }` and
 *    `body.theme-basic * { border-radius: 6px !important }`) that beat inline
 *    styles. Every rule here is `.vmz-gate` + an element class (specificity
 *    0,2,0 or higher), which outranks those type/attribute-based overrides;
 *    `!important` is used only where the competing global rule has it.
 *  - :focus-visible, :hover, :disabled and media queries cannot be inline.
 * Colour contrast: body text, links, eyebrow (#355c7d) and muted text all meet
 * WCAG AA on their backgrounds; the teal focus ring (#355c7d) is >= 3:1.
 */
const GATE_CSS = `
.vmz-gate {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.72);
  overscroll-behavior: contain;
  font-family: 'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif;
  color: #1f2937;
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.vmz-gate.vmz-gate,
.vmz-gate.vmz-gate * {
  border-radius: 0 !important;
}
.vmz-gate .vmz-gate-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 680px;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px !important;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.35);
}
.vmz-gate .vmz-gate-dialog:focus {
  outline: none;
}
.vmz-gate .vmz-gate-head {
  flex: none;
  padding: 22px 24px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.vmz-gate .vmz-gate-eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #355c7d;
}
.vmz-gate .vmz-gate-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a !important;
}
.vmz-gate .vmz-gate-intro {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: #475569;
}
.vmz-gate .vmz-gate-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px 24px 8px;
}
.vmz-gate .vmz-gate-section + .vmz-gate-section {
  margin-top: 20px;
}
.vmz-gate .vmz-gate-section-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.4;
  color: #1e4d8c !important;
}
.vmz-gate .vmz-gate-section-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #1f2937;
  white-space: pre-line;
  overflow-wrap: break-word;
}
.vmz-gate .vmz-gate-copyright {
  margin: 24px 0 12px;
  font-size: 13px;
  text-align: center;
  color: #64748b;
}
.vmz-gate .vmz-gate-foot {
  flex: none;
  padding: 16px 24px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}
.vmz-gate .vmz-gate-consent {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px !important;
  background: #ffffff;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  color: #0f172a;
  cursor: pointer;
}
.vmz-gate .vmz-gate-consent:hover,
.vmz-gate .vmz-gate-consent-checked {
  border-color: #1e4d8c;
}
.vmz-gate .vmz-gate-consent-checked {
  background: #eff6ff;
}
.vmz-gate .vmz-gate-checkbox {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: #1e4d8c;
  cursor: pointer;
}
.vmz-gate .vmz-gate-checkbox:focus {
  box-shadow: none !important;
}
.vmz-gate .vmz-gate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.vmz-gate .vmz-gate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid transparent;
  border-radius: 8px !important;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.vmz-gate .vmz-gate-btn-secondary {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #334155;
}
.vmz-gate .vmz-gate-btn-secondary:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.vmz-gate .vmz-gate-btn-primary {
  background: #1e4d8c;
  border-color: #1e4d8c;
  color: #ffffff;
}
.vmz-gate .vmz-gate-btn-primary:hover:not(:disabled) {
  background: #173d70;
  border-color: #173d70;
}
.vmz-gate .vmz-gate-btn-primary:disabled {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
.vmz-gate .vmz-gate-btn:focus-visible,
.vmz-gate .vmz-gate-checkbox:focus-visible,
.vmz-gate .vmz-gate-body a:focus-visible {
  outline: 3px solid #355c7d !important;
  outline-offset: 2px !important;
}
.vmz-gate .vmz-gate-body:focus-visible {
  outline: 3px solid #355c7d !important;
  outline-offset: -3px;
}
@media (max-width: 520px) {
  .vmz-gate { padding: 8px; }
  .vmz-gate .vmz-gate-dialog {
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
  }
  .vmz-gate .vmz-gate-head { padding: 16px 16px 12px; }
  .vmz-gate .vmz-gate-title { font-size: 18px; }
  .vmz-gate .vmz-gate-body { padding: 16px 16px 4px; }
  .vmz-gate .vmz-gate-foot { padding: 12px 16px 16px; }
  .vmz-gate .vmz-gate-btn { flex: 1 1 auto; }
}
/* Very short screens (e.g. a phone turned sideways): scroll the whole dialog
   as one so the legal text area never collapses to nothing. */
@media (max-height: 560px) {
  .vmz-gate .vmz-gate-dialog { overflow-y: auto; }
  .vmz-gate .vmz-gate-body { flex: none; min-height: auto; overflow: visible; }
}
@media (prefers-reduced-motion: reduce) {
  .vmz-gate .vmz-gate-btn { transition: none; }
}
`;

export default function DisclaimerGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");

  useIsomorphicLayoutEffect(() => {
    setStatus(hasValidDisclaimerAcceptance() ? "accepted" : "required");
  }, []);

  const handleAccept = useCallback(() => {
    // Persist when storage allows. If storage is unavailable the write fails
    // silently and acceptance still holds for this visit via state below.
    recordDisclaimerAcceptance();
    track("Disclaimer Accepted");
    setStatus("accepted");
  }, []);

  if (status === "accepted") return <>{children}</>;

  return (
    <>
      <div style={PLACEHOLDER_STYLE} />
      {status === "required" && <DisclaimerAcceptanceDialog onAccept={handleAccept} />}
    </>
  );
}

function DisclaimerAcceptanceDialog({ onAccept }: { onAccept: () => void }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const legalTextRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);
  const idBase = useId();
  const titleId = `${idBase}-title`;
  const introId = `${idBase}-intro`;

  const handleExit = useCallback(() => {
    if (leavingRef.current) return; // ignore repeat clicks while navigating
    leavingRef.current = true;
    track("Disclaimer Declined");
    router.push("/");
  }, [router]);

  // Lock page scroll while the pop-up is open.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  // Initial focus and focus containment.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Start on the legal text so keyboard users can scroll it straight away and
    // screen readers begin at the top of the terms rather than at the checkbox.
    legalTextRef.current?.focus({ preventScroll: true });

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Not dismissible by design; keep Escape from reaching any other handler.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus on the dialog container itself (after clicking plain text) or
      // outside it: send Tab to the first/last control instead of the page.
      if (!active || active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Pull back focus that lands outside the dialog (e.g. moved by assistive technology).
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        (legalTextRef.current ?? dialog).focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  // Portal to <body>: #app-root can carry a CSS filter (brightness setting),
  // which would otherwise break position:fixed for the overlay.
  return createPortal(
    <div
      className="vmz-gate"
      // The backdrop does nothing on click. Cancelling mousedown on it keeps
      // focus inside the dialog instead of dropping to the page body.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <style>{GATE_CSS}</style>
      <div
        ref={dialogRef}
        className="vmz-gate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        tabIndex={-1}
      >
        <div className="vmz-gate-head">
          <p className="vmz-gate-eyebrow">Before you begin</p>
          <h2 id={titleId} className="vmz-gate-title">
            Vancomyzer{"™"} Legal Disclaimer
          </h2>
          <p id={introId} className="vmz-gate-intro">
            Please read the terms below. You must accept them before using the dosing calculator.
            This browser will remember your acceptance for up to 30 days.
          </p>
        </div>

        <div
          ref={legalTextRef}
          className="vmz-gate-body"
          role="region"
          aria-label="Full disclaimer text"
          // Focusable so the terms can be scrolled with the keyboard.
          tabIndex={0}
        >
          {SECTIONS.map((section) => (
            <section key={section.heading} className="vmz-gate-section">
              <h3 className="vmz-gate-section-title">{section.heading}</h3>
              <p className="vmz-gate-section-text">{linkifyDosys(section.body)}</p>
            </section>
          ))}
          <p className="vmz-gate-copyright">{DISCLAIMER_COPYRIGHT}</p>
        </div>

        <div className="vmz-gate-foot">
          <label className={agreed ? "vmz-gate-consent vmz-gate-consent-checked" : "vmz-gate-consent"}>
            <input
              type="checkbox"
              className="vmz-gate-checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              aria-required="true"
            />
            <span>{ATTESTATION_TEXT}</span>
          </label>
          <div className="vmz-gate-actions">
            <button type="button" className="vmz-gate-btn vmz-gate-btn-secondary" onClick={handleExit}>
              Exit
            </button>
            <button
              type="button"
              className="vmz-gate-btn vmz-gate-btn-primary"
              onClick={onAccept}
              disabled={!agreed}
            >
              Accept and continue
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
