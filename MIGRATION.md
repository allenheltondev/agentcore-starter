# Migration notes — lifting into `rsc-core`

This repo is a **migratory staging** of an AgentCore chatbot. It is structured so
the two `packages/*` lift cleanly into `readysetcloud/rsc-core`, with `example/`
serving as a reference consumer that can be discarded or kept as an example app.

## What goes where

| Here | In rsc-core |
|------|-------------|
| `packages/agent` (`@readysetcloud/agent`) | Publish as-is, or fold into the core packages. It has no dependency on the example app. |
| `packages/ui` (`@readysetcloud/ui-chat`) | **Merge into the existing `@readysetcloud/ui`**: move `Chat`, `ChatMessage`, `useAgentChat`, `WebSocketChatClient` under `ui/src`, and export them from the package (add a `./chat` subpath or fold into the root). The components already use the `@readysetcloud/ui` tailwind-preset token classes, so no restyling is needed. |
| `example/backend` | Reference SAM app. In rsc-core, the presign Lambda + vectorizer + table + S3 Vectors + AgentCore Runtime become part of a service stack. |
| `example/frontend` | Reference consumer. Already consumes the real `@readysetcloud/ui` for auth/shell. |

The chat package is named **`@readysetcloud/ui-chat`** only to avoid clashing
with the published `@readysetcloud/ui` during staging. On merge, it stops being
a separate package.

## Package boundaries (why they're clean)

- **`@readysetcloud/agent`** knows nothing about WebSockets, AgentCore, HTTP, or
  the example. Its surface: `createAssistant()`, `handleUserMessage()`,
  `streamTurn()` + `toStreamEventBodies()` (wire-protocol normalizer),
  `DynamoSnapshotStorage`, the vector-memory data plane, `recordTurn`, and
  `createRecallMemoryTool`. It exposes a Strands-free `@readysetcloud/agent/memory`
  subpath so Lambda consumers (the vectorizer) don't pull in the Strands SDK.
- **`@readysetcloud/ui-chat`** takes a `getConnectionUrl` function (the app owns
  auth); it never imports app auth/config. The wire protocol is mirrored in
  `packages/ui/src/protocol.ts` — the source of truth is
  `packages/agent/src/protocol.ts`. In rsc-core, share one copy.

## Key decisions carried over

- **AgentCore Runtime kept**, agent rewritten in TypeScript (Strands-TS
  `@strands-agents/sdk`, hosted via `bedrock-agentcore`).
- **AgentCore Memory dropped** in favor of DynamoDB snapshots (Strands
  `SnapshotStorage`) + S3 Vectors semantic recall.
- **Legacy `/query` Step Functions path removed** — the app is WebSocket-only.
- **Tenant/identity** = the verified Cognito `sub` from the presigned URL's
  custom header, never client-supplied.

## Verify on first real deploy

Type/build/test are green locally, but two things need a live AWS check:

1. **`AWS::BedrockAgentCore::Runtime` `EntryPoint`** — set to `index.js` for the
   NODE_22 CodeZip bundle. cfn-lint's spec doesn't yet know the Node runtimes
   (`E3030 NODE_22`), and AWS's first-party WebSocket tutorial is Python-only, so
   confirm the literal against a real deploy or `agentcore deploy --plan`.
2. **Strands stream event shape** — `packages/agent/src/stream.ts` normalizes
   `agent.stream()` events (`modelStreamUpdateEvent` → `textDelta` /
   `toolUseStart`) bound to `@strands-agents/sdk` **1.9.0 (pinned exact)**. This
   is now guarded: `stream.contract.test.ts` constructs real SDK event
   instances and type-binds fixtures via `satisfies`, and `npm run typecheck -w
   packages/agent` (in CI) checks the test files. An SDK bump that changes the
   event contract fails CI loudly — fix `stream.ts`, the single coupling point,
   then bump the pin.

## Known SDK-lag caveats (TS vs Python)

- No TS drop-in for the Python `memory`/`use_llm` community tools — `recall_memory`
  is our own; `use_llm` is unused (use Strands agent-as-tool if needed later).
- AgentCore CodeZip supports only `NODE_22`; fall back to container/ECR if that
  bites.
- `bedrock-agentcore` TS is 0.x — pinned, expect churn.
