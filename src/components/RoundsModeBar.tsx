import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function RoundsModeBar({
  enabled,
  onChange,
  onCopyRoundsSummary,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  onCopyRoundsSummary: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Rounds mode</Label>
        <Switch checked={enabled} onCheckedChange={onChange} />
      </div>
      {enabled && (
        <Button size="sm" variant="secondary" onClick={onCopyRoundsSummary}>
          Copy rounds summary
        </Button>
      )}
    </div>
  );
}
