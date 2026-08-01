"""Headless spike: prove AIAgent streams through the full callback surface."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'vendor' / 'hermes-agent'))

from run_agent import AIAgent  # noqa: E402

key = None
for line in Path('.env.local').read_text().splitlines():
    if line.strip().startswith('OPENROUTER_API_KEY='):
        key = line.split('=', 1)[1].strip().strip('"\'')
assert key, 'OPENROUTER_API_KEY missing'

events = []

agent = AIAgent(
    base_url='https://openrouter.ai/api/v1',
    api_key=key,
    model='deepseek/deepseek-v4-flash',
    max_iterations=3,
    enabled_toolsets=[],
    save_trajectories=False,
    ephemeral_system_prompt=(
        'You are Pip, a cheerful paperclip assistant on a retro desktop games site. '
        'Answer in under 60 words, plain text, cheerful 2001-era tone.'
    ),
    skip_context_files=True,
    skip_memory=True,
    quiet_mode=True,
    stream_delta_callback=lambda d: events.append(('delta', d)),
    reasoning_callback=lambda t: events.append(('reasoning', t[:80] if t else t)),
    thinking_callback=lambda t: events.append(('thinking', t)),
    tool_start_callback=lambda i, n, a: events.append(('tool_start', (n, a))),
    tool_complete_callback=lambda i, n, a, r: events.append(('tool_complete', (n, str(r)[:60]))),
    step_callback=lambda c, t: events.append(('step', c)),
    status_callback=lambda k, m: events.append(('status', (k, m[:80]))),
    interim_assistant_callback=lambda t: events.append(('interim', t[:80])),
)

result = agent.run_conversation('How do I flag a mine in Minefield?')

kinds = {}
for kind, _ in events:
    kinds[kind] = kinds.get(kind, 0) + 1
print('event counts:', kinds)
deltas = [p for k, p in events if k == 'delta' and p]
print('delta chunks:', len(deltas), '| first 3:', deltas[:3])
print('result keys:', list(result.keys()) if isinstance(result, dict) else type(result))
final = result.get('final_response') or result.get('response') if isinstance(result, dict) else result
print('final (first 200):', str(final)[:200])
