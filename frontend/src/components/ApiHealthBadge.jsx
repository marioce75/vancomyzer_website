import React, { useEffect, useState } from "react";
import { Chip, Box } from "@mui/material";
import { apiPath, API_BASE } from '../lib/apiBase';

const API_HEALTH_URL = API_BASE ? apiPath('/health') : '';

const ApiHealthBadge = () => {
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    if (!API_HEALTH_URL) { setApiStatus('offline'); return; }
    fetch(API_HEALTH_URL, { headers: { Accept: "application/json" } })
      .then(async (res) => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then((data) => { setApiStatus(data?.status === "ok" ? "healthy" : "unhealthy"); })
      .catch(() => setApiStatus("offline"));
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
