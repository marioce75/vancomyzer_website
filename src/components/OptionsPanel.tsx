import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { PKOptions } from "@/pk/core";
import { Settings } from "lucide-react";

interface OptionsPanelProps {
  options: PKOptions;
  onChange: (options: PKOptions) => void;
}

export function OptionsPanel({ options, onChange }: OptionsPanelProps) {
  const updateField = (field: keyof PKOptions, value: PKOptions[keyof PKOptions]) => {
    onChange({ ...options, [field]: value });
  };

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Clinical Options
        </CardTitle>
        <CardDescription>
          Configure calculation parameters and clinical considerations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weight Strategy */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Weight Strategy</Label>
            <Select 
              value={options.weightStrategy} 
              onValueChange={(value: PKOptions['weightStrategy']) => updateField('weightStrategy', value)}
            >
              <SelectTrigger className="transition-all duration-200 focus:shadow-focus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">Auto (Recommended)</SelectItem>
                <SelectItem value="TBW">Total Body Weight</SelectItem>
                <SelectItem value="IBW">Ideal Body Weight</SelectItem>
                <SelectItem value="AdjBW">Adjusted Body Weight</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Auto: TBW if underweight, AdjBW if obese (BMI ≥30), IBW otherwise
            </div>
          </div>

          {/* AUC Method */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">AUC₂₄ Method</Label>
            <Select 
              value={options.aucMethod} 
              onValueChange={(value: PKOptions['aucMethod']) => updateField('aucMethod', value)}
            >
              <SelectTrigger className="transition-all duration-200 focus:shadow-focus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doseCL">Dose/Clearance (Faster)</SelectItem>
                <SelectItem value="trapezoid">Trapezoidal Integration</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Dose/CL provides rapid calculation, trapezoid uses simulation data
            </div>
          </div>

          {/* Serum Creatinine Policy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">SCr Floor Policy</Label>
              <Switch
                checked={options.scrPolicy === 'floor'}
                onCheckedChange={(checked) => updateField('scrPolicy', checked ? 'floor' : 'none')}
              />
            </div>
            {options.scrPolicy === 'floor' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Minimum SCr (mg/dL)</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="1.0"
                  step="0.1"
                  value={options.scrFloor}
                  onChange={(e) => updateField('scrFloor', Number(e.target.value))}
                  className="transition-all duration-200 focus:shadow-focus"
                />
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {options.scrPolicy === 'floor' 
                ? `SCr values below ${options.scrFloor} mg/dL will be adjusted upward`
                : 'Use actual SCr values without adjustment'
              }
            </div>
          </div>

          {/* Volume of Distribution */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Vd per kg (L/kg)</Label>
            <Input
              type="number"
              min="0.5"
              max="1.0"
              step="0.1"
              value={options.vdPerKg}
              onChange={(e) => updateField('vdPerKg', Number(e.target.value))}
              className="transition-all duration-200 focus:shadow-focus"
            />
            <div className="text-xs text-muted-foreground">
              Typical range: 0.6-0.9 L/kg. Consider higher values for obesity or fluid overload.
            </div>
          </div>
        </div>

        {/* Advanced PK Parameters */}
        <div className="pt-4 border-t border-border">
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground text-sm">Advanced PK Parameters</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">CL Scale Factor</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={options.clScale}
                  onChange={(e) => updateField('clScale', Number(e.target.value))}
                  className="transition-all duration-200 focus:shadow-focus"
                />
                <div className="text-xs text-muted-foreground">
                  Multiplier for clearance calculation (default: 1.0)
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">CL Offset (L/h)</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={options.clOffset}
                  onChange={(e) => updateField('clOffset', Number(e.target.value))}
                  className="transition-all duration-200 focus:shadow-focus"
                />
                <div className="text-xs text-muted-foreground">
                  Additive clearance offset (default: 0)
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}