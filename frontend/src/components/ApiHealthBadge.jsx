import React, { useEffect, useState } from "react";
import { Chip, Box } from "@mui/material";

const API_HEALTH_URL = "https://vancomyzer.onrender.com/api/health";

const ApiHealthBadge = () => {
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    fetch(API_HEALTH_URL, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === "healthy") {
          setApiStatus("healthy");
        } else {
          setApiStatus("unhealthy");
        }
      })
      .catch(() => setApiStatus("offline"));
  }, []);

  const statusColor = {
    healthy: "success",
    unhealthy: "warning",
    offline: "error",
    checking: "default",
  };

  const statusLabel = {
    healthy: "API: Healthy",
    unhealthy: "API: Unhealthy",
    offline: "API: Offline",
    checking: "API: Checking...",
  };

  return (
    <Box mt={2}>
      <Chip
        label={statusLabel[apiStatus]}
        color={statusColor[apiStatus]}
        variant="outlined"
      />
    </Box>
  );
};

export default ApiHealthBadge;
