import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeConcentrationPoint } from "@/pk/core";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ConcentrationChartProps {
  data: TimeConcentrationPoint[];
  regimen: { interval: number; infusionTime: number };
}

export function ConcentrationChart({ data, regimen }: ConcentrationChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const concentration = payload[0].value;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-elevated">
          <div className="text-sm font-medium text-foreground">
            Time: {Number(label).toFixed(1)} hours
          </div>
          <div className="text-sm text-primary">
            Concentration: {Number(concentration).toFixed(2)} mg/L
          </div>
        </div>
      );
    }
    return null;
  };

  // Add vertical lines for dose times
  const doseLines = [];
  for (let i = 0; i <= 48; i += regimen.interval) {
    doseLines.push(i);
  }

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          Concentration-Time Profile
        </CardTitle>
        <CardDescription>
          Predicted steady-state vancomycin concentrations over 48 hours
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3}
              />
              <XAxis 
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}`}
                label={{ 
                  value: 'Concentration (mg/L)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '12px', fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for dose times */}
              {doseLines.map((time, index) => (
                <ReferenceLine 
                  key={index}
                  x={time} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="2 2"
                  opacity={0.3}
                />
              ))}
              
              <Line 
                type="monotone" 
                dataKey="concentration" 
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: "hsl(var(--primary))",
                  stroke: "hsl(var(--card))",
                  strokeWidth: 2
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-primary"></div>
              <span>Concentration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-primary opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--primary)) 0, hsl(var(--primary)) 2px, transparent 2px, transparent 4px)' }}></div>
              <span>Dose times</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}