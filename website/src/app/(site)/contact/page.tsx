"use client";

import { useState } from "react";
import Link from "next/link";

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
    description: "Pilot requests, BAA inquiries, pharmacy director demos, pricing for departments and health systems.",
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
    description: "Research partnership inquiries, NIH STTR collaboration, PK model discussion, publication co-authorship.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Clinical support",
    subtitle: "Response in < 1 business day",
    description: "Calculator questions, clinical edge cases, and dosing workflow guidance.",
  },
];

const topics = [
  { value: "hospital", label: "Hospital / institutional pilot" },
  { value: "research", label: "Research & academic collaboration" },
  { value: "clinical", label: "Clinical support question" },
  { value: "other", label: "Other" },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("hospital");
  const [message, setMessage] = useState("");
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
        body: JSON.stringify({ name, email, topic, message }),
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
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
        Contact ·{" "}
        <a
          href="https://dosys.health"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Dōsys LLC
        </a>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        Reach the team behind Vancomyzer™
      </h1>
      <p className="mt-4 text-gray-600 leading-7">
        Built by an ICU pharmacist. Backed by evidence. Available to every hospital.
      </p>
      <p className="text-gray-600">
        Choose the right channel for your inquiry below.
      </p>

      {/* Channel cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {channels.map((ch) => (
          <div
            key={ch.title}
            className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col gap-3"
          >
            <span className="text-teal-500">{ch.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{ch.title}</h3>
              {ch.email ? (
                <a
                  href={`mailto:${ch.email}`}
                  className="text-sm text-teal-600 hover:underline"
                >
                  {ch.email}
                </a>
              ) : ch.subtitle ? (
                <p className="text-sm font-medium text-teal-600">{ch.subtitle}</p>
              ) : null}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{ch.description}</p>
          </div>
        ))}
      </div>

      {/* Inquiry form */}
      <div className="mt-10 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
        {success ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-gray-900">Inquiry sent</h2>
            <p className="mt-2 text-sm text-gray-600">
              Thank you for reaching out. We will respond within 1 business day.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Send an inquiry</h2>
              <span className="text-xs text-gray-400">All fields required</span>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Full name"
                    className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@hospital.org"
                    className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Topic
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                >
                  {topics.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Tell us about your institution and what you're looking for..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-vertical"
                />
              </div>

              <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  By submitting you agree to our{" "}
                  <Link href="/privacy" className="underline hover:text-gray-600">
                    privacy policy
                  </Link>.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Submit inquiry"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
