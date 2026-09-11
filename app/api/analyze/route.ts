import { NextResponse } from "next/server";
import { mockAnalyze } from "@/lib/mockAnalyze";
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

  return {
    classification: {
      category: pickLabel<Category>(record.category, CATEGORIES, "Technical Question"),
      priority: pickLabel<Priority>(record.priority, PRIORITIES, "Medium"),
      confidence: toConfidence(record.confidence),
    },
    enrichment: {
      coreIssue: String(record.core_issue ?? ""),
      identifiers:
        identifiers && typeof identifiers === "object" && !Array.isArray(identifiers)
          ? (identifiers as AnalysisResult["enrichment"]["identifiers"])
          : {},
      urgency: pickLabel<Urgency>(record.urgency_signal, URGENCIES, "Medium"),
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

    const useMock = process.env.USE_MOCK !== "false";
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (useMock || !webhookUrl) {
      // Small delay makes the demo feel like a real workflow while developing locally.
      await new Promise((resolve) => setTimeout(resolve, 700));
      return NextResponse.json(mockAnalyze(input));
    }

    // The webhook's Header Auth credential; the name must match what is configured in n8n.
    const authHeader = process.env.N8N_WEBHOOK_HEADER || "x-api-key";
    const authSecret = process.env.N8N_WEBHOOK_SECRET;

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authSecret ? { [authHeader]: authSecret } : {}),
      },
      // The workflow reads the message from raw_message.
      body: JSON.stringify({ source: input.source, raw_message: input.message }),
      cache: "no-store",
    });

    const rawText = await n8nResponse.text();
    let payload: unknown;

    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(`n8n returned non-JSON content (${n8nResponse.status}).`);
    }

    if (!n8nResponse.ok) {
      throw new Error(`n8n request failed (${n8nResponse.status}).`);
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
