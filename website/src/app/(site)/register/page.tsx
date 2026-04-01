"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [credentials, setCredentials] = useState("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 agreements
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [confirmedHcp, setConfirmedHcp] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const disclaimerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = disclaimerRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setScrolledToBottom(true);
    }
  }, []);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password min 8 characters."); return; }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain uppercase, lowercase, and number."); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError("Username: letters, numbers, underscores only."); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName, credentials, institution, email, username, password,
        agreed_disclaimer: agreedDisclaimer, agreed_terms: agreedTerms,
        confirmed_hcp: confirmedHcp, confirmed_age: confirmedAge,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Registration failed."); return; }
    setSuccess(true);
  };

  const allAgreed = agreedDisclaimer && agreedTerms && confirmedHcp && confirmedAge;

  const inputStyle = {
    width: "100%", padding: "10px 12px", fontSize: 14,
    border: "1px solid #a0aec0", background: "#ffffff", color: "#1a202c",
    boxSizing: "border-box" as const, borderRadius: 4,
  };
  const labelStyle = { display: "block" as const, fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 };

  if (success) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, padding: 32, background: "#ffffff", border: "1px solid #cbd5e0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#047857" }}>Registration Submitted</h1>
          <p style={{ fontSize: 13, color: "#4a5568", marginTop: 12, lineHeight: 1.6 }}>
            Your account is pending review. You will be notified at <strong>{email}</strong> when approved.
          </p>
          <Link href="/login" style={{ display: "inline-block", marginTop: 20, fontSize: 13, color: "#1e4d8c", fontWeight: 600 }}>
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: "100%", maxWidth: 480, background: "#ffffff",
        border: "1px solid #cbd5e0", padding: 32,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", borderRadius: 8,
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="Vancomyzer" width={48} height={48} style={{ margin: "0 auto 12px" }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e4d8c", margin: 0 }}>
            {step === 1 ? "Create an Account" : "Legal Agreements"}
          </h1>
          <p style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>Step {step} of 2</p>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 16, background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4 }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Full Legal Name *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Dr. Jane Smith" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Professional Credentials *</label>
              <input type="text" value={credentials} onChange={e => setCredentials(e.target.value)} required placeholder="PharmD, MD, RPh" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Institution / Hospital <span style={{ color: "#a0aec0", fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="City Hospital" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="pharmacist@hospital.org" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Username *</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="jsmith" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 8 chars, upper+lower+number" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Confirm Password *</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" style={inputStyle} />
            </div>
            <button type="submit" style={{ width: "100%", padding: 12, fontSize: 14, fontWeight: 600, background: "#1e4d8c", color: "#fff", border: "none", cursor: "pointer", borderRadius: 4 }}>
              Continue to Agreements →
            </button>
          </form>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 12, color: "#4a5568", marginBottom: 8 }}>
              Please read the Medical Disclaimer below. Scroll to the bottom to enable the agreement checkboxes.
            </p>
            <div
              ref={disclaimerRef}
              onScroll={handleScroll}
              style={{
                maxHeight: 280, overflowY: "auto", padding: 12,
                border: "1px solid #cbd5e0", background: "#f7fafc", fontSize: 11,
                color: "#2d3748", lineHeight: 1.6, marginBottom: 16, borderRadius: 4,
              }}
            >
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#1a3a5c", marginBottom: 8 }}>VANCOMYZER™ MEDICAL DISCLAIMER</h3>
              <p><strong>For Healthcare Professionals Only</strong></p>
              <p>Vancomyzer™ is intended solely for use by qualified healthcare professionals, including licensed physicians, pharmacists, and other clinicians with appropriate training in vancomycin pharmacokinetics and therapeutic drug monitoring. This tool is not intended for use by patients, caregivers, or non-clinical personnel.</p>
              <p><strong>Not Medical Advice</strong></p>
              <p>Vancomyzer™ provides clinical decision-support information for clinician review only. Nothing on this site constitutes medical advice, a prescription, a diagnosis, or a treatment recommendation. All dosing outputs are model-based review aids generated from pharmacokinetic calculations. They must be independently reviewed and validated by a licensed clinician before any clinical application.</p>
              <p><strong>Regulatory Status</strong></p>
              <p>Vancomyzer™ has not been cleared or approved by the U.S. Food and Drug Administration as a medical device. It is provided as non-device clinical decision support software under Section 520(o)(1)(E) of the Federal Food, Drug and Cosmetic Act as amended by the 21st Century Cures Act.</p>
              <p><strong>Scope</strong></p>
              <p>This tool is scoped to adult intermittent intravenous vancomycin only. It is not validated for pediatric use, continuous infusion, renal replacement therapy, or conditions outside the stated assumptions.</p>
              <p><strong>Limitation of Liability</strong></p>
              <p>THIS TOOL IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL THE DEVELOPERS BE LIABLE FOR ANY DAMAGES ARISING OUT OF THE USE OF THIS TOOL.</p>
              <p style={{ marginTop: 12, padding: 8, background: "#e2e8f0", textAlign: "center", fontWeight: 600, fontSize: 10, color: "#4a5568" }}>
                — END OF DISCLAIMER — Scroll complete. You may now accept the agreements below.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {[
                { checked: agreedDisclaimer, set: setAgreedDisclaimer, label: "I have read and agree to the Vancomyzer™ Medical Disclaimer (March 2026)" },
                { checked: agreedTerms, set: setAgreedTerms, label: "I have read and agree to the Terms of Use" },
                { checked: confirmedHcp, set: setConfirmedHcp, label: "I confirm I am a licensed healthcare professional" },
                { checked: confirmedAge, set: setConfirmedAge, label: "I confirm I am 18 years of age or older" },
              ].map((item, i) => (
                <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: scrolledToBottom ? "#1a202c" : "#a0aec0", cursor: scrolledToBottom ? "pointer" : "not-allowed" }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => { if (scrolledToBottom) item.set(!item.checked); }}
                    disabled={!scrolledToBottom}
                    style={{ marginTop: 2, accentColor: "#1e4d8c" }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, fontSize: 13, background: "#f7fafc", color: "#4a5568", border: "1px solid #cbd5e0", cursor: "pointer", borderRadius: 4 }}>
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allAgreed || loading}
                style={{
                  flex: 2, padding: 12, fontSize: 14, fontWeight: 600,
                  background: allAgreed ? "#1e4d8c" : "#cbd5e0",
                  color: allAgreed ? "#fff" : "#a0aec0",
                  border: "none", cursor: allAgreed && !loading ? "pointer" : "not-allowed",
                  borderRadius: 4,
                }}
              >
                {loading ? "Registering..." : "Create Account"}
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#718096" }}>
          Already have an account? <Link href="/login" style={{ color: "#1e4d8c", fontWeight: 600, textDecoration: "none" }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
