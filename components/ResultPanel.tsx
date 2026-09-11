import {
  Alert,
  Box,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import type { AnalysisResult } from "@/lib/types";
import { MetricCard } from "./MetricCard";

function confidencePercent(value: number) {
  return Math.max(0, Math.min(100, value <= 1 ? Math.round(value * 100) : Math.round(value)));
}

export function ResultPanel({ result }: { result: AnalysisResult }) {
  const confidence = confidencePercent(result.classification.confidence);
  const identifiers = Object.entries(result.enrichment.identifiers ?? {});

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 4 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Analysis Result</Typography>
          <Typography variant="body2" color="text.secondary">
            Structured output returned by the AI triage workflow.
          </Typography>
        </Box>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Category" value={<Typography fontWeight={800}>{result.classification.category}</Typography>} icon={<CategoryRoundedIcon />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Priority"
              value={<Chip size="small" label={result.classification.priority} color={result.classification.priority === "High" ? "error" : result.classification.priority === "Medium" ? "warning" : "default"} />}
              icon={<BoltRoundedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Confidence"
              value={
                <Box sx={{ minWidth: 130 }}>
                  <Typography fontWeight={800}>{confidence}%</Typography>
                  <LinearProgress variant="determinate" value={confidence} sx={{ mt: 0.8, height: 7, borderRadius: 10 }} />
                </Box>
              }
              icon={<FlagRoundedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Destination" value={<Typography fontWeight={800}>{result.routing.destination}</Typography>} icon={<AccountTreeRoundedIcon />} />
          </Grid>
        </Grid>

        {result.escalation.required ? (
          <Alert severity="error" variant="outlined">
            <strong>Human escalation required.</strong> {result.escalation.reason || "The workflow marked this request for manual review."}
          </Alert>
        ) : (
          <Alert severity="success" variant="outlined">No human escalation is required for this request.</Alert>
        )}

        <Divider />

        <Box>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>CORE ISSUE</Typography>
          <Typography sx={{ mt: 0.7 }}>{result.enrichment.coreIssue}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>EXTRACTED ENTITIES</Typography>
          {identifiers.length ? (
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
              {identifiers.map(([key, value]) => (
                <Chip key={key} variant="outlined" label={`${key}: ${String(value)}`} />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 0.7 }}>No identifiers were found in the message.</Typography>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>URGENCY</Typography>
          <Chip sx={{ mt: 1 }} label={result.enrichment.urgency} color={result.enrichment.urgency === "High" ? "error" : result.enrichment.urgency === "Medium" ? "warning" : "default"} />
        </Box>

        <Box sx={{ p: 2, backgroundColor: "action.hover", borderRadius: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>RECEIVING-TEAM SUMMARY</Typography>
          <Typography sx={{ mt: 0.7 }}>{result.summary}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
