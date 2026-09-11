# Prompt Documentation

Deliverable 4.3. The pipeline has **one** LLM step — `Classify & Enrich` — which performs
Steps 2 and 3 of the brief (classification and enrichment) in a single call. Routing and
escalation are deliberately *not* prompted; they run as deterministic code afterwards.

Model: **`gpt-4o-mini`**, temperature `0.2`, `max_tokens` 700, response format
`json_schema` with `strict: true`.

---

## 1. System prompt

```text
You are an intake triage assistant for a B2B software company called ArcVault. Analyze one
inbound customer request and return a structured classification.

Rules:
- category: choose exactly one of "Bug Report", "Feature Request", "Billing Issue",
  "Technical Question", "Incident/Outage". Use "Incident/Outage" when a live service is
  broken or unavailable for the customer (e.g. dashboard down, outage, multiple users
  affected). Use "Bug Report" for a defect affecting a single user or flow. Use "Technical
  Question" for how-to, evaluation or setup questions.
- priority: "Low", "Medium", or "High" based on business impact and urgency.
- confidence: a number between 0 and 1 for how certain you are of the category. Report
  genuine uncertainty; a borderline message should score below 0.7 so it can be sent for
  human review.
- core_issue: the central problem or request in one clear sentence.
- identifiers: an array of concrete identifiers quoted from the message. Include account
  IDs, usernames, email addresses, invoice numbers, error codes, URLs, monetary amounts
  and named products. Copy each one exactly as written, one per array element, with no
  labels or explanation. Return an empty array only when the message genuinely contains
  none.
- urgency_signal: a short phrase describing why this is or isn't urgent, grounded in the
  message.
- summary: a 2-3 sentence, human-readable summary for the receiving team, actionable
  without reading the raw message.
Base every field only on the message content. Do not invent identifiers.
```

**Why it is structured this way.** The prompt is written as a per-field contract rather than
as prose, because every field has a different consumer: `category` drives routing,
`confidence` drives escalation, `summary` is read by a human. Listing the rules field by
field lets each one carry its own definition, which is where the real ambiguity lives — the
line between "Bug Report" and "Incident/Outage" is a *business* distinction (one user versus
a live service down), not something the model can infer from the label alone, so I spelled it
out with examples drawn from the sample set. The instruction on `confidence` is deliberately
unusual: models tend to report high confidence reflexively, and since confidence below 0.7 is
what triggers human review, a model that never expresses doubt silently disables the
escalation path. Telling it that uncertainty is *wanted* is what makes that rule functional.
The closing line ("Base every field only on the message content. Do not invent identifiers")
is the anti-hallucination guard — identifiers are copied downstream into a record a human
will act on, so a fabricated invoice number is worse than an empty array.

**Tradeoffs.** One call does classification, extraction and summarisation together. Splitting
them into three specialised calls would likely improve each in isolation, but triples cost and
latency for a workflow whose whole point is fast triage — and the fields are correlated
anyway (the summary should reflect the chosen category). I also chose enum constraints over
few-shot examples: examples would raise accuracy on borderline cases but add tokens to every
single request, and the schema already makes malformed labels impossible.

**What I would change with more time.** Add 3–5 few-shot examples covering the cases the
model actually gets wrong — the Okta SSO message is genuinely ambiguous between "Technical
Question" and "Feature Request", and an example would settle it more reliably than a rule. I
would also build a small labelled evaluation set (30–50 messages) and measure category
accuracy and confidence calibration before touching the prompt again, rather than tuning by
impression. Right now I have no measurement of whether `confidence` is calibrated at all —
it consistently reports 0.90–0.95 on the five samples, which is plausible given they are
fairly clear-cut, but I cannot prove it isn't simply over-confident.

---

## 2. User message template

```text
Source: {{ $json.source }}
Message: {{ $json.raw_message }}
```

**Why.** The channel is included because it is weak but real evidence — a Support Portal
submission is more likely to be a billing or account issue than a cold email — and it costs
two tokens to provide. Everything else is left as the raw, untouched customer text. I
deliberately do not pre-clean or summarise the message before the model sees it: signatures,
typos and tone are part of the urgency signal the model is being asked to read.

---

## 3. Output schema (part of the prompt contract)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["category", "priority", "confidence", "core_issue",
               "identifiers", "urgency_signal", "summary"],
  "properties": {
    "category": { "type": "string",
      "enum": ["Bug Report", "Feature Request", "Billing Issue",
               "Technical Question", "Incident/Outage"] },
    "priority": { "type": "string", "enum": ["Low", "Medium", "High"] },
    "confidence": { "type": "number" },
    "core_issue": { "type": "string" },
    "identifiers": { "type": "array", "items": { "type": "string" } },
    "urgency_signal": { "type": "string" },
    "summary": { "type": "string" }
  }
}
```

**Why.** This is the most important part of the prompt design, and it is not prose. With
`strict: true`, the enums are enforced by the API rather than requested politely, so
`category` is *structurally* incapable of coming back as "bug report" or "Outage" — which
removes an entire class of downstream string-matching bugs. `required` on all seven fields
means the routing code never has to handle a missing key. `additionalProperties: false`
stops the model from helpfully inventing extra fields that would silently fail to be stored.

**Tradeoff.** `confidence` is typed as a plain number, so the schema permits `1.7` or `-3`.
I chose not to over-constrain it because the downstream code already clamps and normalises
the value, and a tighter schema is another thing to keep in sync. `identifiers` is an array
of plain strings rather than typed objects (`{type: "invoice", value: "#8821"}`) — typed
entities would be more useful to a downstream system, but they would need a controlled
vocabulary of entity types to be worth anything, and inventing one on a 3–5 hour exercise
seemed like the wrong place to spend the time.

---

## 4. What is deliberately *not* prompted

Routing and escalation were kept out of the LLM entirely. The model is asked what the message
*is*; the `Route & Escalate` code node decides what *happens* to it. Two reasons: business
rules like "billing error over $500" must be auditable and must produce the same answer every
time, which a language model cannot guarantee at any temperature; and when a rule changes,
changing a line of JavaScript is safer and cheaper than re-validating a prompt. This also
means a misclassification cannot bypass a hard rule — the $500 amount check runs against the
raw message regardless of which category the model picked.
