"""pip-agent: slim Hermes runtime that streams one chat turn as typed SSE events.

Design contract (see research/hermes-output-events.md):
- Prompt-agnostic: the caller (Next.js route) supplies the system prompt and
  conversation history. Persona, knowledge selection, guardrails, and session
  memory all stay in the Node layer — this service is pure Hermes transport.
- Input:  POST /v1/chat  {"system": str, "messages": [{role, content}], "model"?}
- Output: text/event-stream with events: meta, status, reasoning, delta,
          tool_start, tool_end, done, error.
- Runs headless: skip_context_files + skip_memory, zero toolsets by default.

Run:  uvicorn server:app --host 0.0.0.0 --port 8420   (from services/pip-agent)
Env:  OPENROUTER_API_KEY (required), PIP_AGENT_MODEL (default deepseek/deepseek-v4-flash)
"""

import asyncio
import json
import os
import queue
import sys
import threading
from pathlib import Path

# Vendored Hermes fork (git submodule at vendor/hermes-agent).
_HERMES_ROOT = Path(__file__).resolve().parents[2] / 'vendor' / 'hermes-agent'
if str(_HERMES_ROOT) not in sys.path:
    sys.path.insert(0, str(_HERMES_ROOT))

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route

from run_agent import AIAgent

DEFAULT_MODEL = os.environ.get('PIP_AGENT_MODEL', 'deepseek/deepseek-v4-flash')
OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
MAX_MESSAGES = 24
MAX_MESSAGE_CHARS = 4_000
MAX_SYSTEM_CHARS = 16_000


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _validate(payload: dict) -> tuple[str, list, str]:
    system = str(payload.get('system') or '')[:MAX_SYSTEM_CHARS]
    if not system:
        raise ValueError('system prompt is required')
    model = str(payload.get('model') or DEFAULT_MODEL)
    messages = payload.get('messages')
    if not isinstance(messages, list) or not messages:
        raise ValueError('messages must be a non-empty list')
    cleaned = []
    for message in messages[-MAX_MESSAGES:]:
        role = message.get('role')
        content = str(message.get('content') or '').strip()[:MAX_MESSAGE_CHARS]
        if role not in ('user', 'assistant') or not content:
            raise ValueError('messages must be {role: user|assistant, content}')
        cleaned.append({'role': role, 'content': content})
    if cleaned[-1]['role'] != 'user':
        raise ValueError('last message must be from the user')
    return system, cleaned, model


def _run_agent(system: str, messages: list, model: str, events: queue.Queue) -> None:
    """Worker thread: drive one AIAgent turn, translating callbacks to events."""
    try:
        agent = AIAgent(
            base_url=OPENROUTER_BASE_URL,
            api_key=os.environ['OPENROUTER_API_KEY'],
            model=model,
            max_iterations=4,
            enabled_toolsets=[],
            save_trajectories=False,
            ephemeral_system_prompt=system,
            skip_context_files=True,
            skip_memory=True,
            quiet_mode=True,
            stream_delta_callback=lambda d: events.put(('delta', {'text': d} if d else {'reset': True})),
            reasoning_callback=lambda t: events.put(('reasoning', {'text': (t or '')[:2_000]})),
            thinking_callback=lambda t: events.put(('status', {'text': t})),
            tool_start_callback=lambda i, n, a: events.put(('tool_start', {'id': str(i), 'name': n, 'args': str(a)[:500]})),
            tool_complete_callback=lambda i, n, a, r: events.put(('tool_end', {'id': str(i), 'name': n, 'result': str(r)[:500]})),
            step_callback=lambda c, t: events.put(('status', {'text': '', 'step': c})),
            status_callback=lambda k, m: events.put(('status', {'text': m, 'kind': k})),
            interim_assistant_callback=lambda t: events.put(('delta', {'text': t})),
        )
        result = agent.run_conversation(
            messages[-1]['content'],
            system_message=None,  # ephemeral_system_prompt already carries it
            conversation_history=messages[:-1],
        )
        events.put(('done', {
            'text': result.get('final_response') or '',
            'model': result.get('model', model),
            'usage': {
                'input_tokens': result.get('input_tokens'),
                'output_tokens': result.get('output_tokens'),
                'cost_usd': result.get('estimated_cost_usd'),
            },
        }))
    except Exception as exc:  # noqa: BLE001 — SSE surface must fail gracefully
        events.put(('error', {'kind': type(exc).__name__}))
    finally:
        events.put(None)


async def chat(request: Request) -> Response:
    try:
        system, messages, model = _validate(await request.json())
    except ValueError as exc:
        return JSONResponse({'error': str(exc)}, status_code=400)
    if not os.environ.get('OPENROUTER_API_KEY'):
        return JSONResponse({'error': 'pip-agent is not configured'}, status_code=503)

    events: queue.Queue = queue.Queue()
    threading.Thread(target=_run_agent, args=(system, messages, model, events), daemon=True).start()

    async def stream():
        yield _sse('meta', {'model': model, 'runtime': 'hermes', 'version': 1})
        loop = asyncio.get_running_loop()
        while True:
            item = await loop.run_in_executor(None, events.get)
            if item is None:
                break
            event, data = item
            yield _sse(event, data)

    return StreamingResponse(stream(), media_type='text/event-stream', headers={
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
    })


async def health(request: Request) -> JSONResponse:
    return JSONResponse({'status': 'ok', 'runtime': 'hermes-pip-agent'})


app = Starlette(routes=[
    Route('/v1/chat', chat, methods=['POST']),
    Route('/health', health),
])
