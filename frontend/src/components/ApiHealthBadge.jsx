import React, { useEffect, useState } from "react";
import { Chip, Box } from "@mui/material";
import { checkHealth } from '../lib/apiBase';

const ApiHealthBadge = () => {
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    (async () => {
      const res = await checkHealth();
      setApiStatus(res.ok ? 'healthy' : 'offline');
    })();
  }, []);

  const statusColor = { healthy: "success", unhealthy: "warning", offline: "error", checking: "default" };
  const statusLabel = { healthy: "API: Healthy", unhealthy: "API: Unhealthy", offline: "API: Offline", checking: "API: Checking..." };

  return (
    <Box mt={2}>
      <Chip label={statusLabel[apiStatus]} color={statusColor[apiStatus]} variant="outlined" />
    </Box>
  );
};

export default ApiHealthBadge;
