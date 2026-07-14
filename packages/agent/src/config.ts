// Central configuration for the assistant. Values come from the
// environment so the same package code runs identically whether it's
// hosted in AgentCore Runtime, invoked from a Lambda, or exercised in a
// test. Nothing here reaches out to AWS — it just reads env with sane
// defaults, mirroring the "read process.env at module scope" convention
// from readysetcloud/content-tracking.

export const DEFAULT_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-lite-v1:0';

export const DEFAULT_REGION =
  process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';

// The maximum number of conversation turns the model keeps in its active
// context window before the ConversationManager summarizes older history.
export const DEFAULT_MAX_TOKENS = Number(process.env.BEDROCK_MAX_TOKENS || 4096);

export const DEFAULT_TEMPERATURE = Number(process.env.BEDROCK_TEMPERATURE || 0.7);

// Ported verbatim from the Python agent (backend/agents/agent/agent.py) so
// behavior is unchanged across the rewrite. The recall_memory tool replaces
// the Strands Python `memory` tool referenced here.
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant. You can have multi-turn conversations with users,
remembering context from previous messages and past sessions using your memory tools.

When responding:
- Be concise and helpful
- Use your recall_memory tool to bring back relevant context from earlier conversations when it would help
- Format responses in Markdown when appropriate
- If you're unsure about something, ask for clarification`;
