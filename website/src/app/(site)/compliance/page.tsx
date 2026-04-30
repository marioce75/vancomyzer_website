"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const documents = [
  {
    title: "Information Security Policy",
    filename: "vancomyzer-information-security-policy.pdf",
    description: "Organizational security controls, encryption standards, and data handling procedures.",
  },
  {
    title: "Access Control Policy",
    filename: "vancomyzer-access-control-policy.pdf",
    description: "Authentication, authorization, role-based access, and session management.",
  },
  {
    title: "Change Management Policy",
    filename: "vancomyzer-change-management-policy.pdf",
    description: "Software release process, code review, testing, and deployment controls.",
  },
  {
    title: "Business Continuity Plan",
    filename: "vancomyzer-business-continuity-plan.pdf",
    description: "Disaster recovery, backup procedures, and incident response protocols.",
  },
];

export default function CompliancePage() {
  const { user, loading: authLoading } = useAuth();
  const { data: session, status } = useSession();
  const router = useRouter();

  const tier =
    (session?.user as Record<string, unknown> | undefined)?.subscriptionTier as string | undefined;

  useEffect(() => {
    if (status === "loading" || authLoading) return;
    if (!user || tier !== "hospital") {
      router.replace("/pricing");
    }
  }, [user, tier, status, authLoading, router]);

  if (status === "loading" || authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p style={{ color: "var(--color-secondary)" }}>Loading...</p>
      </main>
    );
  }

  if (!user || tier !== "hospital") {
    return null;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1
        className="text-2xl font-bold tracking-tight"
        style={{ color: "var(--color-primary)" }}
      >
        SOC 2 Compliance Documentation
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        Available to Hospital plan subscribers.
      </p>

      <div className="mt-8 space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.filename}
            className="flex items-start justify-between gap-4 rounded-lg border p-5"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <div className="flex-1">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--color-foreground)" }}
              >
                {doc.title}
              </h2>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: "var(--color-secondary)" }}
              >
                {doc.description}
              </p>
            </div>
            <a
              href={`/compliance/${doc.filename}`}
              download
              className="shrink-0 rounded px-3 py-1.5 text-xs font-semibold transition"
              style={{
                border: "1px solid #0d9488",
                color: "#0d9488",
                background: "transparent",
              }}
            >
              Download PDF
            </a>
          </div>
        ))}
      </div>

      <div
        className="mt-10 rounded-lg border p-5"
        style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--color-foreground)" }}
        >
          Platform Information
        </h2>
        <dl className="mt-3 space-y-2 text-xs" style={{ color: "var(--color-secondary)" }}>
          <div className="flex gap-2">
            <dt className="font-medium" style={{ color: "var(--color-foreground)" }}>
              Application Version:
            </dt>
            <dd>1.0.0</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium" style={{ color: "var(--color-foreground)" }}>
              Last Security Review:
            </dt>
            <dd>March 2026</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium" style={{ color: "var(--color-foreground)" }}>
              SOC 2 Type I Target:
            </dt>
            <dd>Q4 2026</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
