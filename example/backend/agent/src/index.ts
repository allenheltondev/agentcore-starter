import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime';
import type { RequestContext } from 'bedrock-agentcore/runtime';
import type { WebSocket } from '@fastify/websocket';
import { z } from 'zod';
import {
  createAssistant,
  handleUserMessage,
  type ServerMessage,
} from '@readysetcloud/agent';
import type { Agent } from '@strands-agents/sdk';

// The AgentCore Runtime artifact. Hosts the portable @readysetcloud/agent
// assistant behind AgentCore's WebSocket endpoint (/ws), preserving the exact
// wire protocol the Python agent spoke so the frontend is unchanged.
//
// This is the direct TypeScript rewrite of backend/agents/agent/agent.py:
//   @app.websocket  -> websocketHandler
//   @app.entrypoint -> invocationHandler.process (kept for HTTP/debug)
//
// Deployed to AgentCore Runtime as a NODE_22 arm64 CodeZip bundle (see build.mjs).

// The presigned-URL Lambda passes the verified Cognito sub as this custom
// header; AgentCore forwards Custom-* headers to the runtime (lower-cased).
const CUSTOM_USER_ID_HEADER = 'x-amzn-bedrock-agentcore-runtime-custom-user-id';

function getUserId(context: RequestContext): string | undefined {
  const direct = context.headers[CUSTOM_USER_ID_HEADER];
  if (direct) return direct;
  // Be tolerant of header-casing differences across AgentCore versions.
  const key = Object.keys(context.headers).find((h) =>
    h.toLowerCase().endsWith('custom-user-id'),
  );
  return key ? context.headers[key] : undefined;
}

const invocationSchema = z.object({
  request: z.string(),
  session_id: z.string().optional(),
  user_id: z.string().optional(),
});

const app = new BedrockAgentCoreApp({
  // The HTTP entrypoint is required even though the browser uses the
  // WebSocket. It doubles as a non-streaming/debug path (mirrors the Python
  // @app.entrypoint) and returns the buffered response.
  invocationHandler: {
    requestSchema: invocationSchema,
    process: async (req, context) => {
      const sessionId = req.session_id ?? context.sessionId;
      const userId = req.user_id ?? getUserId(context);
      const agent = createAssistant({ sessionId, userId });
      const result = await agent.invoke(req.request);
      return { request: req.request, response: result.toString(), session_id: sessionId };
    },
  },

  // Real-time streaming path. Keeps one connection open for a multi-turn
  // conversation, recreating the agent when the client switches sessions.
  websocketHandler: async (socket: WebSocket, context: RequestContext) => {
    const userId = getUserId(context);
    let agent: Agent | null = null;
    let sessionId: string | null = null;

    const send = (message: ServerMessage) => socket.send(JSON.stringify(message));

    context.log.info({ userId, sessionId: context.sessionId }, 'WebSocket connected');

    socket.on('message', async (raw: Buffer) => {
      let data: { request?: string; session_id?: string };
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', error: 'Invalid JSON in request' });
        return;
      }

      const request = data.request;
      const msgSessionId = data.session_id;

      if (!request) {
        send({ type: 'error', error: 'Missing required field: request' });
        return;
      }
      if (!msgSessionId) {
        send({ type: 'error', error: 'Missing required field: session_id' });
        return;
      }

      try {
        // Create the agent on first message, or recreate when the session changes.
        if (agent === null || msgSessionId !== sessionId) {
          sessionId = msgSessionId;
          agent = createAssistant({ sessionId, userId });
        }

        await handleUserMessage(agent, { request, sessionId, userId, send });
      } catch (err) {
        context.log.error({ err }, 'Error handling message');
        send({
          type: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          message: 'An error occurred while processing your request',
        });
      }
    });

    socket.on('close', () => {
      context.log.info({ sessionId }, 'WebSocket closed');
    });
  },
});

app.run();
