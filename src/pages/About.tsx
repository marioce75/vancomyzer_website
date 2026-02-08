import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { getSupportVersion, type SupportVersionResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function About() {
  const { toast } = useToast();
  const [version, setVersion] = useState<SupportVersionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupportVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load version");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const friendly = useMemo(() => {
    if (!version) return null;
    const dt = new Date(version.build_time);
    const updated = isNaN(dt.getTime())
      ? "Unknown date"
      : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    return `Version ${version.version} (Updated ${updated})`;
  }, [version]);

  async function onCopyDetails() {
    if (!version) return;
    const text = JSON.stringify(version, null, 2);
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Version details copied to clipboard." });
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">About</h1>

      <div className="space-y-3 text-sm">
        <p>Built by clinicians and engineers to make AUC-based vancomycin dosing fast and clear.</p>
        <p>No PHI stored. Product-led growth: simple, accurate, and shareable.</p>
        <p>Contact: placeholder@example.com</p>
      </div>

      <div className="rounded-lg border bg-sky-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Version</div>
            <div className="text-sm text-muted-foreground">{friendly ?? "Loading…"}</div>
          </div>
          <Button variant="secondary" disabled={!version} onClick={onCopyDetails}>
            Copy details
          </Button>
        </div>
        {error && (
          <Alert className="mt-3">
            <div className="text-xs">{error}</div>
          </Alert>
        )}
      </div>
    </div>
  );
}
