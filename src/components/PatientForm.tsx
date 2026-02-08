import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient } from "@/pk/core";

interface PatientFormProps {
  patient: Patient;
  onChange: (patient: Patient) => void;
}

export function PatientForm({ patient, onChange }: PatientFormProps) {
  const updateField = (field: keyof Patient, value: Patient[keyof Patient]) => {
    onChange({ ...patient, [field]: value });
  };

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          Patient Demographics
        </CardTitle>
        <CardDescription>
          Enter patient information for pharmacokinetic calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age" className="text-sm font-medium">
              Age (years)
            </Label>
            <Input
              id="age"
              type="number"
              min="18"
              max="120"
              value={patient.age}
              onChange={(e) => updateField('age', Number(e.target.value))}
              className="transition-all duration-200 focus:shadow-focus"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sex" className="text-sm font-medium">
              Sex
            </Label>
            <Select value={patient.sex} onValueChange={(value: 'M' | 'F') => updateField('sex', value)}>
              <SelectTrigger id="sex" className="transition-all duration-200 focus:shadow-focus">
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium">
              Weight (kg)
            </Label>
            <Input
              id="weight"
              type="number"
              min="30"
              max="300"
              step="0.1"
              value={patient.weight}
              onChange={(e) => updateField('weight', Number(e.target.value))}
              className="transition-all duration-200 focus:shadow-focus"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="height" className="text-sm font-medium">
              Height (cm)
            </Label>
            <Input
              id="height"
              type="number"
              min="100"
              max="250"
              value={patient.height}
              onChange={(e) => updateField('height', Number(e.target.value))}
              className="transition-all duration-200 focus:shadow-focus"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="scr" className="text-sm font-medium">
              Serum Creatinine (mg/dL)
            </Label>
            <Input
              id="scr"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={patient.scr}
              onChange={(e) => updateField('scr', Number(e.target.value))}
              className="transition-all duration-200 focus:shadow-focus"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}