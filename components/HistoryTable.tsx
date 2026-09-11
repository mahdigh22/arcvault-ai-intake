import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { HistoryItem } from "@/lib/types";

function percent(value: number) {
  return `${value <= 1 ? Math.round(value * 100) : Math.round(value)}%`;
}

export function HistoryTable({ items, onSelect }: { items: HistoryItem[]; onSelect: (item: HistoryItem) => void }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Request</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Confidence</TableCell>
            <TableCell>Route</TableCell>
            <TableCell>Escalation</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover onClick={() => onSelect(item)} sx={{ cursor: "pointer" }}>
              <TableCell sx={{ maxWidth: 330 }}>
                <Typography variant="body2" noWrap>{item.rawMessage}</Typography>
                <Typography variant="caption" color="text.secondary">{item.source}</Typography>
              </TableCell>
              <TableCell>{item.classification.category}</TableCell>
              <TableCell>{item.classification.priority}</TableCell>
              <TableCell>{percent(item.classification.confidence)}</TableCell>
              <TableCell>{item.routing.destination}</TableCell>
              <TableCell>
                <Chip size="small" label={item.escalation.required ? "Review" : "No"} color={item.escalation.required ? "error" : "success"} variant="outlined" />
              </TableCell>
            </TableRow>
          ))}
          {!items.length && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>
                Analyze a request to create your first processed record.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
