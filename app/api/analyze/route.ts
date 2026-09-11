import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/types";
import type { AnalysisResult, AnalyzeRequest, Category, Priority, Urgency } from "@/lib/types";

const PRIORITIES: readonly Priority[] = ["Low", "Medium", "High"];
const URGENCIES: readonly Urgency[] = ["Low", "Medium", "High"];

// The workflow's LLM step returns labels as free text, so match them case-insensitively
// and fall back rather than letting a stray "bug report" reach the UI.
function pickLabel<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.find((option) => option.toLowerCase() === normalized) ?? fallback;
}

function toConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return 0;
  // Accept either 0-1 or a 0-100 percentage.
  return parsed > 1 ? parsed / 100 : parsed;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return ["true", "yes", "1"].includes(String(value).trim().toLowerCase());
}

// The webhook responds with one flat snake_case record; the UI works in nested camelCase.
function fromFlatRecord(record: Record<string, unknown>): AnalysisResult {
  const identifiers = record.identifiers;
  const priority = pickLabel<Priority>(record.priority, PRIORITIES, "Medium");
  const urgencySignal = typeof record.urgency_signal === "string" ? record.urgency_signal.trim() : "";

  return {
    classification: {
      category: pickLabel<Category>(record.category, CATEGORIES, "Technical Question"),
      priority,
      confidence: toConfidence(record.confidence),
    },
    enrichment: {
      coreIssue: String(record.core_issue ?? ""),
      identifiers:
        identifiers && typeof identifiers === "object" && !Array.isArray(identifiers)
          ? (identifiers as AnalysisResult["enrichment"]["identifiers"])
          : {},
      // urgency_signal is usually a sentence ("Multiple users are impacted..."), not a level.
      // Only use it as the level when it really is one; otherwise priority carries the severity.
      urgency: pickLabel<Urgency>(urgencySignal, URGENCIES, priority),
      urgencySignal: URGENCIES.some((level) => level.toLowerCase() === urgencySignal.toLowerCase())
        ? undefined
        : urgencySignal || undefined,
    },
    routing: { destination: String(record.routing_queue ?? "") },
    escalation: {
      required: toBoolean(record.escalation_flag),
      reason: record.escalation_reason ? String(record.escalation_reason) : null,
    },
    summary: String(record.summary ?? ""),
    source: record.source as AnalysisResult["source"],
    rawMessage: typeof record.raw_message === "string" ? record.raw_message : undefined,
    processedAt: typeof record.processed_at === "string" ? record.processed_at : undefined,
  };
}

// The webhook node can be set to either Basic Auth or Header Auth, so support both.
// Basic wins if a user/password pair is present.
function buildAuthHeaders(): Record<string, string> {
  const basicUser = process.env.N8N_WEBHOOK_USER;
  const basicPassword = process.env.N8N_WEBHOOK_PASSWORD;

  if (basicUser && basicPassword) {
    const encoded = Buffer.from(`${basicUser}:${basicPassword}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    // The header name must match the Header Auth credential configured in n8n.
    return { [process.env.N8N_WEBHOOK_HEADER || "x-api-key"]: secret };
  }

  return {};
}

function normalizeResult(payload: unknown): AnalysisResult {
  let value: unknown = payload;

  // n8n may return an array containing a single item, depending on how Respond to Webhook is configured.
  if (Array.isArray(value)) value = value[0];

  // Also accept { data: result } for convenience.
  if (value && typeof value === "object" && "data" in value) {
    const candidate = (value as { data?: unknown }).data;
    if (candidate) value = candidate;
  }

  if (!value || typeof value !== "object") {
    throw new Error("n8n returned an invalid JSON response.");
  }

  const record = value as Record<string, unknown>;
  const result = "classification" in record ? (value as AnalysisResult) : fromFlatRecord(record);
  if (
    !result.classification?.category ||
    !result.classification?.priority ||
    typeof result.classification?.confidence !== "number" ||
    !result.enrichment?.coreIssue ||
    !result.routing?.destination ||
    typeof result.escalation?.required !== "boolean" ||
    !result.summary
  ) {
    throw new Error("n8n response is missing required assessment fields.");
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as AnalyzeRequest;

    if (!input?.message?.trim() || !input?.source) {
      return NextResponse.json({ error: "Source and message are required." }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "N8N_WEBHOOK_URL is not set. Add it to .env.local and restart the server." },
        { status: 500 }
      );
    }

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(),
      },
      // The workflow reads the message from raw_message.
      body: JSON.stringify({ source: input.source, raw_message: input.message }),
      cache: "no-store",
    });

    const rawText = await n8nResponse.text();

    // n8n rejects bad credentials with a plain-text body, so check status before parsing
    // JSON or the real cause gets reported as a parse failure.
    if (n8nResponse.status === 401 || n8nResponse.status === 403) {
      throw new Error(
        `n8n rejected the webhook credentials (${n8nResponse.status}). Check that the auth method and secret in .env.local match the webhook node.`
      );
    }

    if (!n8nResponse.ok) {
      throw new Error(`n8n request failed (${n8nResponse.status}): ${rawText.slice(0, 200)}`);
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(`n8n returned non-JSON content (${n8nResponse.status}).`);
    }

    const result = normalizeResult(payload);

    return NextResponse.json({
      ...result,
      source: result.source ?? input.source,
      rawMessage: result.rawMessage ?? input.message,
      processedAt: result.processedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
