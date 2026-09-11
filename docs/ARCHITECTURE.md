# Architecture Write-Up

Deliverable 4.4 — ArcVault AI intake and triage pipeline.

## 1. System design

```
Browser (Next.js UI)
      │  POST { source, message }
      ▼
Next.js server route  /api/analyze          ← holds the webhook secret
      │  POST { source, raw_message }  + Authorization header
      ▼
n8n  ── API Webhook ──► Prepare Input ──► Valid Input? ──►(no)──► 400
                                              │ yes
                                              ▼
                                      Classify & Enrich  ──(error)──► 502
                                        gpt-4o-mini
                                              ▼
                                      Route & Escalate   ──(error)──► 502
                                        deterministic JS
                                              ▼
                                      Needs Human Review?
                                       ╱                ╲
                            escalation queue        standard queue
                             (n8n Data Table)      (n8n Data Table)
                                       ╲                ╱
                                        ▼              ▼
                                         Respond to App (200)
```

**Orchestration** is n8n Cloud (free tier). **Ingestion** is an HTTP webhook rather than an
email or folder trigger: it is synchronous, so the same pipeline serves both automated
intake and an interactive UI, and it is trivial to drive from a script for testing.

**The front end is deliberately thin.** It is a Next.js + MUI single page whose only job is
to submit a message and render the record. The browser never talks to n8n directly — it
calls `/api/analyze`, a server-side route that adds the Header Auth credential and forwards
the request. This keeps the webhook secret out of client code and avoids CORS entirely. That
route is also the single place where the flat `snake_case` record from n8n is mapped to the
shape the UI renders, so the workflow's output contract can change without touching
components.

**Where state is held.** The pipeline is stateless per request: every execution is a pure
function of one inbound message. The only durable state is the n8n Data Table, which holds
the structured record — one row per processed request, written before the response is
returned. The browser keeps a short history in `localStorage` purely as a demo convenience;
nothing depends on it, and clearing it loses nothing authoritative.

**Model choice.** `gpt-4o-mini` at temperature 0.2. Triage is a constrained classification
task with an enum-bounded output, not open-ended reasoning — a frontier model would cost
roughly an order of magnitude more per request for accuracy that the strict JSON schema
already bounds. Low temperature because the same message should produce the same routing
decision twice.

## 2. Routing logic

Five categories map onto four standing queues:

| Category | Queue | Reasoning |
|---|---|---|
| Bug Report | Engineering | Defect in existing behaviour |
| Incident/Outage | Engineering | Same owning team, higher urgency |
| Feature Request | Product | Roadmap decision, not a defect |
| Billing Issue | Billing | Commercial, not technical |
| Technical Question | IT/Security | How-to, SSO, integration and setup questions |
| *(unrecognised)* | General Triage | Fallback — nothing is ever dropped |

Bug Report and Incident/Outage intentionally share a destination. The distinction between
them is about *urgency*, not *ownership* — both land with Engineering — so it is expressed
through the escalation flag rather than by inventing a queue that the same team would have
to watch separately.

The `General Triage` fallback exists because the routing table keys on a string. The enum
schema makes an unknown category nearly impossible today, but a queue map that can return
`undefined` is a silent-failure waiting for the day someone adds a sixth category to the
prompt and forgets the map.

## 3. Escalation logic

A record is flagged for human review if **any** of four conditions holds. All four are
evaluated in code against the raw message, independently of the model's own priority
judgement, and every reason that fires is recorded in `escalation_reason` (they accumulate;
a record can escalate for two reasons at once).

| Criterion | Rationale |
|---|---|
| `confidence < 0.7` | The brief's threshold. This is the fallback for low-confidence classification — if the model does not know what something is, a human should decide. |
| Outage signal | Category is `Incident/Outage`, **or** the text matches `outage`, `down for all users`, `multiple users (are) affected`, `production down`. A live outage is time-critical regardless of how the model labelled it. |
| Critical wording | `urgent`, `asap`, `critical`, `emergency`, `data loss`, `security breach`, `locked out`. Customers signal severity in words that classification alone discards. |
| Billing amount > $500 | A money figure above the threshold in a billing context. Financial disputes have an asymmetric cost of being wrong. |

Escalated records go to the escalation queue **instead of** the standard destination, and
`routing_queue` is overwritten to `Human Escalation` so the record is self-describing
wherever it ends up.

Two design decisions inside these rules are worth calling out. First, the **keyword checks
are redundant with the category check on purpose** — the regex fires even when the model
labelled an outage as a Bug Report. Redundancy is the point: the rule must not depend on the
component most likely to be wrong. Second, the **$500 scan runs on every message**, not only
those the model called a Billing Issue, for exactly the same reason — a hard financial rule
that a misclassification can switch off is not a rule. A billing-context check
(`invoice|charge|billed|refund|payment|contract rate`) prevents it firing on an unrelated
figure such as a pricing tier mentioned in a sales question.

## 4. Failure handling

Every path terminates in an HTTP response — `400` for input under 5 characters (rejected
before any LLM spend), `502` if the model call or the routing code throws, `200` otherwise.
This matters because the webhook runs in `responseNode` mode: if execution halts anywhere
before a Respond node, the caller receives nothing at all and waits until its own timeout.

Two specific choices follow from that. The routing node **throws** on unparseable model
output rather than falling back to defaults — a silent fallback would have written a record
with `confidence: 0` and an empty summary that looks like a genuine low-confidence triage
and would then escalate for the wrong reason. And the Data Table nodes are set to continue
on error, because losing the audit row is bad but failing the caller's request over it is
worse.

## 5. At production scale

**Reliability.** Synchronous webhooks are the wrong shape above modest volume. I would split
ingestion from processing: the webhook accepts, enqueues and returns `202` immediately; a
worker consumes the queue and writes the record. That removes the LLM call from the request
path, makes retries safe, and survives a provider outage by backing up rather than failing.
I would add an idempotency key so a retried delivery cannot double-write a row.

**Cost.** Every request is currently one LLM call. At volume I would cache on a hash of the
normalised message (duplicate reports of the same incident arrive in bursts), route obviously
unambiguous messages through a cheap keyword pre-filter before spending a token, and batch
non-urgent channels. I would also track cost per triaged request as a first-class metric —
it is the number that decides whether this scales economically.

**Latency.** End-to-end time is dominated by the model call; everything else is
milliseconds. The user-visible fix is streaming the classification to the UI before the
summary finishes. The structural fix is the async split above, which makes latency a
background concern rather than a user-facing one.

**Observability.** Today a failure is visible only in the n8n execution log. I would emit
structured events per execution — category, confidence, queue, escalation reason, duration,
token cost — and alert on the distribution shifting, since a prompt or model change shows up
as a change in the escalation rate long before anyone reports a bad routing decision.

## 6. Phase 2

1. **A labelled evaluation set** — 50–100 messages with human-assigned categories, run as a
   regression suite on every prompt change. Right now accuracy is an impression, not a
   number, and that is the single biggest gap in this build.
2. **Confidence calibration.** Measure whether the model's stated confidence predicts actual
   correctness. The 0.7 escalation threshold is inherited from the brief, not derived from
   data; the right threshold is wherever the cost of a missed escalation crosses the cost of
   a needless one.
3. **Feedback loop.** Let the receiving team correct a wrong queue in one click and store the
   correction. That is the raw material for both few-shot examples and eventual fine-tuning.
4. **Real downstream actions** — create the Jira issue, open the Zendesk ticket, post to the
   incident channel — so triage ends in work being queued rather than a row in a table.
5. **Typed entity extraction**, replacing the flat identifier strings with
   `{type, value}` pairs so downstream systems can look up an invoice or account directly.

## 7. Assumptions and known limitations

- The five sample messages are the only test data. The category boundaries were tuned
  against them and may not generalise — the Okta SSO message in particular sits genuinely
  close to the line between "Technical Question" and "Feature Request".
- `identifiers` is a comma-joined string in the Data Table because the column is typed as
  text. The API response keeps the array; the flattening happens only at the storage
  boundary.
- Escalation keywords are English-only and literal. A customer writing "this is a
  catastrophe" is not caught.
- The confidence threshold, the $500 figure and the keyword list are all inherited from the
  brief rather than derived from data. They are the first things I would want to justify
  with evidence.
