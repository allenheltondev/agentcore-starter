// Client-side mirror of the agent wire protocol. The source of truth is
// @readysetcloud/agent (packages/agent/src/protocol.ts); this small copy keeps
// the UI package free of a build-time dependency on the agent package.

export interface AgentStreamEventBody {
  data?: string;
  current_tool_use?: { name: string; tool_use_id?: string };
  init_event_loop?: boolean;
  complete?: boolean;
}

export interface ServerMessage {
  type: 'stream_event' | 'complete' | 'error';
  event?: AgentStreamEventBody;
  session_id?: string;
  error?: string;
  message?: string;
}

export type ServerMessageListener = (message: ServerMessage) => void;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
