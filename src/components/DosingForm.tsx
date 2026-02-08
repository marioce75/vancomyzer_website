import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Regimen } from "@/pk/core";

interface DosingFormProps {
  regimen: Regimen;
  onChange: (regimen: Regimen) => void;
}

export function DosingForm({ regimen, onChange }: DosingFormProps) {
  const updateField = (field: keyof Regimen, value: number) => {
    onChange({ ...regimen, [field]: value });
  };

  const handleDoseChange = (value: number) => {
    // Round to nearest 250 mg
    const roundedDose = Math.round(value / 250) * 250;
    updateField('dose', Math.max(250, Math.min(4000, roundedDose)));
  };

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          Dosing Regimen
        </CardTitle>
        <CardDescription>
          Configure vancomycin dose, interval, and infusion time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center justify-between">
              Dose (mg)
              <span className="text-muted-foreground text-xs">Step: 250 mg</span>
            </Label>
            <div className="space-y-3">
              <Slider
                value={[regimen.dose]}
                onValueChange={([value]) => handleDoseChange(value)}
                min={250}
                max={4000}
                step={250}
                className="w-full"
              />
              <Input
                type="number"
                min="250"
                max="4000"
                step="250"
                value={regimen.dose}
                onChange={(e) => handleDoseChange(Number(e.target.value))}
                className="transition-all duration-200 focus:shadow-focus"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="interval" className="text-sm font-medium">
              Dosing Interval (hours)
            </Label>
            <Select 
              value={regimen.interval.toString()} 
              onValueChange={(value) => updateField('interval', Number(value))}
            >
              <SelectTrigger id="interval" className="transition-all duration-200 focus:shadow-focus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">Every 8 hours (Q8H)</SelectItem>
                <SelectItem value="12">Every 12 hours (Q12H)</SelectItem>
                <SelectItem value="24">Every 24 hours (Q24H)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="infusion" className="text-sm font-medium">
              Infusion Time (minutes)
            </Label>
            <Select 
              value={regimen.infusionTime.toString()} 
              onValueChange={(value) => updateField('infusionTime', Number(value))}
            >
              <SelectTrigger id="infusion" className="transition-all duration-200 focus:shadow-focus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">120 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="pt-2 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Daily Dose</span>
              <div className="font-medium text-primary">
                {Math.round((regimen.dose * 24) / regimen.interval)} mg/day
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Dose Frequency</span>
              <div className="font-medium text-primary">
                {24 / regimen.interval} doses/day
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Infusion Rate</span>
              <div className="font-medium text-primary">
                {Math.round((regimen.dose / regimen.infusionTime) * 60)} mg/h
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}