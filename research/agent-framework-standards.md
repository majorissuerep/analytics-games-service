# Agent-Persona Frameworks and Agent Standards: A Structural Survey for the "Pip says" Standard

**Method note.** This report is based on a census of **24 primary sources** fetched live via `curl` on **2026-08-01** (GitHub repository metadata APIs, raw READMEs/spec files, and official documentation pages/markdown mirrors), of which **14 documents were read closely** (full READMEs, spec sections, config references, and architecture docs). Publication/activity dates of the inspected sources span **May 2023** (Character Card V2 spec) through **2026-08-01** (same-day commits to `elizaOS/eliza`, `aaif-goose/goose`, and `vercel/eve`). No claim in this report rests on memory alone; every factual statement about a framework carries a URL. One scoped framework — "Eve" at `github.com/zenbaseai/eve` — **could not be verified as real** (HTTP 404); the real, current "eve" is **Vercel's `vercel/eve`** (see §1 and §7).

## 1. Corpus Profile

The census splits into four genres: persona/agent frameworks (6), protocol/standards artifacts (5), agent CLIs and their config formats (5), and session/memory documentation sets (8, overlapping the first three genres).

| Source (genre) | URL | Activity signal (fetched 2026-08-01) | License | Deep-read? |
|---|---|---|---|---|
| vercel/eve (framework) | https://github.com/vercel/eve | 4,219★, created 2026-06-16, last push 2026-08-01 | Apache-2.0 | Yes (README) |
| eve docs (framework docs) | https://eve.dev/llms.txt | Served with npm package (`node_modules/eve/docs`) | — | Yes (agent.ts page) |
| vercel-labs/personal-agent-template (reference app) | https://github.com/vercel-labs/personal-agent-template | 434★, last push 2026-07-07 | MIT | Yes (README + docs/ARCHITECTURE.md) |
| letta-ai/letta (framework) | https://github.com/letta-ai/letta | 24,045★, last push 2026-07-30 | Apache-2.0 | Yes (README) |
| Letta docs (memory/conversations) | https://docs.letta.com/llms.txt , https://docs.letta.com/configuration/memory/index.md , https://docs.letta.com/concepts/conversations/index.md | Active docs site | — | Yes (3 pages) |
| elizaOS/eliza (framework) | https://github.com/elizaOS/eliza | 18,859★, last push 2026-08-01 | MIT | Yes (README + character-schema.ts) |
| Character Card V2 spec (format spec) | https://github.com/malfoyslastname/character-card-spec-v2 | 180★, last push 2023-06-22 (frozen, by design) | none declared | Yes (spec_v2.md) |
| SillyTavern (reference impl of chara_card_v2) | https://github.com/SillyTavern/SillyTavern | 31,456★, last push 2026-07-11 | AGPL-3.0 | Metadata only |
| microsoft/semantic-kernel → Agent Framework (framework) | https://github.com/microsoft/semantic-kernel | 28,399★, last push 2026-07-30 | MIT | Metadata only |
| Agent Framework docs (declarative agents, sessions, compaction) | https://github.com/MicrosoftDocs/semantic-kernel-docs (`agent-framework/agents/*`) | ms.date 2026-05/07 | — | Yes (3 docs) |
| MCP specification (protocol) | https://github.com/modelcontextprotocol/modelcontextprotocol | 8,806★, last push 2026-07-31; latest spec revision **2026-07-28** | NOASSERTION | Yes (transports index + streamable-http) |
| MCP reference servers | https://github.com/modelcontextprotocol/servers | 89,110★, last push 2026-07-29 | NOASSERTION (MIT historically) | Yes (README) |
| MCP registry | https://github.com/modelcontextprotocol/registry , https://registry.modelcontextprotocol.io | 7,094★; API freeze v0.1 since 2025-10-24, GA pending | NOASSERTION | Yes (README) |
| anthropics/claude-code (CLI) | https://github.com/anthropics/claude-code | 139,862★, last push 2026-07-25 | proprietary (none declared) | Metadata only |
| Claude Code docs (settings, MCP) | https://code.claude.com/docs/en/settings.md , https://code.claude.com/docs/en/mcp.md | versioned to v2.1.202+ | — | Yes (2 pages) |
| Aider-AI/aider (CLI) | https://github.com/Aider-AI/aider | 47,848★, last push 2026-05-22 | Apache-2.0 | Yes (sample .aider.conf.yml) |
| aaif-goose/goose (CLI; redirected from block/goose, HTTP 301) | https://github.com/aaif-goose/goose | 52,046★, last push 2026-08-01 | Apache-2.0 | Yes (config-files.md) |

Median activity signals: ~24k stars for framework/CLI repos; all except the frozen chara_card_v2 spec and aider pushed within the last 90 days — this corpus is **alive and fast-moving**, with one deliberate exception (the character-card spec is stable-by-design). Type mix: 4 TS/JS ecosystems (eve, PAT, eliza, claude-code config), 2 Python (letta legacy, aider), 1 Rust (goose), 1 .NET/Python/Go (Agent Framework), 1 JSON-only artifact (chara_card_v2), 3 protocol artifacts (MCP spec/servers/registry).

## 2. Canonical Macro-Structure

Across genres, the dominant shape of a persona-agent framework is a four-block pipeline, with identity attached orthogonally at the session block:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. PERSONA DECLARATION   "who the agent is"                          │
│    file/schema → system prompt  (instructions.md · character.json ·  │
│    chara_card_v2 data{} · YAML kind:Prompt · persona/human blocks)   │
├──────────────────────────────────────────────────────────────────────┤
│ 2. MEMORY   "what the agent keeps"                                   │
│    in-context blocks / git-versioned memory FS / knowledge-graph /   │
│    lorebook (keyword-triggered injection) / approved user facts      │
├──────────────────────────────────────────────────────────────────────┤
│ 3. TOOLS   "what the agent can do"                                   │
│    typed in-proc functions (defineTool) · plugins · MCP servers      │
│    (stdio | streamable-HTTP)                                         │
├──────────────────────────────────────────────────────────────────────┤
│ 4. SESSION   "how a conversation lives and dies"                     │
│    durable thread ↔ compaction (truncate / slide / summarize) ↔      │
│    per-USER memory injection at session start (userId-scoped)        │
└──────────────────────────────────────────────────────────────────────┘
              identity (auth user) cuts across 2 and 4
```

Per-genre variations:

- **Filesystem-first framework (eve)** — the blocks are *directories*: `agent/instructions.md` (persona), `agent/tools/*.ts` (`defineTool` + zod schema), `agent/skills/*.md` (on-demand procedures), `agent/channels/*.ts` (ingress), `agent/schedules/*.ts` (cron), plus `agent/agent.ts` (`defineAgent({ model })`) for runtime config including compaction. Source: https://github.com/vercel/eve (README), https://eve.dev/llms.txt.
- **Stateful-agent platform (Letta)** — blocks are *server objects*: agent identity + `human`/`persona` core-memory strings at creation, long-term knowledge in **MemFS** (a git-versioned memory filesystem the agent edits itself), many **conversations** per agent sharing that memory, "dreaming" (sleep-time subagents) for offline consolidation. Sources: https://github.com/letta-ai/letta , https://docs.letta.com/configuration/memory/index.md , https://docs.letta.com/concepts/conversations/index.md.
- **Character-card ecosystem (SillyTavern/chara_card_v2)** — persona is a *portable JSON document* (`spec: "chara_card_v2"`, `data: {name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, alternate_greetings, character_book, tags, creator, extensions}`), embeddable in PNG. Memory is the **character_book/lorebook**: keyword-triggered entries with `scan_depth`, `token_budget`, `insertion_order`, `constant`, and `position`. No tool standard, no session model — the frontend supplies both. Source: https://github.com/malfoyslastname/character-card-spec-v2 (spec_v2.md).
- **Agentic OS (elizaOS)** — persona is a validated **Character object** (zod-strict: `name, username, bio, system, adjectives, topics, style{all,chat,post}, messageExamples, postExamples`); tools are installable **plugins/apps** from a package registry; the runtime owns channels (iMessage, Discord, Telegram, WhatsApp, Slack, X). Sources: https://github.com/elizaOS/eliza (README), `packages/agent/src/config/character-schema.ts`.
- **Enterprise SDK (Microsoft Agent Framework, the Semantic-Kernel successor)** — persona is either code (`instructions`) or a **declarative YAML/JSON agent** (`kind: Prompt, name, description, instructions, model.options, outputSchema`) loadable via `CreateFromYamlAsync`; sessions are `AgentSession` objects with serializable state; history size is managed by explicit **compaction strategies** (truncation, sliding window, tool-result collapse, summarization, composed pipelines). Sources: https://github.com/MicrosoftDocs/semantic-kernel-docs (`agent-framework/agents/declarative.md`, `conversations/session.md`, `conversations/compaction.md`).
- **Reference application (vercel-labs/personal-agent-template)** — shows the *composition* pattern: eve agent blocks + a Next/Nuxt app owning identity (Better Auth), per-user threads in SQLite (Drizzle), memory **injected at `session.started`** via an internal API keyed by `userId`, and a `save_memory` tool whose writes require **explicit user approval** in the UI. Cross-channel identity (Slack ID, E.164 phone → app user) is resolved via link tables. Source: https://github.com/vercel-labs/personal-agent-template (`docs/ARCHITECTURE.md`).

## 3. The Design Engine: How These Frameworks Solve the Same Five Problems

Each framework can be replayed as the same five-beat engine — motivating problem → gap → key insight → artifact → claims:

1. **Persona.**
   - *Problem:* an LLM with no stable identity is inconsistent across turns and channels. *Gap:* system prompts are strings buried in application code, unversioned and unshareable. *Insight:* persona is **data with a schema** — a file that can be diffed, validated, imported, and distributed. *Artifacts:* `instructions.md` (eve), `chara_card_v2` JSON (SillyTavern ecosystem), Character object (elizaOS), declarative YAML agent (Agent Framework), `persona`/`human` strings (Letta). *Claims:* behavioral consistency plus portability (character cards are traded as PNG-embedded files across frontends).
2. **Memory beyond the context window.**
   - *Problem:* conversations end; users expect the agent to remember. *Gap:* naive transcript replay blows the context window and costs tokens. *Insight:* memory must be **structured, agent-writable, and selectively re-injected** — a curated store, not a log. *Artifacts:* MemFS git-versioned memory FS + "dreaming" consolidation (Letta); knowledge-graph memory server (MCP `memory`); lorebook keyword injection with token budgets (chara_card_v2); five fixed prose categories with **user-approved saves** (personal-agent-template). *Claims:* continuity of identity/facts across sessions and devices at bounded token cost.
3. **Tools without N×M integration.**
   - *Problem:* every agent needs filesystem/web/time/etc.; every app re-implements them. *Gap:* pre-MCP plugins were framework-locked (eliza plugins, SK plugins). *Insight:* a **single open client–server protocol (MCP)** decouples tool authors from agent authors. *Artifacts:* MCP spec (latest revision 2026-07-28), 7 reference servers, the community Registry, `claude mcp add` / goose `extensions` / eve `connections`. *Claims:* "connect once, use in any MCP client."
4. **Long sessions inside finite contexts.**
   - *Problem:* threads grow past the model window. *Gap:* hard truncation loses commitments; full replay is impossible. *Insight:* treat history size as an explicit **compaction policy** — truncation, sliding window, tool-result collapse, or summarization, composable as a pipeline. *Artifacts:* Agent Framework compaction strategies; Letta conversation compaction + `/fork`; eve `agent.ts` compaction config. *Claims:* unbounded thread length with bounded context.
5. **Sessions attached to a person, not a process.**
   - *Problem:* the same user arrives via web, Slack, and SMS and expects one continuous relationship. *Gap:* process-local chat state fragments identity. *Insight:* **identity lives in the app layer; the agent resolves a channel handle to a userId and injects that user's memory at session start.** *Artifacts:* personal-agent-template's Better Auth + `slack_links`/`phone_links` tables + `GET /api/internal/memory?userId=...` at `session.started`; Agent Framework's `AgentSession` with an explicit warning that service-side IDs (`resp_*`, `conv_*`) are *not* end-user authorization boundaries in multi-tenant apps. *Claims:* cross-surface continuity with per-user data isolation.

## 4. Taxonomy

**Memory strategies** (by mechanism; incidence in deep sample, n=8 systems with a memory story):

| Strategy | Mechanism | Seen in |
|---|---|---|
| In-context core blocks | small always-present persona/human blocks the agent edits | Letta (legacy blocks; succeeded by MemFS) |
| Agent-owned filesystem | git-versioned memory files the agent reads/writes/reorganizes; background "dreaming" consolidation | Letta MemFS (https://docs.letta.com/concepts/memfs/index.md) |
| Knowledge graph | entities/relations/observations persisted by a tool server | MCP `memory` reference server (https://github.com/modelcontextprotocol/servers) |
| Keyword-triggered lorebook | entries injected when keys match, with scan_depth/token_budget/insertion_order | chara_card_v2 `character_book` |
| Curated prose facts, human-approved | fixed categories; agent *proposes*, user *approves* writes | vercel-labs/personal-agent-template (`save_memory`) |
| Compaction-as-memory | summarization/sliding-window of history as the only retention | Agent Framework compaction strategies; Letta conversation compaction |

**Persona-declaration formats:** (a) bare Markdown instructions file — eve `agent/instructions.md`; (b) strict JSON character schema — elizaOS CharacterSchema (zod, unknown keys rejected); (c) portable card with embedded JSON + lorebook — chara_card_v2; (d) declarative YAML/JSON agent manifest — Agent Framework `kind: Prompt`; (e) API-created strings — Letta `createAgent({persona, human})`. Incidence: file-based (a, b, d) is the modern majority; card (c) dominates the hobbyist/roleplay ecosystem only.

**Tool standards:** (a) MCP — the cross-framework standard: spec at https://modelcontextprotocol.io (repo: modelcontextprotocol/modelcontextprotocol), reference servers + community registry; adopted by claude-code (`claude mcp add`), goose (`extensions` of type `stdio`/`streamable_http`), eve (`connections/`), Letta, and Claude Desktop-class clients; (b) framework-native typed functions — eve `defineTool` + zod; (c) plugin/package registries — elizaOS apps/plugins; (d) SDK plugins — Agent Framework/`Microsoft.Extensions.AI` tools. Trend: native functions for first-party tools, MCP for everything external.

**Session models:** (a) one agent ↔ many threads, memory shared across threads (Letta conversations; PAT threads); (b) serializable session objects with local + service-side IDs (Agent Framework `AgentSession`); (c) durable channel-driven sessions (eve channels + schedules); (d) stateless cards where the frontend owns history (chara_card_v2 ecosystem). TTL/expiry is conspicuously **not standardized**: the 2026-07-28 MCP revision *removed* transport-level session artifacts (`Mcp-Session-Id`, standalone SSE streams, `Last-Event-ID` resumability — see https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), pushing session lifetime entirely into the application layer. In practice, apps use DB-backed threads with app-defined retention (PAT: SQLite threads, no TTL) and summarization-based long-term memory rather than raw transcript replay (Letta compaction + MemFS; Agent Framework summarization strategy).

## 5. Maturity Levels

A five-level scale, scored on: spec stability, reference implementations, ecosystem adoption, and governance.

| Level | Description | Incidence (this corpus) |
|---|---|---|
| **L5 — Standard** | Versioned spec, multiple independent implementations, deprecation policy, working-group governance | MCP protocol (dated revisions 2024-11-05 → 2026-07-28; SEP lifecycle files in repo; 10 official SDKs listed in servers README). Sole L5. |
| **L4 — De-facto ecosystem format** | Frozen spec, huge downstream adoption, no active governance needed | chara_card_v2 (spec untouched since 2023-06-22 but is *the* interchange format of the character ecosystem; SillyTavern 31k★ implements it) |
| **L4 — Production framework** | Backing org, releases, docs site, breaking-change discipline | Letta (Apache-2.0, V1→Letta-Agent migration documented in README), elizaOS, Microsoft Agent Framework, goose, aider, claude-code |
| **L3 — Emerging, org-backed beta** | Real users, explicit instability disclaimer | vercel/eve — README states it is in beta under Vercel's public-beta terms; personal-agent-template (434★) as its reference app; MCP Registry (preview; v0.1 API freeze 2025-10-24, GA pending) |
| **L2 — Community project** | Active but small/uncertain governance | smaller GitHub "eve"-named projects (e.g. scaling-group/eve, 47★) |
| **L1 — Unverifiable/ghost** | Referenced but does not resolve | `github.com/zenbaseai/eve` — HTTP 404 on 2026-08-01 |

## 6. Framework × Capability Matrix

(✓ = first-class, ◐ = partial/via extension, — = absent. Sources as cited in §1.)

| Capability | eve (Vercel) | Letta | elizaOS | chara_card_v2 (+SillyTavern) | MS Agent Framework | goose | claude-code | aider |
|---|---|---|---|---|---|---|---|---|
| Persona as versioned file | ✓ `instructions.md` | ◐ API strings / MemFS identity files | ✓ character JSON (zod) | ✓ card JSON | ✓ YAML `kind: Prompt` | ◐ prompt templates | ◐ `CLAUDE.md` | ◐ conventions |
| Structured long-term memory | ◐ via app/skills | ✓ MemFS + dreaming | ✓ plugin memory/RAG | ◐ lorebook (prompt-time) | ◐ context providers | ✓ built-in `memory` ext | ◐ via MCP | — |
| User-approved memory writes | ✓ (in PAT reference app) | ◐ | ◐ owner-approved actions | — | — | ◐ (permission modes) | ✓ permissions | — |
| MCP client | ✓ `connections/` | ✓ | ◐ plugins | — | ✓ | ✓ `stdio`/`streamable_http` ext | ✓ `.mcp.json` / `claude mcp add` | — |
| MCP server-authoring path | via TS SDK | via Python SDK | — | — | via .NET SDK | via any SDK | scaffold plugin | — |
| Multi-channel (Slack/SMS/etc.) | ✓ channels/ | ✓ channels | ✓ 7+ surfaces | ✓ (frontend) | ◐ | — | ✓ channels | — |
| Session compaction policy | ✓ `agent.ts` | ✓ automatic + `/fork` | ◐ | frontend's job | ✓ 5 named strategies | ✓ smart context mgmt | ✓ auto-compact | ◐ |
| Per-user identity scoping | app-layer (PAT shows how) | ✓ agents per user | ✓ owner model | — | ✓ documented (incl. multi-tenant warning) | — | ◐ | — |
| License | Apache-2.0 | Apache-2.0 | MIT | spec: none / ST: AGPL-3.0 | MIT | Apache-2.0 | proprietary | Apache-2.0 |
| Maintenance (fetched 2026-08-01) | beta, same-day commits | active; dev moved to letta-code repo | same-day commits | spec frozen 2023 (by design) | active (docs dated 2026-05/07) | same-day commits | active | last push 2026-05-22 |

## 7. Limitations, Licensing, Risks

- **"Eve" ambiguity (verified).** `github.com/zenbaseai/eve` returns **404** — no such framework exists under that URL. The real, current "eve" is **`vercel/eve`** (https://github.com/vercel/eve, homepage https://eve.dev), a filesystem-first agent framework created 2026-06-16, Apache-2.0, **explicitly in public beta** ("APIs, documentation, and behavior may change before general availability"). Reuse its *conventions* (directory layout, `defineAgent`/`defineTool`) rather than hard-depending on its APIs today.
- **License hazards.** SillyTavern is **AGPL-3.0** — do not vendor its code into the proprietary Next.js platform; the chara_card_v2 *spec* itself carries no declared license, but as a JSON field-specification it is safe to implement independently. elizaOS (MIT), Letta (Apache-2.0), eve (Apache-2.0), goose (Apache-2.0), aider (Apache-2.0), Agent Framework (MIT) are all permissive. claude-code is proprietary — its config *formats* (`.mcp.json`, settings scopes) are conventions worth copying, not code.
- **Repo drift.** `block/goose` now 301-redirects to `aaif-goose/goose`; Letta's main repo is in maintenance mode with active development moved to `letta-ai/letta-code` (per its README note). Pin org names loosely in docs.
- **MCP reference servers are not production products.** The servers README carries an explicit warning: they are educational reference implementations; developers must do their own security evaluation. Several formerly-reference servers (SQLite, PostgreSQL, GitHub, Slack, Brave Search, Puppeteer, Redis, Sentry, Google Drive/Maps, EverArt, AWS KB) were **archived** to `modelcontextprotocol/servers-archived` — notably, **there is no longer an official SQLite reference server**; use a maintained community one from the Registry.
- **Registry is preview.** The MCP Registry (https://registry.modelcontextprotocol.io) is in preview with a v0.1 API freeze (2025-10-24); data resets are still possible pre-GA. Treat it as discovery, not as a package manager of record.
- **Transport churn.** The 2026-07-28 MCP revision *removed* `Mcp-Session-Id`, standalone GET-SSE streams, and `Last-Event-ID` resumability from Streamable HTTP; plain SSE is deprecated across clients (goose keeps `sse` only for compatibility; claude-code docs warn it is deprecated). New work should target **stdio (local) and Streamable HTTP (remote)** only.
- **Security.** Both claude-code docs and the servers README warn that MCP servers fetching external content are a **prompt-injection** vector; per-user memory injection (PAT pattern) must be scoped server-side by authenticated `userId` — Agent Framework docs explicitly warn that provider-side conversation IDs are not authorization boundaries in multi-tenant apps.

## Method Notes

- **Selection:** the four scope areas from the brief; for each, the canonical repo + its official docs, located by GitHub search/metadata API rather than recalled URLs.
- **Fetching:** all sources retrieved with `curl` on 2026-08-01 — GitHub REST API for repo metadata (stars/license/pushed_at), `raw.githubusercontent.com` for READMEs/specs/config references, and markdown mirrors for JS-rendered docs (`code.claude.com/docs/en/*.md`, `docs.letta.com/*/index.md`, `eve.dev/llms.txt`). Counts: 24 endpoints fetched (census); 14 documents read in substance (deep sample).
- **Lower bounds:** star counts and push dates are point-in-time (2026-08-01) and a lower bound on activity; "docs depth" was assessed from README + 1–3 docs pages per project, not full doc sites. The character-card ecosystem's true size (frontends beyond SillyTavern: Agnai, RisuAI, etc.) was not enumerated. Claims about hosted products (Claude Desktop, Letta Cloud) were excluded unless visible in fetched pages.

## Recommendations for Pip says

1. **Persona declaration — adapt chara_card_v2, don't adopt it wholesale.** Its `data{name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions}` core is the most battle-tested persona schema in existence and maps cleanly onto Pip's paperclip character; keep its `extensions` namespacing rule (never destroy unknown keys). Add an eve-style `instructions.md`-equivalent field so the persona compiles to a plain system prompt. Implement the fields yourself (spec is license-free); do not import AGPL SillyTavern code. (https://github.com/malfoyslastname/character-card-spec-v2)
2. **Agent structure — copy eve's filesystem-first layout** (`instructions` + `tools/` + `skills/` + `channels/`) as the "Pip says" authoring convention; it is the clearest current expression of persona→tools→sessions and is Apache-2.0. Also borrow the personal-agent-template's composition: **memory injected at session start, keyed by authenticated userId, with user-approved `save_memory` writes** — this is exactly the per-user session-memory pattern Pip needs on Next.js. (https://github.com/vercel/eve , https://github.com/vercel-labs/personal-agent-template)
3. **Memory strategy — two tiers:** (a) Letta-style curated long-term memory (agent-proposes/user-approves; skip full MemFS git machinery for now) plus (b) Agent Framework-style **compaction** for long threads: sliding window + summarization rather than raw transcript replay. (https://docs.letta.com/configuration/memory/index.md , https://github.com/MicrosoftDocs/semantic-kernel-docs `agent-framework/agents/conversations/compaction.md`)
4. **Tool standard — MCP, transports stdio + Streamable HTTP only.** Declare Pip's servers in a claude-code-style `.mcp.json` (the de-facto client config format; `type: "http"` with `streamable-http` accepted as alias) and/or goose-style YAML `extensions` if a YAML profile is preferred. Do not build on SSE or on `Mcp-Session-Id`-based transport sessions. (https://code.claude.com/docs/en/mcp.md , https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
5. **Out-of-the-box MCP server set for a helpful assistant** (verified maintained reference servers at https://github.com/modelcontextprotocol/servers as of 2026-08-01):
   - **memory** (knowledge-graph persistent memory) — backs Pip's long-term memory tier;
   - **fetch** (web content fetching) — the single highest-utility server for a games-platform assistant;
   - **time** (time/timezone conversion) — cheap, prevents date reasoning errors;
   - **filesystem** (secure file ops with configurable access controls) — enable only if Pip touches project files, with allow-listed roots;
   - **sequential-thinking** (structured reasoning) — optional, for complex debugging flows;
   - **everything** — dev/test only, not for production.
   - **sqlite: no longer a maintained reference server** (archived); if Pip needs SQL, pick a maintained community server via the Registry (https://registry.modelcontextprotocol.io) and security-review it first.
6. **CLI/profile format — YAML at two scopes.** Follow the goose/aider/claude-code consensus: user-scope config (`~/.config/pip-says/config.yaml`-style: `active_provider`, `model`, `extensions`/`mcpServers`) + project-scope file committed to the repo, with env-var overrides (`PIPSAYS_MODEL` etc.) — mirroring goose's `GOOSE_PROVIDER`/`GOOSE_MODEL` migration story and claude-code's managed/user/project/local scopes. For Pip's OpenRouter setup this means `provider: openrouter` + `model: <id>` in one place, MCP servers in the same file. (https://github.com/aaif-goose/goose `documentation/docs/guides/config-files.md` , https://code.claude.com/docs/en/settings.md , https://github.com/Aider-AI/aider sample `.aider.conf.yml`)
7. **Session model — app-layer, user-scoped, no transport sessions.** Per-user threads table (Postgres/SQLite via the existing Next.js stack), memory injection on session start, summarization-on-threshold for long threads, and retention/TTL defined by *your* policy (no standard exists — the MCP spec deliberately left this layer after 2026-07-28). Heed the Agent Framework warning: never let a provider-side conversation ID act as an authorization boundary between users. (https://github.com/MicrosoftDocs/semantic-kernel-docs `agent-framework/agents/conversations/session.md`)
