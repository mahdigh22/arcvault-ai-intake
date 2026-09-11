"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { sampleRequests } from "@/lib/sampleRequests";
import type { AnalysisResult, HistoryItem, Source } from "@/lib/types";
import { ResultPanel } from "@/components/ResultPanel";
import { HistoryTable } from "@/components/HistoryTable";

const HISTORY_KEY = "arcvault-analysis-history";

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

  const canSubmit = useMemo(() => message.trim().length >= 5 && !loading, [message, loading]);

  function selectSample(index: number) {
    const sample = sampleRequests[index];
    setSource(sample.source);
    setMessage(sample.message);
    setResult(null);
    setError(null);
    setTab(0);
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
    <>
      <CssBaseline />
      <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: "1px solid", borderColor: "divider", backdropFilter: "blur(14px)", backgroundColor: "rgba(248,250,255,0.78)" }}>
        <Toolbar>
          <AutoAwesomeRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={900} sx={{ ml: 1 }}>ArcVault AI Intake</Typography>
          <Chip size="small" label="Assessment Demo" variant="outlined" sx={{ ml: 1.5 }} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 850, mb: 4 }}>
          <Typography variant="h3" component="h1" fontWeight={900} sx={{ fontSize: { xs: 34, md: 48 }, letterSpacing: -1.5 }}>
            AI-powered request triage, without the manual sorting.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: 18 }}>
            Submit an unstructured customer request. The workflow classifies it, extracts key entities, routes it, and decides whether human escalation is required.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 4, mb: 3 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, pt: 1 }}>
            <Tab label="Analyze Request" />
            <Tab label={`Processed Requests (${history.length})`} />
          </Tabs>
          <Divider />

          {tab === 0 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <Stack spacing={2.2}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>New customer request</Typography>
                      <Typography variant="body2" color="text.secondary">Use any request or load one of the five assessment samples.</Typography>
                    </Box>

                    <FormControl fullWidth>
                      <InputLabel>Source</InputLabel>
                      <Select value={source} label="Source" onChange={(event) => setSource(event.target.value as Source)}>
                        <MenuItem value="Email">Email</MenuItem>
                        <MenuItem value="Web Form">Web Form</MenuItem>
                        <MenuItem value="Support Portal">Support Portal</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      label="Customer message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      multiline
                      minRows={8}
                      placeholder="Paste the unstructured customer request here..."
                      fullWidth
                    />

                    <Button
                      size="large"
                      variant="contained"
                      disabled={!canSubmit}
                      onClick={analyze}
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendRoundedIcon />}
                      sx={{ py: 1.4, borderRadius: 2.5, fontWeight: 800 }}
                    >
                      {loading ? "Running workflow..." : "Analyze Request"}
                    </Button>

                    {error && <Alert severity="error">{error}</Alert>}

                    <Box>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
                        <ScienceRoundedIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>ASSESSMENT TEST CASES</Typography>
                      </Stack>
                      <Stack spacing={1}>
                        {sampleRequests.map((sample, index) => (
                          <Button
                            key={sample.id}
                            variant="outlined"
                            onClick={() => selectSample(index)}
                            sx={{ justifyContent: "flex-start", textTransform: "none", textAlign: "left", py: 1, borderRadius: 2.5 }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={800}>{sample.id}. {sample.title}</Typography>
                              <Typography variant="caption" color="text.secondary">{sample.source}</Typography>
                            </Box>
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, lg: 7 }}>
                  {result ? (
                    <ResultPanel result={result} />
                  ) : (
                    <Paper variant="outlined" sx={{ minHeight: 560, height: "100%", borderRadius: 4, display: "grid", placeItems: "center", p: 4, borderStyle: "dashed" }}>
                      <Box textAlign="center" sx={{ maxWidth: 460 }}>
                        <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 52 }} />
                        <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>Your structured result will appear here</Typography>
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                          The response includes category, priority, confidence, extracted entities, urgency, destination queue, escalation status, and the receiving-team summary.
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>Processed requests</Typography>
                  <Typography variant="body2" color="text.secondary">Stored locally in this browser for demo purposes. Click a row to reopen its detailed result.</Typography>
                </Box>
                <HistoryTable
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
                    onClick={() => {
                      localStorage.removeItem(HISTORY_KEY);
                      setHistory([]);
                    }}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Clear local history
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </Paper>

        <Alert severity="info" variant="outlined">
          <strong>Architecture:</strong> the browser calls this Next.js app, and the Next.js server route forwards the request to n8n. Your LLM API key and n8n workflow remain outside the browser.
        </Alert>
      </Container>
    </>
  );
}
