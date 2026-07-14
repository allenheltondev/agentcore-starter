import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@readysetcloud/ui/auth';
import { Chat } from '@readysetcloud/ui-chat';
import { getConnectionUrl } from '../api/connection';

// Renders the streaming chat for a session. The chat components + WebSocket
// hook come entirely from @readysetcloud/ui-chat; this page only supplies the
// session id, the verified user id, and the presigned-URL fetcher.
export default function ChatPage() {
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Ensure a stable session id in the URL.
  useEffect(() => {
    if (!routeSessionId) {
      navigate(`/chat/${crypto.randomUUID()}`, { replace: true });
    }
  }, [routeSessionId, navigate]);

  const initialQuery = (location.state as { initialQuery?: string } | null)?.initialQuery;

  // Keep the Chat mounted stably per session id.
  const sessionId = useMemo(() => routeSessionId ?? '', [routeSessionId]);

  if (!sessionId) return null;

  return (
    <Chat
      title="AgentCore Chatbot"
      sessionId={sessionId}
      userId={user.sub}
      getConnectionUrl={getConnectionUrl}
      initialQuery={initialQuery}
    />
  );
}
