import { getFreshIdToken } from '@readysetcloud/ui/auth';
import { env } from '../auth/config';

// Fetches a presigned WebSocket URL from the backend. This is the function the
// chat hook injects as `getConnectionUrl`: it authenticates with a fresh id
// token (raw Authorization header, per the RSC convention) and returns the
// wss:// URL the browser connects to. The backend derives the user id from the
// verified token, so it is never trusted from the client.
export async function getConnectionUrl(sessionId?: string): Promise<string> {
  const token = await getFreshIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${env.apiBaseUrl}websocket/connect`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: token,
    },
    body: JSON.stringify(sessionId ? { sessionId } : {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to get presigned WebSocket URL: ${response.status}`);
  }

  const data = (await response.json()) as { wsUrl: string };
  return data.wsUrl;
}
