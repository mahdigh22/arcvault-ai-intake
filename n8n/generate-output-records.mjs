// Deliverable 4.2 - runs the five assessment sample messages through the live n8n
// workflow and writes the structured output records to docs/output-records.json.
//
//   node n8n/generate-output-records.mjs
//
// Reads the webhook URL and credentials from .env.local. The workflow must be active.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Parsed manually rather than sourced: the secret value contains a space.
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// The five synthetic inputs from section 2.1 of the assessment, verbatim.
const samples = [
  ["Email", "Hi, I tried logging in this morning and keep getting a 403 error. My account is arcvault.io/user/jsmith. This started after your update last Tuesday."],
  ["Web Form", "We'd love to see a bulk export feature for our audit logs. We're a compliance-heavy org and this would save us hours every month."],
  ["Support Portal", "Invoice #8821 shows a charge of $1,240 but our contract rate is $980/month. Can someone look into this?"],
  ["Email", "I'm not sure if this is the right place to ask, but is there a way to set up SSO with Okta? We're evaluating switching our auth provider."],
  ["Web Form", "Your dashboard stopped loading for us around 2pm EST. Checked our end — it's definitely on yours. Multiple users affected."],
];

const records = [];
let failures = 0;

for (const [index, [source, raw_message]] of samples.entries()) {
  const started = Date.now();
  const res = await fetch(env.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [env.N8N_WEBHOOK_HEADER]: env.N8N_WEBHOOK_SECRET,
    },
    body: JSON.stringify({ source, raw_message }),
  });

  const text = await res.text();
  const ms = Date.now() - started;

  if (!res.ok) {
    failures++;
    console.log(`#${index + 1} ${source.padEnd(15)} HTTP ${res.status} ${text.slice(0, 120)}`);
    continue;
  }

  const record = JSON.parse(text);
  records.push(record);
  const flag = record.escalation_flag ? `ESCALATED (${record.escalation_reason})` : "standard";
  console.log(
    `#${index + 1} ${source.padEnd(15)} ${String(record.category).padEnd(20)} ` +
      `${String(record.priority).padEnd(7)} conf ${record.confidence}  -> ${record.routing_queue}  [${flag}]  ${ms}ms`
  );
}

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "output-records.json");
fs.writeFileSync(outFile, JSON.stringify(records, null, 2) + "\n", "utf8");

console.log(`\nwrote ${records.length}/5 records to ${path.relative(root, outFile)}`);
if (failures) {
  console.log(`${failures} request(s) failed - is the workflow active?`);
  process.exit(1);
}
