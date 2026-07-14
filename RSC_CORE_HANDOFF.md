# Handoff: integrating the AgentCore chatbot into `rsc-core`

You're picking up a completed Node/TypeScript rewrite of an AgentCore chatbot,
staged in the `agentcore-starter` repo. Your job is to lift the two reusable
packages into `readysetcloud/rsc-core` and wire them into the shared platform.
Everything here builds, lints, typechecks, and tests green locally; the only
unverified parts require live AWS (called out under **Verify on AWS**).

Read [MIGRATION.md](MIGRATION.md) alongside this — it has the rationale. This
file is the task list.

---

## 1. What you're inheriting

Two framework-clean packages plus a reference app.

### `@readysetcloud/agent` (`packages/agent`)
Portable agent core. No knowledge of WebSockets, AgentCore, HTTP, or the app.
Public API (`src/index.ts`):

| Export | Purpose |
|--------|---------|
| `createAssistant({ sessionId, userId?, modelId?, systemPrompt?, tools?, storage? })` | Builds a Strands `Agent` with a DynamoDB session manager + `recall_memory` tool. |
| `handleUserMessage(agent, { request, sessionId, userId?, send })` | Runs one turn: streams wire messages via `send`, records the turn to DynamoDB, returns the assistant text. |
| `streamTurn(stream, { sessionId, send })`, `toStreamEventBodies(event)` | Streaming primitives / the SDK→wire normalizer (the one SDK coupling point). |
| `DynamoSnapshotStorage` | Implements Strands' `SnapshotStorage` port against the single table. |
| `recordTurn`, `turnKey`, `TURN_ENTITY` | Conversation-turn rows. |
| `putMemoryTurns`, `recallMemory`, `deleteMemoryKeys`, `memoryVectorKey`, `embedText` | Semantic-memory data plane (S3 Vectors + Titan). |
| `createRecallMemoryTool(userId)` | The `recall_memory` Strands tool (user-scoped). |
| `DEFAULT_MODEL_ID`, `DEFAULT_SYSTEM_PROMPT`, … | Config constants. |

Subpath **`@readysetcloud/agent/memory`** re-exports only the memory pieces and
pulls in **no** Strands SDK — use it from Lambdas (the vectorizer does).

### `@readysetcloud/ui-chat` (`packages/ui`)
React chat surface. Named `-chat` only to avoid clashing with the published
`@readysetcloud/ui` during staging. Public API (`src/index.ts`):

| Export | Purpose |
|--------|---------|
| `Chat` | Drop-in chat surface. Props = `useAgentChat` options + `title?`, `initialQuery?`. |
| `useAgentChat({ sessionId, userId?, getConnectionUrl, autoConnect? })` | Owns connection lifecycle (reconnect/backoff) + streaming state. |
| `WebSocketChatClient` | Framework-agnostic transport; takes an injected `getConnectionUrl`. |
| `ChatMessage`, protocol types | Presentational bubble + wire types. |

Components use `@readysetcloud/ui` tailwind-preset token classes (`btn-primary`,
`card`, `input`, `text-foreground`, `text-muted-foreground`, `border-border`,
`bg-error-100`, …) — no restyling needed inside rsc-core.

### `example/` (reference only — do not migrate wholesale)
- `example/backend/agent` — the NODE_22 AgentCore artifact hosting the agent.
- `example/backend/functions` — `websocket-connect` (SigV4 presign) + `vectorize-turn` (DDB-stream → S3 Vectors).
- `example/backend/template.yaml` — single table+stream, S3 Vectors, AgentCore Runtime, Cognito.
- `example/frontend` — Vite app consuming both packages + the real `@readysetcloud/ui`.

---

## 2. Integration tasks (ordered)

### Task A — Land `@readysetcloud/agent`
It has no example coupling; publish/vendor as-is or fold into your core package
set. Keep the `.` and `./memory` exports split (the memory subpath must stay
Strands-free so stream/DDB consumers don't bundle the SDK). Keep the exact
version pins on `@strands-agents/sdk` (`1.9.0`) — see the guardrail in §4.

### Task B — Merge `@readysetcloud/ui-chat` into `@readysetcloud/ui`
Move `Chat`, `ChatMessage`, `useAgentChat`, `WebSocketChatClient`, and
`protocol.ts` under `ui/src` (e.g. a `chat/` folder) and export them — either
from the root or a new `@readysetcloud/ui/chat` subpath. Delete the standalone
`-chat` package. The wire-protocol types are currently mirrored in both packages
(`packages/agent/src/protocol.ts` is the source of truth,
`packages/ui/src/protocol.ts` the client copy) — in rsc-core, collapse to one
shared definition and have both sides import it.

### Task C — Backend infra into a service stack
Fold `example/backend` resources into an rsc-core service stack, following the
content-tracking conventions already in the org:
- **Cognito** — swap the self-contained pool for the shared RSC pool (SSM
  `/readysetcloud/auth/user-pool-arn`, per-service app client), as content-tracking does.
- **Single table** — the agent core expects these keys (match them or adapt
  `DynamoSnapshotStorage`/`turns.ts`):
  - Turn rows: `pk=MEMORY#{userId}`, `sk=TURN#{sessionId}#{ts}#{role}`, `entity="Turn"`, `expiresAt` TTL.
  - Snapshots: `pk=SESSION#{sessionId}`, `sk=SNAPSHOT#{scope}#{scopeId}#{id}` / `LATEST#…` / `MANIFEST#…`.
  - Stream (`NEW_AND_OLD_IMAGES`) filtered to `entity=Turn` drives the vectorizer.
- **S3 Vectors** — index `conversation-memory`, **dim 1024, cosine, `text`
  non-filterable**; filter metadata `{userId, sessionId, role}`. Must match
  `EMBEDDING_MODEL_ID` (Titan v2 @ 1024).
- **AgentCore Runtime** — `Runtime: NODE_22`, artifact = the esbuild bundle +
  prod node_modules (see `scripts/package-agent.mjs`).

### Task D — Frontend consumer
`example/frontend` already shows the target pattern: `configureAuth` +
`AuthProvider` + `RequireAuth` from `@readysetcloud/ui/auth`, a `getConnectionUrl`
that calls the presign endpoint with `getFreshIdToken()`, and `<Chat>` from the
chat package. Reuse or adapt into the rsc-core dashboard.

---

## 3. Contracts to preserve (don't break these)

- **Wire protocol** (agent ↔ browser), unchanged from the original Python agent:
  ```
  { type: "stream_event", event: { data } | { current_tool_use:{name,tool_use_id} } | { init_event_loop:true } | { complete:true } }
  { type: "complete", session_id }
  { type: "error", error, message? }
  ```
- **Identity = verified Cognito `sub`.** The presign Lambda reads `sub` from the
  authorizer and passes it as the `x-amzn-bedrock-agentcore-runtime-custom-user-id`
  header; the agent trusts that, never a client-supplied id. `recall_memory`
  closes over that `userId` so memory can't leak across users.
- **`getConnectionUrl` injection.** The UI never imports app auth; the app
  supplies a `(sessionId?) => Promise<string>` that returns a presigned `wss://`.

---

## 4. Guardrails already in place

- **Stream-shape contract test** — `packages/agent/src/stream.contract.test.ts`
  constructs real `@strands-agents/sdk` event instances and type-binds fixtures
  via `satisfies`. Run by `npm test` (runtime) + `npm run typecheck -w
  packages/agent` (compile-time, includes test files, in CI). An SDK bump that
  changes the event contract fails CI — fix `stream.ts` (the single coupling
  point) then bump the exact pin. Carry this test + the typecheck step into rsc-core.
- **Exact pins** on `@strands-agents/sdk` (1.9.0) and `bedrock-agentcore` (0.4.0)
  in `packages/agent`, `example/backend/agent`, and `scripts/package-agent.mjs`.

---

## 5. Verify on AWS (not checkable without a deploy)

1. **`AWS::BedrockAgentCore::Runtime` `EntryPoint`** — set to `index.js`. cfn-lint's
   spec doesn't yet know `NODE_22` (`E3030`), and there's no first-party TS
   WebSocket tutorial, so confirm the literal via a real deploy / `agentcore
   deploy --plan`.
2. **End-to-end stream** — sign in → `POST /websocket/connect` → open the
   presigned socket → confirm `stream_event`→`complete`, multi-turn continuity
   (snapshots), and that `recall_memory` returns prior-session facts.
3. **Agent packaging on linux-arm64** — `npm run package:agent` stages the zip;
   verify it runs on the runtime (all deps are pure-JS today, but confirm).

---

## 6. Gotchas

- **Don't full-bundle the AgentCore artifact.** `@strands-agents/sdk` ships
  optional integrations (S3 context-offloader, playwright, google/openai) whose
  peers we don't install; `build.mjs` inlines only first-party code and keeps
  third-party external (shipped via node_modules). Full-bundling breaks on an
  unresolved `@aws-sdk/client-s3`.
- **NODE_22 is the only CodeZip runtime.** If a native dep appears, switch to
  container/ECR.
- **`bedrock-agentcore` is 0.x** and its README is stale (says Express; it's
  Fastify). The runtime API is constructor-config (`invocationHandler` required
  even for WebSocket-only), not decorators.
- **No `use_llm` TS tool** — dropped; use Strands agent-as-tool if needed later.

---

## 7. Run it locally

```bash
npm install
npm run build                     # build both packages first
npm run lint --workspaces --if-present
npm run typecheck -w packages/agent
npm test --workspaces --if-present
npx tsc -p example/backend/agent/tsconfig.json   # AgentCore artifact typecheck
( cd example/backend && sam validate )
npm run build -w example/frontend # needs VITE_* (any values) to build
```

Key files to open first: `packages/agent/src/{agent,stream,protocol}.ts`,
`packages/agent/src/memory/*`, `packages/ui/src/{useAgentChat,WebSocketChatClient}.ts`,
`example/backend/agent/src/index.ts`, `example/backend/template.yaml`,
`example/frontend/src/{api/connection,pages/ChatPage}.tsx`.
