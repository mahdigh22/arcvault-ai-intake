# ArcVault AI Intake

A small Next.js + TypeScript + MUI frontend for the Valsoft AI Engineer assessment scenario. It is intentionally a thin demo layer: n8n remains responsible for orchestration, LLM calls, validation, routing, escalation and persistence.

## What is included

- One-screen customer request intake form
- The exact five synthetic assessment messages as one-click test cases
- Source selection: Email, Web Form, Support Portal
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
- Mock mode so the UI works before n8n is ready
- `/api/analyze` server route that forwards requests to n8n when enabled

## 1. Run it now in mock mode

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The supplied `.env.example` starts with:

```env
USE_MOCK=true
```

So all five sample requests work immediately without n8n.

## 2. Connect your n8n workflow

When n8n is ready, edit `.env.local`:

```env
USE_MOCK=false
N8N_WEBHOOK_URL=https://YOUR-N8N-HOST/webhook/arcvault-intake
```

Restart `npm run dev` after changing environment variables.

The frontend sends this JSON to n8n:

```json
{
  "source": "Email",
  "message": "Hi, I tried logging in this morning and keep getting a 403 error..."
}
```

## 3. Required n8n response contract

Configure your final **Respond to Webhook** node to return one JSON object with this shape:

```json
{
  "classification": {
    "category": "Bug Report",
    "priority": "Medium",
    "confidence": 0.95
  },
  "enrichment": {
    "coreIssue": "Customer cannot log in and receives HTTP 403 after a recent update.",
    "identifiers": {
      "account": "arcvault.io/user/jsmith",
      "errorCode": "403"
    },
    "urgency": "Medium"
  },
  "routing": {
    "destination": "Engineering"
  },
  "escalation": {
    "required": false,
    "reason": null
  },
  "summary": "The customer is unable to authenticate after the latest update and receives HTTP 403. Engineering should investigate a possible authorization regression tied to the release."
}
```

The app also accepts a one-item n8n array (`[result]`) or `{ "data": result }`, but returning the object directly is cleaner.

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
