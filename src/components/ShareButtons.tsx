import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { encodeShareState, buildShareUrl, copyToClipboard, type ShareStateV1 } from "@/lib/shareLink";
import type { PkCalculateResponse } from "@/lib/api";

export default function ShareButtons({
  result,
}: {
  result?: PkCalculateResponse;
}) {
  const [copied, setCopied] = useState<"" | "link" | "summary">("");

  const encoded = useMemo(() => {
    if (!result) return null;
    const state: ShareStateV1 = {
      v: 1,
      result: {
        loadingDoseMg: result.loadingDoseMg ?? null,
        maintenanceDoseMg: Math.round(result.maintenanceDoseMg),
        intervalHr: result.intervalHr,
        auc24: Math.round(result.auc24),
      },
    };
    return encodeShareState(state);
  }, [result]);

  const shareUrl = useMemo(() => (encoded ? buildShareUrl(encoded) : null), [encoded]);

  async function onCopyLink() {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    setCopied(ok ? "link" : "");
    window.setTimeout(() => setCopied(""), 1200);
  }

  async function onCopySummary() {
    if (!result) return;
    const summary = `Vancomyzer suggested regimen: ${Math.round(result.maintenanceDoseMg)} mg q${result.intervalHr}h (AUC24 ~ ${Math.round(result.auc24)}).`;
    const ok = await copyToClipboard(summary);
    setCopied(ok ? "summary" : "");
    window.setTimeout(() => setCopied(""), 1200);
  }

  if (!result) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={onCopySummary}>
        {copied === "summary" ? "Copied" : "Copy summary"}
      </Button>
      <Button size="sm" variant="secondary" onClick={onCopyLink}>
        {copied === "link" ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
