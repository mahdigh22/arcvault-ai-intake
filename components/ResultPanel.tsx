import { Box, Chip, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { ReactNode } from "react";
import type { AnalysisResult } from "@/lib/types";

function confidencePercent(value: number) {
  return Math.max(0, Math.min(100, value <= 1 ? Math.round(value * 100) : Math.round(value)));
}

// Label left, value right; stacks on narrow screens.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 0.4, sm: 3 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 104 }, flexShrink: 0, pt: 0.2 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function ResultPanel({ result }: { result: AnalysisResult }) {
  const { classification, enrichment, routing, escalation } = result;
  const identifiers = Object.entries(enrichment.identifiers ?? {});
  const confidence = confidencePercent(classification.confidence);
  const priorityColor =
    classification.priority === "High" ? "error" : classification.priority === "Medium" ? "warning" : "default";

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {/* Headline: what it is, how urgent, and where it goes. */}
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "rgba(79,70,229,0.03)" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Category
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.4 }}>
              <Typography variant="h6">{classification.category}</Typography>
              <Chip size="small" label={classification.priority} color={priorityColor} />
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.8} alignItems="center" color="text.secondary">
            <ArrowForwardRoundedIcon fontSize="small" />
            <Typography fontWeight={600} color="text.primary">
              {routing.destination}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ mt: 2.5, maxWidth: 260 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              Confidence
            </Typography>
            <Typography variant="caption" fontWeight={700}>
              {confidence}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={confidence}
            sx={{ mt: 0.6, height: 5, borderRadius: 5, bgcolor: "rgba(79,70,229,0.12)" }}
          />
        </Box>
      </Box>

      {escalation.required && (
        <Stack
          direction="row"
          spacing={1.2}
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.6,
            bgcolor: "rgba(211,47,47,0.06)",
            color: "error.dark",
            borderTop: "1px solid",
            borderColor: "rgba(211,47,47,0.18)",
          }}
        >
          <WarningAmberRoundedIcon fontSize="small" sx={{ mt: 0.2 }} />
          <Box>
            <Typography variant="body2" fontWeight={700}>
              Human escalation required
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {escalation.reason || "Flagged for manual review."}
            </Typography>
          </Box>
        </Stack>
      )}

      <Divider />

      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
        <Row label="Core issue">
          <Typography>{enrichment.coreIssue}</Typography>
        </Row>

        {/* The workflow sends urgency as a sentence; fall back to the level when it doesn't. */}
        <Row label="Urgency">
          <Typography>{enrichment.urgencySignal || enrichment.urgency}</Typography>
        </Row>

        <Row label="Entities">
          {identifiers.length ? (
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.8}>
              {identifiers.map(([key, value]) => (
                <Chip key={key} size="small" variant="outlined" label={`${key}: ${String(value)}`} />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">None found</Typography>
          )}
        </Row>

        {!escalation.required && (
          <Row label="Escalation">
            <Typography color="text.secondary">Not required</Typography>
          </Row>
        )}

        <Row label="Summary">
          <Typography>{result.summary}</Typography>
        </Row>
      </Stack>
    </Paper>
  );
}
