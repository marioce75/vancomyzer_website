import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <Alert className="border-warning bg-warning/10 text-warning-foreground mb-6">
      <AlertTriangle className="h-5 w-5 text-warning" />
      <AlertDescription className="text-sm font-medium">
        <strong>EDUCATIONAL TOOL ONLY:</strong> This calculator is for educational purposes and should not replace clinical judgment. 
        Always follow your institutional guidelines and consult with a pharmacist or physician before making dosing decisions. 
        Individual patient factors may significantly affect vancomycin pharmacokinetics.
      </AlertDescription>
    </Alert>
  );
}