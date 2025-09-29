import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Level } from "@/pk/levels";
import { Activity, Plus, Trash2 } from "lucide-react";

interface LevelsInputProps {
  levels: Level[];
  onChange: (levels: Level[]) => void;
}

export function LevelsInput({ levels, onChange }: LevelsInputProps) {
  const [newLevel, setNewLevel] = useState<Partial<Level>>({
    time: undefined,
    concentration: undefined
  });

  const addLevel = () => {
    if (newLevel.time !== undefined && newLevel.concentration !== undefined) {
      const level: Level = {
        time: newLevel.time,
        concentration: newLevel.concentration,
        doseNumber: levels.length
      };
      
      onChange([...levels, level]);
      setNewLevel({ time: undefined, concentration: undefined });
    }
  };

  const removeLevel = (index: number) => {
    const updated = levels.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateLevel = (index: number, field: keyof Level, value: number) => {
    const updated = levels.map((level, i) => 
      i === index ? { ...level, [field]: value } : level
    );
    onChange(updated);
  };

  const canAddLevel = newLevel.time !== undefined && 
                      newLevel.concentration !== undefined && 
                      newLevel.time > 0 && 
                      newLevel.concentration > 0;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Measured Levels
          {levels.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {levels.length} level{levels.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Enter measured vancomycin concentrations for individual PK fitting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Levels */}
        {levels.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Current Levels</h4>
            {levels.map((level, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Time (hours)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={level.time}
                      onChange={(e) => updateLevel(index, 'time', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Concentration (mg/L)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={level.concentration}
                      onChange={(e) => updateLevel(index, 'concentration', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeLevel(index)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Level */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Add New Level</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-sm font-medium">
                Time After Dose (hours)
              </Label>
              <Input
                id="new-time"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g., 1.0"
                value={newLevel.time || ''}
                onChange={(e) => setNewLevel(prev => ({ 
                  ...prev, 
                  time: e.target.value ? Number(e.target.value) : undefined 
                }))}
                className="transition-all duration-200 focus:shadow-focus"
              />
              <div className="text-xs text-muted-foreground">
                Time from start of infusion
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-conc" className="text-sm font-medium">
                Concentration (mg/L)
              </Label>
              <Input
                id="new-conc"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g., 15.2"
                value={newLevel.concentration || ''}
                onChange={(e) => setNewLevel(prev => ({ 
                  ...prev, 
                  concentration: e.target.value ? Number(e.target.value) : undefined 
                }))}
                className="transition-all duration-200 focus:shadow-focus"
              />
              <div className="text-xs text-muted-foreground">
                Measured serum concentration
              </div>
            </div>
          </div>
          
          <Button 
            onClick={addLevel}
            disabled={!canAddLevel}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Level
          </Button>
        </div>

        {levels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <div className="text-sm">
              No levels entered yet. Add measured concentrations to enable individual PK fitting.
            </div>
          </div>
        )}

        {levels.length > 0 && (
          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <strong>Tip:</strong> For best results, include both peak (end-of-infusion) and trough (pre-dose) levels.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
