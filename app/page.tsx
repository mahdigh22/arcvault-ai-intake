"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { theme } from "./theme";
import { sampleRequests } from "@/lib/sampleRequests";
import type { AnalysisResult, HistoryItem, Source } from "@/lib/types";
import { ResultPanel } from "@/components/ResultPanel";
import { HistoryList } from "@/components/HistoryList";

const HISTORY_KEY = "arcvault-analysis-history";
const SOURCES: Source[] = ["Email", "Web Form", "Support Portal"];

export default function HomePage() {
  const [source, setSource] = useState<Source>("Email");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {
      // Ignore invalid local demo history.
    }
  }, []);

  const canSubmit = message.trim().length >= 5 && !loading;

  function selectSample(index: number) {
    const sample = sampleRequests[index];
    setSource(sample.source);
    setMessage(sample.message);
    setResult(null);
    setError(null);
  }

  async function analyze() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, message: message.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The analysis request failed.");

      const analyzed = data as AnalysisResult;
      setResult(analyzed);

      const historyItem: HistoryItem = {
        ...analyzed,
        id: crypto.randomUUID(),
        source: analyzed.source ?? source,
        rawMessage: analyzed.rawMessage ?? message.trim(),
        processedAt: analyzed.processedAt ?? new Date().toISOString(),
      };

      setHistory((previous) => {
        const next = [historyItem, ...previous].slice(0, 25);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              color: "primary.main",
              backgroundImage: "linear-gradient(140deg, rgba(79,70,229,0.16), rgba(79,70,229,0.05))",
              border: "1px solid",
              borderColor: "rgba(79,70,229,0.18)",
            }}
          >
            <AutoAwesomeRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1">
              ArcVault AI Intake
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Classify, route and escalate customer requests automatically.
            </Typography>
          </Box>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mt: 4, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab label="Analyze" />
          <Tab label={`History (${history.length})`} />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {tab === 0 ? (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2.5}>
                  <TextField
                    select
                    label="Source"
                    value={source}
                    onChange={(event) => setSource(event.target.value as Source)}
                    sx={{ maxWidth: 220 }}
                  >
                    {SOURCES.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Customer message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    multiline
                    minRows={6}
                    placeholder="Paste the customer request here..."
                    fullWidth
                  />

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Try an example
                    </Typography>
                    <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
                      {sampleRequests.map((sample, index) => (
                        <Chip
                          key={sample.id}
                          label={sample.title}
                          variant="outlined"
                          onClick={() => selectSample(index)}
                          sx={{ "&:hover": { borderColor: "primary.main", color: "primary.main" } }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Button
                      variant="contained"
                      size="large"
                      disabled={!canSubmit}
                      onClick={analyze}
                      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      {loading ? "Analyzing..." : "Analyze request"}
                    </Button>
                    {loading && (
                      <Typography variant="body2" color="text.secondary">
                        Running the triage workflow...
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Paper>

              {error && <Alert severity="error">{error}</Alert>}
              {result && <ResultPanel result={result} />}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <HistoryList
                items={history}
                onSelect={(item) => {
                  setResult(item);
                  setSource(item.source);
                  setMessage(item.rawMessage);
                  setTab(0);
                }}
              />
              {history.length > 0 && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    localStorage.removeItem(HISTORY_KEY);
                    setHistory([]);
                  }}
                  sx={{ alignSelf: "flex-start", color: "text.secondary" }}
                >
                  Clear history
                </Button>
              )}
            </Stack>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}
