import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type { HistoryItem } from "@/lib/types";

// A list rather than a table: no horizontal scrolling on narrow screens.
export function HistoryList({ items, onSelect }: { items: HistoryItem[]; onSelect: (item: HistoryItem) => void }) {
  if (!items.length) {
    return (
      <Paper variant="outlined" sx={{ p: 5, textAlign: "center" }}>
        <Typography color="text.secondary">No requests analyzed yet.</Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {items.map((item, index) => (
        <Stack
          key={item.id}
          direction="row"
          alignItems="center"
          spacing={1.5}
          onClick={() => onSelect(item)}
          sx={{
            p: 2,
            cursor: "pointer",
            borderTop: index === 0 ? "none" : "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" noWrap>
              {item.rawMessage}
            </Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
              <Typography variant="caption" color="text.secondary">
                {item.classification.category} · {item.routing.destination}
              </Typography>
              <Chip
                size="small"
                label={item.escalation.required ? `${item.classification.priority} · escalated` : item.classification.priority}
                color={item.escalation.required ? "error" : "default"}
                variant="outlined"
              />
            </Stack>
          </Box>
          <ChevronRightRoundedIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
        </Stack>
      ))}
    </Paper>
  );
}
