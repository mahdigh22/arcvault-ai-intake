# ArcVault AI Intake

A small Next.js + TypeScript + MUI frontend for the Valsoft AI Engineer assessment scenario. It is intentionally a thin demo layer: n8n remains responsible for orchestration, LLM calls, validation, routing, escalation and persistence.

## What is included

- One-screen customer request intake form
- The exact five synthetic assessment messages as one-click test cases
- Source selection: Web Form, Support Portal (`Email` is reserved for the n8n
  Gmail trigger, so the `source` column tells real inbox mail apart from a form
  submission at a glance)
- Analysis result view showing:
  - Category
  - Priority
  - Confidence score
  - Core issue
  - Extracted identifiers/entities
  - Urgency
  - Routing destination
  - Human escalation flag/reason
  - 2–3 sentence receiving-team summary
- Local processed-request history for demo convenience
- `/api/analyze` server route that forwards every request to n8n

## 1. Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` with your webhook URL and credentials (see below), then open
`http://localhost:3000`. Every analysis calls the live n8n workflow — there is no
offline mode, so the workflow must be published and active.

Restart `npm run dev` after changing environment variables.

## 2. Connect your n8n workflow

```env
N8N_WEBHOOK_URL=https://YOUR-N8N-HOST/webhook/arcvault-triage

# Header Auth (must match the n8n credential byte-for-byte):
N8N_WEBHOOK_HEADER=Authorization
N8N_WEBHOOK_SECRET=Bearer <long-random-token>

# ...or Basic Auth, which takes precedence when both are set:
N8N_WEBHOOK_USER=
N8N_WEBHOOK_PASSWORD=
```

If the header name and value do not match the n8n credential exactly, the webhook
returns 403.

The browser posts `{ source, message }` to `/api/analyze`, and that route forwards
this JSON to n8n:

```json
{
  "source": "Web Form",
  "raw_message": "Hi, I tried logging in this morning and keep getting a 403 error..."
}
```

The workflow has a second trigger: a **Gmail Trigger** feeding a `Normalize Email`
node into the same `Prepare Input` step. Mail arriving in the linked inbox is
classified by the identical pipeline and stored with `source: "Email"`. Those runs
have no HTTP caller, so a `Came from API?` check skips the response node.

## 3. Required n8n response contract

Configure your final **Respond to Webhook** node to return one flat JSON object:

```json
{
  "source": "Web Form",
  "raw_message": "...",
  "category": "Bug Report",
  "priority": "Medium",
  "confidence": 0.95,
  "core_issue": "Customer cannot log in and receives HTTP 403 after a recent update.",
  "identifiers": { "account": "arcvault.io/user/jsmith", "errorCode": "403" },
  "urgency_signal": "Login has been blocked since the last release.",
  "routing_queue": "Engineering",
  "escalation_flag": false,
  "escalation_reason": null,
  "summary": "The customer is unable to authenticate after the latest update and receives HTTP 403. Engineering should investigate a possible authorization regression tied to the release.",
  "processed_at": "2026-09-11T18:39:28.000Z"
}
```

`/api/analyze` maps that to the nested camelCase shape in [`lib/types.ts`](lib/types.ts)
before returning it to the browser. Notes on the tolerant bits:

- `identifiers` may be an object, or `""` when nothing was extracted.
- `urgency_signal` may be a free-text sentence or one of `Low`/`Medium`/`High`.
  When it is a sentence, the urgency **level** falls back to `priority` and the
  sentence is displayed underneath it.
- The nested camelCase shape is still accepted, as is a one-item array (`[result]`)
  or `{ "data": result }`.

### Allowed assessment values

Category:

- `Bug Report`
- `Feature Request`
- `Billing Issue`
- `Technical Question`
- `Incident/Outage`

Priority:

- `Low`
- `Medium`
- `High`

Confidence can be `0.95` or `95`; the UI displays either as a percentage.

## 4. Recommended n8n flow

```text
Webhook
  ↓
Normalize Input
  ↓
LLM Classification + Enrichment + Summary
  ↓
Validate / Parse Structured JSON
  ↓
Escalation Rules
  ↓
Routing Rules
  ↓
Persistent Output (JSON / Google Sheet / other)
  ↓
Respond to Webhook
```

Keep routing and escalation deterministic where possible. Example mapping:

```text
Bug Report          -> Engineering
Feature Request     -> Product
Billing Issue       -> Billing
Technical Question  -> IT/Security
Incident/Outage     -> Engineering / Incident Response
```

Example escalation conditions:

- confidence < 0.70
- incident/outage condition
- explicit defined critical wording
- billing error > $500

If escalated, your workflow should route it to a separate human-review/escalation queue rather than only the standard destination.

## 5. Why the frontend uses `/api/analyze`

The client does not call n8n directly. Instead:

```text
Browser -> Next.js /api/analyze -> n8n -> LLM/workflow -> Next.js -> Browser
```

This avoids browser CORS problems and keeps the integration endpoint on the server side. The LLM API key should stay in n8n, never in this frontend.

## 6. Useful demo sequence

1. Open the app.
2. Click **Login 403 after update**.
3. Click **Analyze Request**.
4. Explain the returned classification, extraction and route.
5. Click **Dashboard unavailable**.
6. Analyze it and show the red human-escalation result.
7. Open **Processed Requests** to show structured records accumulating.
8. Show n8n separately to explain what happens behind the UI.

The app is deliberately small so the technical interview stays focused on the AI workflow rather than frontend complexity.
