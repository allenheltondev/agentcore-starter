# AgentCore Chatbot Starter (Node/TypeScript)

An AI chatbot on **AWS Bedrock AgentCore Runtime** with real-time WebSocket
streaming and conversation memory — rewritten in Node/TypeScript following the
Ready, Set, Cloud serverless paradigms (`readysetcloud/newsletter-service`,
`allenheltondev/content-tracking`).

The reusable pieces are factored into two packages destined for
[`readysetcloud/rsc-core`](https://github.com/readysetcloud):

- **`@readysetcloud/agent`** (`packages/agent`) — a portable, framework-agnostic
  agent core: a [Strands-TS](https://github.com/strands-agents) assistant with
  DynamoDB-backed conversation snapshots and S3-Vectors semantic memory.
- **`@readysetcloud/ui-chat`** (`packages/ui`) — React chat components + a
  WebSocket hook (`useAgentChat`). Migrates into the existing
  `@readysetcloud/ui` package.

An `example/` app wires both together and is deployable on its own.

## Architecture

```
┌────────────┐   presigned wss:// (SigV4)   ┌──────────────────────────┐
│  React UI  │─────────────────────────────▶│  AgentCore Runtime       │
│ (Cognito)  │                               │  NODE_22 · Strands-TS    │
└─────┬──────┘                               └───────────┬──────────────┘
      │ POST /websocket/connect (JWT)                    │
      ▼                                                  ▼
┌───────────────────┐                       ┌─────────────────────────────┐
│ websocket-connect │                       │ DynamoDB (history+snapshots) │
│ Lambda (SigV4)    │                       │ S3 Vectors (semantic memory) │
└───────────────────┘                       └───────────┬─────────────────┘
                                                         │ DynamoDB stream
                                                         ▼
                                              ┌────────────────────────┐
                                              │ vectorize-turn Lambda  │
                                              └────────────────────────┘
```

- Browser authenticates with **Cognito**, calls `POST /websocket/connect` to get
  a **SigV4 presigned WebSocket URL**, then streams directly to the AgentCore
  Runtime — the transport is unchanged from the original.
- The **agent** (`@readysetcloud/agent`) runs in AgentCore Runtime, streaming
  tokens over the socket and persisting each turn to DynamoDB.
- A DynamoDB-stream **vectorizer** embeds turns into an S3 Vectors index; the
  agent's `recall_memory` tool queries it for cross-session recall. This
  replaces AgentCore Memory.

## Layout

```
packages/
  agent/     @readysetcloud/agent      — assistant, memory, tools, wire protocol
  ui/        @readysetcloud/ui-chat     — Chat component, useAgentChat hook, ws client
example/
  backend/   SAM app: presign Lambda, vectorizer, single table, S3 Vectors, AgentCore Runtime
    agent/   the NODE_22 AgentCore artifact (imports @readysetcloud/agent)
  frontend/  Vite/React app consuming both packages + @readysetcloud/ui for auth/shell
```

## Develop

```bash
npm install
npm run build          # build the two packages (needed before frontend/backend)
npm test               # agent + ui + backend tests
npm run lint
```

Run the frontend against a deployed backend:

```bash
cp example/frontend/.env.example example/frontend/.env.local   # fill from stack outputs
npm run dev -w example/frontend
```

## Deploy

```bash
# 1. Package + upload the agent artifact, then deploy the backend stack.
npm run package:agent
( cd example/backend/agent/.artifact && zip -r ../agent.zip . )
aws s3 cp example/backend/agent/agent.zip s3://<artifacts-bucket>/agents/agent.zip

cd example/backend
sam build --beta-features
sam deploy --guided   # supply ArtifactsBucketName, ResourcePrefix
```

CI (`.github/workflows/ci.yml`) lints, tests, and builds everything on every PR.
`deploy.yml` packages the agent and deploys the backend on merge to `main`.

> **Note:** the AgentCore Node runtime is `NODE_22` (single supported version),
> arm64. Verify the CloudFormation `EntryPoint` literal (`index.js`) on your
> first deploy — see the migration notes.

## Environment

**Backend** (SAM parameters): `Environment`, `ResourcePrefix`,
`ArtifactsBucketName`, `AgentDirectDeployKey`, `BedrockModelId`,
`EmbeddingModelId`.

**Frontend** (`.env.local`): `VITE_API_BASE_URL`, `VITE_AWS_REGION`,
`VITE_USER_POOL_CLIENT_ID`.

See [MIGRATION.md](MIGRATION.md) for how the packages lift into `rsc-core`.
