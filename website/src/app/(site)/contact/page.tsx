"use client";
import { LocalizedInput, LocalizedTextarea } from "@/localization/LocalizedElements";

import { LocalizedText, useLanguage } from "@/localization/LanguageProvider";


import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Record, INK, INK2, INK3, RULE } from "@/components/site/Record";

const channels = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    title: "Hospital & institutional",
    email: "contact@vancomyzer.com",
    description: "Questions about access, institutional requirements or evaluation.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: "Research & academic",
    email: "contact@dosys.health",
    description: "Questions about research collaboration and pharmacokinetic models.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Clinical support",
    subtitle: "Use the form below",
    description: "Questions about the calculator or interpreting its results.",
  },
];

const topics = [
  { value: "restricted_access", label: "Request restricted access" },
  { value: "technical", label: "Technical questions" },
  { value: "hospital", label: "Hospital / institutional pilot" },
  { value: "research", label: "Research & academic collaboration" },
  { value: "clinical", label: "Clinical support question" },
  { value: "other", label: "Other" },
];

export default function ContactPage() {
  const { locale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("other");
  const [message, setMessage] = useState("");
  const [acknowledgement, setAcknowledgement] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("topic") === "restricted_access") setTopic("restricted_access");
  }, []);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, locale, acknowledgement: topic === "restricted_access" && acknowledgement }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send inquiry.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again or email us directly.");
    }

    setLoading(false);
  };

  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="Contact · Dōsys LLC"
        title="Reach the team behind Vancomyzer™"
        compact
        lede="Questions about the calculator, its evidence or restricted access. Use the appropriate topic below. Do not include patient information."
      />
      <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
        <h2 className="text-xl font-semibold"><LocalizedText text="Saved history and institutional access" /></h2>
        <p className="mt-3"><LocalizedText text="Saved history and institutional features remain restricted and are not currently available for new access requests. You may register your interest using the access-request topic." /></p>
        <p className="mt-3"><LocalizedText text="For technical questions, email contact@vancomyzer.com or sign in and use the bug-report form in the calculator’s Settings." /></p>
        <a className="mt-2 inline-block underline" href="mailto:contact@vancomyzer.com">contact@vancomyzer.com</a>
      </section>
      <Record label="Addresses" note="Two mailboxes, one for each kind of question.">
      {/* Channel cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {channels.map((ch) => (
          <div
            key={ch.title}
            className="flex flex-col gap-3 border bg-white p-5" style={{ borderColor: RULE }}
          >
            <span style={{ color: "#1f5e96" }}>{ch.icon}</span>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: INK }}><LocalizedText text={ch.title} /></h3>
              {ch.email ? (
                <a
                  href={`mailto:${ch.email}`}
                  className="text-sm text-[#1f5e96] hover:underline"
                >
                  {ch.email}
                </a>
              ) : ch.subtitle ? (
                <p className="text-sm font-medium text-[#1f5e96]"><LocalizedText text={ch.subtitle} /></p>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: INK2 }}><LocalizedText text={ch.description} /></p>
          </div>
        ))}
      </div>
      </Record>

      {/* Inquiry form */}
      <Record label="Send an inquiry" note="We reply by email." last>
      <div className="border bg-white p-6 sm:p-8" style={{ borderColor: RULE }}>
        {success ? (
          <div className="text-center py-8">
            <h2 className="vz-serif text-[22px]" style={{ color: INK }}><LocalizedText text="Inquiry sent" /></h2>
            <p className="mt-2 text-sm" style={{ color: INK2 }}><LocalizedText text="Thank you. We will reply by email." /></p>
          </div>
        ) : (
          <>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <LocalizedText text={error} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: INK3 }}><LocalizedText text="Name" /></label>
                  <LocalizedInput
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Full name"
                    style={{ fontFamily: "inherit" }}
                    className="w-full border border-[#cbd6e0] px-3 py-2.5 text-sm text-[#14232f] placeholder:text-[#546471] focus:border-[#1f5e96] focus:outline-none focus:ring-1 focus:ring-[#1f5e96]"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: INK3 }}><LocalizedText text="Email" /></label>
                  <LocalizedInput
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@hospital.org"
                    style={{ fontFamily: "inherit" }}
                    className="w-full border border-[#cbd6e0] px-3 py-2.5 text-sm text-[#14232f] placeholder:text-[#546471] focus:border-[#1f5e96] focus:outline-none focus:ring-1 focus:ring-[#1f5e96]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-topic" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: INK3 }}><LocalizedText text="Topic" /></label>
                <select
                  id="contact-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ fontFamily: "inherit" }}
                    className="w-full border border-[#cbd6e0] px-3 py-2.5 text-sm text-[#14232f] focus:border-[#1f5e96] focus:outline-none focus:ring-1 focus:ring-[#1f5e96] bg-white"
                >
                  {topics.map((t) => (
                    <option key={t.value} value={t.value}><LocalizedText text={t.label} /></option>
                  ))}
                </select>
              </div>

              {topic === "restricted_access" && <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={acknowledgement} onChange={e => setAcknowledgement(e.target.checked)} className="mt-1" />
                <LocalizedText text="Send me an acknowledgement of this restricted-access enquiry by email." />
              </label>}
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: INK3 }}><LocalizedText text="Message" /></label>
                <LocalizedTextarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Tell us about your institution and what you're looking for..."
                  style={{ fontFamily: "inherit" }}
                    className="w-full border border-[#cbd6e0] px-3 py-2.5 text-sm text-[#14232f] placeholder:text-[#546471] focus:border-[#1f5e96] focus:outline-none focus:ring-1 focus:ring-[#1f5e96] resize-vertical"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "#e6eef5" }}>
                <p className="text-xs" style={{ color: INK3 }}><LocalizedText text="By submitting you agree to our" />{" "}
                  <Link href="/privacy" className="underline" style={{ color: "#1f5e96" }}><LocalizedText text="privacy policy" /></Link>.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="vz-mbtn vz-mbtn--primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LocalizedText text={loading ? "Sending..." : "Submit inquiry"} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      </Record>
    </div>
  );
}
