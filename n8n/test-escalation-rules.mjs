// Runs the "Route & Escalate" Code node from the workflow JSON against sample
// messages, with the n8n globals stubbed. Usage: node n8n/test-escalation-rules.mjs
import fs from "node:fs";

const target = process.argv[2] ?? new URL("./arcvault-triage.workflow.json", import.meta.url);
const wf = JSON.parse(fs.readFileSync(target, "utf8"));
const codeNode = wf.nodes.find((n) => n.name === "Route & Escalate");
const jsCode = codeNode.parameters.jsCode;

// Run the node body with stubbed n8n globals.
function run({ message, source, llm }) {
  const $ = (name) => {
    if (name !== "Prepare Input") throw new Error("unexpected node ref " + name);
    return { item: { json: { source, raw_message: message } } };
  };
  const $json = { output: [{ content: [{ text: JSON.stringify(llm) }] }] };
  const fn = new Function("$", "$json", jsCode);
  return fn($, $json)[0].json;
}

const base = {
  category: "Technical Question",
  priority: "Medium",
  confidence: 0.95,
  core_issue: "x",
  identifiers: [],
  urgency_signal: "x",
  summary: "x",
};

const cases = [
  {
    label: "outage phrased 'are affected' (old keyword list missed this)",
    message: "Your dashboard stopped loading. Multiple users are affected.",
    llm: { ...base, category: "Bug Report" },
    expect: (r) => r.escalation_flag && /Outage/.test(r.escalation_reason),
  },
  {
    label: "billing >$500 MISCLASSIFIED as Bug Report (old code skipped the rule)",
    message: "Invoice #8821 shows a charge of $1,240 but our contract rate is $980/month.",
    llm: { ...base, category: "Bug Report" },
    expect: (r) => r.escalation_flag && /Billing amount over \$500 \(\$1240\)/.test(r.escalation_reason),
  },
  {
    label: "critical wording, otherwise ordinary question",
    message: "This is urgent - we are locked out of the admin console.",
    llm: { ...base, category: "Technical Question" },
    expect: (r) => r.escalation_flag && /Critical wording/.test(r.escalation_reason),
  },
  {
    label: "calm how-to question does NOT escalate",
    message: "Could you explain how to export a report to CSV? No rush at all.",
    llm: { ...base, category: "Technical Question" },
    expect: (r) => !r.escalation_flag && r.routing_queue === "IT/Security",
  },
  {
    label: "stray $600 with no billing context does NOT trigger the billing rule",
    message: "We are evaluating the $600 tier for SSO. Is Okta supported?",
    llm: { ...base, category: "Technical Question" },
    expect: (r) => !/Billing amount/.test(r.escalation_reason),
  },
  {
    label: "low confidence escalates",
    message: "something is weird with the thing",
    llm: { ...base, confidence: 0.42 },
    expect: (r) => r.escalation_flag && /Low confidence/.test(r.escalation_reason),
  },
  {
    label: "identifiers stay an ARRAY in the response",
    message: "Invoice #8821 for jsmith@acme.io, error ERR-4021.",
    llm: { ...base, category: "Billing Issue", identifiers: ["Invoice #8821", "jsmith@acme.io", "ERR-4021"] },
    expect: (r) => Array.isArray(r.identifiers) && r.identifiers.length === 3,
  },
  {
    label: "feature request routes to Product, no escalation",
    message: "We'd love bulk export for audit logs.",
    llm: { ...base, category: "Feature Request", priority: "Low" },
    expect: (r) => r.routing_queue === "Product" && !r.escalation_flag,
  },
];

let failed = 0;
for (const c of cases) {
  let ok = false;
  let detail = "";
  try {
    const r = run({ message: c.message, source: "Web Form", llm: c.llm });
    ok = c.expect(r);
    detail = `queue=${r.routing_queue} flag=${r.escalation_flag} reason="${r.escalation_reason}"`;
  } catch (err) {
    detail = "threw: " + err.message;
  }
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.label}\n      ${detail}`);
}

// Parse failure must throw, so the error branch can answer with 502.
try {
  const fn = new Function("$", "$json", jsCode);
  fn(() => ({ item: { json: {} } }), { output: [{ content: [{ text: "not json at all" }] }] });
  console.log("FAIL  malformed LLM output should throw");
  failed++;
} catch {
  console.log("PASS  malformed LLM output throws instead of storing a junk record");
}

console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
