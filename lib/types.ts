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
export type Source = "Email" | "Web Form" | "Support Portal";

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
    identifiers: Record<string, string | number | boolean | null>;
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
