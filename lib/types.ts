export const CATEGORIES = [
  "Bug Report",
  "Feature Request",
  "Billing Issue",
  "Technical Question",
  "Incident/Outage",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = "Low" | "Medium" | "High";
export type Urgency = "Low" | "Medium" | "High";
// "Email" is deliberately absent: it is reserved for records the n8n Gmail
// trigger creates from the real mailbox, so the intake channel stays readable
// in the triage table. The form cannot claim it.
export type Source = "Web Form" | "Support Portal";

export interface AnalyzeRequest {
  source: Source;
  message: string;
}

export interface AnalysisResult {
  source?: Source;
  rawMessage?: string;
  classification: {
    category: Category;
    priority: Priority;
    confidence: number;
  };
  enrichment: {
    coreIssue: string;
    identifiers: string[];
    urgency: Urgency;
    // The workflow describes urgency in a sentence rather than a level; keep it for display.
    urgencySignal?: string;
  };
  routing: {
    destination: string;
  };
  escalation: {
    required: boolean;
    reason: string | null;
  };
  summary: string;
  processedAt?: string;
}

export interface HistoryItem extends AnalysisResult {
  id: string;
  source: Source;
  rawMessage: string;
  processedAt: string;
}
