/**
 * WebSocket Connect Function
 *
 * Generates an AWS SigV4 presigned WebSocket URL so the browser can connect
 * directly to the AgentCore Runtime. This is the unchanged auth flow from the
 * original repo, ported to the shared logger/response conventions:
 *
 *   1. User authenticates with Cognito (JWT validated by API Gateway).
 *   2. This function signs a wss:// URL with the Lambda execution role (SigV4).
 *   3. The browser connects with the presigned URL (no custom headers needed).
 *   4. The verified user id rides along as a Custom-* query param, surfaced to
 *      the agent as the x-amzn-bedrock-agentcore-runtime-custom-user-id header.
 *
 * The SigV4 presign is hand-rolled (rather than pulling in the bedrock-agentcore
 * runtime SDK, which bundles Fastify) to keep this Lambda dependency-light.
 * Based on the official AWS bi-directional-streaming sample.
 */

import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { logger } from '../services/logger.mjs';
import { jsonResponse } from '../services/responses.mjs';

const EXPIRES_IN_SECONDS = 300;

/**
 * AWS-compatible URI escaping: encodeURIComponent plus !'()* per RFC 3986.
 */
function escapeUri(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Formats a signed HttpRequest into a URL string. SignatureV4.presign() stores
 * raw (unencoded) query values, so we encode keys and values here.
 */
function formatSignedUrl(request) {
  const { protocol, hostname, path, query } = request;
  const proto = protocol?.endsWith(':') ? protocol : `${protocol}:`;

  const parts = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    const encodedKey = escapeUri(key);
    if (Array.isArray(value)) {
      for (const v of value) parts.push(`${encodedKey}=${escapeUri(v)}`);
    } else if (value != null) {
      parts.push(`${encodedKey}=${escapeUri(value)}`);
    } else {
      parts.push(encodedKey);
    }
  }

  const queryString = parts.join('&');
  return `${proto}//${hostname}${path}${queryString ? `?${queryString}` : ''}`;
}

export const handler = async (event) => {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims?.sub;
    logger.appendKeys({ userId });
    logger.info('Presigned WebSocket URL request received');

    const region = process.env.AWS_REGION;
    const runtimeArn = process.env.AGENT_RUNTIME_ARN;
    if (!runtimeArn) {
      throw new Error('AGENT_RUNTIME_ARN environment variable is not set');
    }

    const body = JSON.parse(event.body || '{}');
    const sessionId = body.sessionId || crypto.randomUUID();

    // wss://bedrock-agentcore.<region>.amazonaws.com/runtimes/<arn>/ws
    // The ARN sits raw in the path; SigV4 handles canonical path encoding.
    const wsHost = `bedrock-agentcore.${region}.amazonaws.com`;
    const wsPath = `/runtimes/${runtimeArn}/ws`;

    const query = {
      qualifier: 'DEFAULT',
      'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
    };
    // Pass the verified user id to the agent as a custom header query param.
    if (userId) {
      query['X-Amzn-Bedrock-AgentCore-Runtime-Custom-User-Id'] = userId;
    }

    const request = new HttpRequest({
      method: 'GET',
      protocol: 'https:',
      hostname: wsHost,
      path: wsPath,
      headers: { host: wsHost },
      query,
    });

    const signer = new SignatureV4({
      service: 'bedrock-agentcore',
      region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });

    const signedRequest = await signer.presign(request, {
      expiresIn: EXPIRES_IN_SECONDS,
      signingDate: new Date(),
    });

    const wsUrl = formatSignedUrl(signedRequest).replace('https://', 'wss://');
    logger.info('Presigned WebSocket URL generated', { sessionId });

    return jsonResponse(200, {
      wsUrl,
      sessionId,
      userId,
      expiresIn: EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    logger.error('Failed to generate presigned WebSocket URL', {
      error: error?.message,
      stack: error?.stack,
    });
    return jsonResponse(500, {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate presigned WebSocket URL',
    });
  } finally {
    logger.resetKeys();
  }
};
