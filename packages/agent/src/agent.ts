import { Agent, BedrockModel, SessionManager, type AgentConfig } from '@strands-agents/sdk';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_REGION,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from './config.js';
import { DynamoSnapshotStorage } from './memory/dynamo-snapshot-storage.js';
import { createRecallMemoryTool } from './tools/recall-memory.js';
import { recordTurn } from './memory/turns.js';
import { streamTurn, type StrandsStream } from './stream.js';
import type { SendMessage } from './protocol.js';

// The assistant factory + turn orchestration. This is the portable core
// that both the AgentCore Runtime host (example/backend/agent) and any
// future Lambda-based invoker build on. It knows nothing about WebSockets,
// AgentCore, or HTTP — it just produces a configured Strands Agent and runs
// turns through the wire-protocol streamer.

export interface CreateAssistantOptions {
  /** Conversation/session id — drives snapshot persistence and multi-turn. */
  sessionId: string;
  /** Verified caller id; enables the recall_memory tool scoped to this user. */
  userId?: string;
  modelId?: string;
  systemPrompt?: string;
  /** Extra Strands tools to expose alongside recall_memory. */
  tools?: AgentConfig['tools'];
  /** Inject a storage backend (tests pass a fake); defaults to DynamoDB. */
  storage?: DynamoSnapshotStorage;
}

export function createAssistant(options: CreateAssistantOptions): Agent {
  const {
    sessionId,
    userId,
    modelId = DEFAULT_MODEL_ID,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    tools = [],
    storage = new DynamoSnapshotStorage(),
  } = options;

  const sessionManager = new SessionManager({
    sessionId,
    storage: { snapshot: storage },
  });

  const assistantTools: NonNullable<AgentConfig['tools']> = [
    ...(userId ? [createRecallMemoryTool(userId)] : []),
    ...(tools ?? []),
  ];

  return new Agent({
    model: new BedrockModel({
      region: DEFAULT_REGION,
      modelId,
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
    }),
    systemPrompt,
    tools: assistantTools,
    sessionManager,
  });
}

export interface HandleUserMessageOptions {
  request: string;
  sessionId: string;
  userId?: string;
  send: SendMessage;
}

/**
 * Runs one full turn end-to-end: streams the agent's response to the client
 * over the wire protocol, then records the turn to DynamoDB (which the
 * stream vectorizer turns into semantic memory). Returns the assistant text.
 *
 * The host is expected to construct the agent once per session and reuse it
 * across turns on the same connection.
 */
export async function handleUserMessage(
  agent: Agent,
  { request, sessionId, userId, send }: HandleUserMessageOptions,
): Promise<string> {
  // `agent.stream()` returns an async iterable of Strands events.
  const stream = agent.stream(request) as unknown as StrandsStream;
  const response = await streamTurn(stream, { sessionId, send });

  if (userId) {
    await recordTurn({ userId, sessionId, request, response });
  }

  return response;
}
