# pip-agent (slim Hermes runtime)

A minimal Starlette service that runs one Hermes `AIAgent` turn per request
and streams it as typed SSE events. This is the customized-Hermes runtime for
Pip; the vendored fork lives at `vendor/hermes-agent` (git submodule of
`majorissuerep/hermes-agent`).

## Contract

- Prompt-agnostic: the Next.js route owns persona, knowledge selection,
  guardrails, and session memory. This service only shapes transport.
- `POST /v1/chat` body: `{"system": str, "messages": [{role, content}], "model"?}`
- Response: `text/event-stream` with events `meta, status, reasoning, delta,
  tool_start, tool_end, done, error` (see `research/hermes-output-events.md`).
- `GET /health` → `{"status":"ok"}`

## Run locally

```bash
uv venv .venv-pip-agent --python 3.11
VIRTUAL_ENV=.venv-pip-agent uv pip install -e vendor/hermes-agent
cd services/pip-agent
OPENROUTER_API_KEY=... ../../.venv-pip-agent/bin/python -m uvicorn server:app --port 8420
```

Then point the web app at it: `PIP_AGENT_URL=http://127.0.0.1:8420` in
`.env.local`. Without `PIP_AGENT_URL`, the Next route runs the built-in
node-shim (direct OpenRouter streaming) with the same SSE vocabulary, so
production works today; set `PIP_AGENT_URL` when this service is hosted
somewhere persistent (VPS/Modal/Daytona — Vercel cannot host Python inside
this Next.js deployment).

## Headless spike

`scripts/spike-hermes-headless.py` proves the callback surface without the
HTTP layer (uses `.env.local`).
