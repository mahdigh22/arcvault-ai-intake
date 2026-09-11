import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function MetricCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            {label.toUpperCase()}
          </Typography>
          <Box sx={{ mt: 0.6, fontWeight: 800 }}>{value}</Box>
        </Box>
        {icon ? <Box sx={{ color: "primary.main" }}>{icon}</Box> : null}
      </Box>
    </Paper>
  );
}
