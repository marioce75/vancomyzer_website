import React, { useEffect, useState } from "react";
import { Chip, Box } from "@mui/material";

const ApiHealthBadge = () => {
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || "/api";
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
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
