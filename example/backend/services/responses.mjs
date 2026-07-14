// API Gateway (proxy integration) response helpers. Mirrors the
// jsonResponse/emptyResponse convention from content-tracking's
// api/services/http-handler.mjs, trimmed to what the presigned-URL Lambda
// needs (no Powertools router — this is a single proxy function).

const CORS_HEADERS = {
  'access-control-allow-origin': process.env.CORS_ALLOWED_ORIGIN || '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    body: typeof body === 'string' ? JSON.stringify({ message: body }) : JSON.stringify(body),
  };
}
