# Hermes Agent Output/Event Taxonomy for the Pip Runtime

Empirical survey of the event surface of the real Hermes agent core
(`vendor/hermes-agent`, fork majorissuerep/hermes-agent @ c55159f18),
combining a census of every callback registration and emission site in
`run_agent.py` + `agent/` with close reading of the 4 load-bearing
emission paths (chat completion streaming, tool executor, conversation
loop, compression lifecycle). Surveyed 2026-08-01.

## 1. Corpus Profile

| Property | Value |
| --- | --- |
| Core files inspected for callback surface | 133 files in `agent/` + `run_agent.py` |
| Callback channels on `AIAgent.__init__` | 16 (`run_agent.py:462-477`) |
| Emission sites read in full | 4 (chat_completion_helpers, tool_executor, conversation_loop, conversation_compression) |
| Programmatic instantiation reference | `batch_runner.py:325-349` (proven headless path) |
| Event vocabulary below | every type traced to file:line |

## 2. Canonical Event Stream — What One Turn Actually Emits

```text
session start
  status_callback("lifecycle", msg)            agent boot / config notes
per model call (loop iteration)
  step_callback(api_call_count, prev_tools)    iteration counter
  thinking_callback("{face} {verb}...")        whimsical spinner text; "" clears
  reasoning_callback(reasoning_text)           model reasoning blocks (if any)
  stream_delta_callback(str)                   assistant text, token by token
  stream_delta_callback(None)                  stream boundary / reset marker
  interim_assistant_callback(text)             mid-loop assistant text (between tools)
per tool call
  tool_start_callback(tool_call_id, name, display_args)
  tool_progress_callback(...)                  progress / risk metadata
  tool_complete_callback(tool_call_id, name, display_args, display_result)
lifecycle (any time)
  event_callback("session:compress", {...})    context compression
  status_callback("warn" | "compacted", msg)
  notice_callback(notice) / notice_clear_callback()
  reaction_callback(str)                       gateway reactions
interactive
  clarify_callback(question)                   agent asks the user (blocks turn)
turn end
  final assistant message (run_conversation result)
```

Emission-site evidence: stream deltas `agent/chat_completion_helpers.py:3236`,
stream boundary `agent/conversation_loop.py:6100,6132-6133`, tool start
`agent/tool_executor.py:598-600`, tool complete `agent/tool_executor.py:1274-1276,1922-1926`,
reasoning `agent/chat_completion_helpers.py` (reasoning_callback site),
status kinds `run_agent.py` ("warn", "lifecycle") and
`agent/conversation_compression.py` ("compacted", COMPACTION_DONE_STATUS),
compress event `agent/conversation_compression.py:2337`.

## 3. Output-Type Taxonomy

| # | Output type | Channel | Payload shape | Pip relevance |
| --- | --- | --- | --- | --- |
| 1 | Token stream | stream_delta_callback | `str` chunks; `None` = boundary | CORE — drives the streaming bubble |
| 2 | Reasoning | reasoning_callback | text block | optional — deepseek-v4-flash is not a reasoner; render collapsed if present |
| 3 | Spinner/thinking text | thinking_callback | `"{face} {verb}..."`, `""` clears | CORE — "Pip is rummaging…" status line |
| 4 | Tool start | tool_start_callback | `(id, name, display_args)` | CORE — tool card opens |
| 5 | Tool progress | tool_progress_callback | progress/risk metadata | rare for Pip's tiny toolset |
| 6 | Tool complete | tool_complete_callback | `(id, name, display_args, display_result)` | CORE — tool card resolves |
| 7 | Loop step | step_callback | `(api_call_count, prev_tools)` | internal; fold into status line |
| 8 | Interim text | interim_assistant_callback | text | render as normal bubble text |
| 9 | Status | status_callback | `(kind, msg)`, kind ∈ warn/lifecycle/compacted | toast line in chat header |
| 10 | Notice | notice_callback / clear | notice object | dismissible banner |
| 11 | Clarify question | clarify_callback | question | Pip must not block: disabled in pip-agent (no interactive tools) |
| 12 | Lifecycle event | event_callback | `("session:compress", dict)` | log-only server-side |
| 13 | Reaction | reaction_callback | str | N/A (gateway platforms only) |
| 14 | Final message | run_conversation result | text | authoritative final bubble + usage |

## 4. Pip SSE Vocabulary (the structured output we ship)

The slim pip-agent collapses the 14-type surface into 8 typed SSE events.
Preserved invariant: guardrails in the Node layer scan the raw user input
and the assembled final text exactly as before; the Python runtime only
shapes transport and structure.

| SSE event | Maps from Hermes | Payload | Visual (§5) |
| --- | --- | --- | --- |
| `meta` | (pip-agent) | `{session, model}` | header chip "deepseek-v4-flash · ZDR" |
| `status` | thinking_callback, status_callback, step_callback | `{text}` | animated status line under header |
| `delta` | stream_delta_callback(str), interim text | `{text}` | typewriter bubble |
| `reasoning` | reasoning_callback | `{text}` | collapsed "thoughts" disclosure |
| `tool_start` | tool_start_callback | `{id, name, args}` | XP tool card (opening) |
| `tool_end` | tool_complete_callback | `{id, name, result, ok}` | XP tool card (resolved) |
| `done` | final result | `{text, usage}` | bubble finalizes, footer resets |
| `blocked` | Node guardrail | `{stage: input\|output}` | in-character refusal bubble |
| `error` | any exception | `{kind}` | XP error-bar inside chat |

## 5. Visual Treatment per Type (Windows XP desktop idiom)

All visuals live inside the existing `pip-chat-window`; xp.css classes +
the plugin's CSS. One rule: everything animates gently (2.8s character
bob already present); nothing flashes.

1. **delta bubble** — text appears typewriter-style in the white inset
   bubble; a blinking block cursor `▌` trails the last glyph while the
   stream is open; bubble auto-scrolls (existing behavior preserved).
2. **status line** — small italic gray line "Pip is rummaging through
   the repo…" replaced live by thinking_callback text; clears on first
   delta. Three-dot throbber (existing `pip-chat-thinking`) reused.
3. **tool cards** — beveled XP group box with title-bar strip:
   "🔍 knowledge search" opens on tool_start (spinner), turns green
   check + 120-char result excerpt on tool_end, red ✕ on failure.
   Collapses to one summary line 4s after completion.
4. **reasoning disclosure** — sunken panel "Pip's notes (optional)"
   behind a `<details>`; never open by default.
5. **meta chip** — title-bar right side: model id + "ZDR" badge,
   fills in on `meta`.
6. **blocked bubble** — Pip-colored refusal bubble (server sends the
   in-character text); a tiny shield glyph marks guardrail action.
7. **error bar** — red-gradient XP error strip inside the chat frame
   with retry affordance; replaces the silent `pip-chat-error` p.
8. **done** — cursor removed, "Enter to send" hint returns.

## 6. Method Notes

- Census method: `grep` for every `*_callback(` registration in
  `run_agent.py:462-477`, then traced each emission site in `agent/`;
  payloads read at the call sites listed in §2.
- Lower bound: plugins/gateway platforms add platform-specific notice
  types not enumerated (they never fire in the headless pip runtime —
  all gateway imports are absent from the slim service).
- Instantiation contract verified against `batch_runner.py:325-349`:
  AIAgent runs headless with `skip_context_files=True, skip_memory=True`,
  `ephemeral_system_prompt`, and OpenRouter `base_url`/`api_key`.
