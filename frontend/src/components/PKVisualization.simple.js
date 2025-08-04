import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

const PKVisualization = ({ dosingResult, bayesianResult, realTimeData, patient }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">PK Visualization</Typography>
        <Typography>
          This is a simplified version. Complex visualizations will be added back once the app is stable.
        </Typography>
        {dosingResult && (
          <div>
            <p>AUC: {dosingResult.predicted_auc_24} mg·h/L</p>
            <p>Trough: {dosingResult.predicted_trough} mg/L</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PKVisualization;