import { sampleRequests } from "./sampleRequests";
import type { AnalysisResult, AnalyzeRequest } from "./types";

const expected: AnalysisResult[] = [
  {
    classification: { category: "Bug Report", priority: "Medium", confidence: 0.95 },
    enrichment: {
      coreIssue: "Customer cannot log in and receives HTTP 403 after a recent product update.",
      identifiers: { account: "arcvault.io/user/jsmith", errorCode: "403" },
      urgency: "Medium",
    },
    routing: { destination: "Engineering" },
    escalation: { required: false, reason: null },
    summary:
      "The customer is unable to authenticate after the latest update and receives HTTP 403. Engineering should investigate a possible authorization regression tied to the release.",
  },
  {
    classification: { category: "Feature Request", priority: "Low", confidence: 0.97 },
    enrichment: {
      coreIssue: "Customer wants a bulk export feature for audit logs to reduce manual compliance work.",
      identifiers: {},
      urgency: "Low",
    },
    routing: { destination: "Product" },
    escalation: { required: false, reason: null },
    summary:
      "The customer is requesting bulk export of audit logs for recurring compliance work. Product should review the request for roadmap fit and expected customer impact.",
  },
  {
    classification: { category: "Billing Issue", priority: "High", confidence: 0.99 },
    enrichment: {
      coreIssue: "Invoice #8821 is $260 higher than the customer's stated monthly contract rate.",
      identifiers: { invoiceNumber: "8821", invoiceAmount: 1240, contractRate: 980, difference: 260 },
      urgency: "High",
    },
    routing: { destination: "Billing" },
    escalation: { required: false, reason: null },
    summary:
      "The customer reports that invoice #8821 is $260 above the contracted monthly rate. Billing should verify the invoice, contract pricing, and any additional charges.",
  },
  {
    classification: { category: "Technical Question", priority: "Medium", confidence: 0.94 },
    enrichment: {
      coreIssue: "Customer is asking whether ArcVault supports SSO integration with Okta.",
      identifiers: { identityProvider: "Okta", capability: "SSO" },
      urgency: "Medium",
    },
    routing: { destination: "IT/Security" },
    escalation: { required: false, reason: null },
    summary:
      "The customer is evaluating Okta and wants guidance on SSO support and setup. IT/Security should provide the supported integration path and configuration requirements.",
  },
  {
    classification: { category: "Incident/Outage", priority: "High", confidence: 0.98 },
    enrichment: {
      coreIssue: "The dashboard stopped loading around 2pm EST and multiple users are affected.",
      identifiers: { reportedTime: "2pm EST", affectedScope: "multiple users" },
      urgency: "High",
    },
    routing: { destination: "Human Review / Incident Response" },
    escalation: {
      required: true,
      reason: "Incident/Outage affecting multiple users requires immediate human review.",
    },
    summary:
      "The customer reports a dashboard availability issue affecting multiple users since around 2pm EST. Escalate for immediate human review and incident-response triage.",
  },
];

export function mockAnalyze(input: AnalyzeRequest): AnalysisResult {
  const index = sampleRequests.findIndex((item) => item.message.trim() === input.message.trim());
  const result = index >= 0 ? expected[index] : expected[0];

  return {
    ...result,
    source: input.source,
    rawMessage: input.message,
    processedAt: new Date().toISOString(),
  };
}
