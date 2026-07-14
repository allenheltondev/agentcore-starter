// Public API of the chat UI package (migrates into @readysetcloud/ui).

export { Chat, type ChatProps } from './components/Chat.js';
export { ChatMessage } from './components/ChatMessage.js';
export {
  useAgentChat,
  type UseAgentChat,
  type UseAgentChatOptions,
  type ChatMessage as ChatMessageData,
} from './useAgentChat.js';
export { WebSocketChatClient, type WebSocketChatClientOptions } from './WebSocketChatClient.js';
export type {
  ServerMessage,
  AgentStreamEventBody,
  ConnectionStatus,
  ServerMessageListener,
} from './protocol.js';
