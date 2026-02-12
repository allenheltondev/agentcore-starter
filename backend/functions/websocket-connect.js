/**
 * WebSocket Connect Function
 *
 * Generates a presigned WebSocket URL for browser clients using AWS SigV4.
 * This follows the AWS-recommended approach for browser-based WebSocket connections
 * to AgentCore Runtime, where authentication is embedded in query parameters.
 *
 * Authentication flow:
 * 1. User authenticates with Cognito (JWT validated by API Gateway)
 * 2. This function generates AWS SigV4 presigned WebSocket URL
 * 3. Browser connects with presigned URL (no custom headers needed)
 * 4. User identity passed via session ID in the WebSocket messages
 */

import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { formatUrl } from '@aws-sdk/util-format-url';

export const handler = async (event) => {
    try {
        console.log('🔐 Presigned WebSocket URL request received');

        // Get authenticated user from Cognito authorizer
        const userClaims = event.requestContext?.authorizer?.claims;
        const userId = userClaims?.sub;
        const userEmail = userClaims?.email;

        console.log('👤 Authenticated user:', { userId, email: userEmail });

        const region = process.env.AWS_REGION;
        const runtimeArn = process.env.AGENT_RUNTIME_ARN;

        if (!runtimeArn) {
            throw new Error('AGENT_RUNTIME_ARN environment variable not set');
        }

        // Parse session ID from request body
        const body = JSON.parse(event.body || '{}');
        const sessionId = body.sessionId || crypto.randomUUID();

        console.log('📋 Session ID:', sessionId);

        // Construct WebSocket URL with URL-encoded ARN
        const encodedArn = encodeURIComponent(runtimeArn);
        const wsHost = `bedrock-agentcore.${region}.amazonaws.com`;
        const wsPath = `/runtimes/${encodedArn}/ws`;

        console.log('🔗 Base WebSocket path:', wsPath);

        // Get AWS credentials using the Lambda execution role
        const credentialsProvider = defaultProvider();
        const credentials = await credentialsProvider();

        console.log('✅ AWS credentials obtained');

        // Build query parameters including session ID and user ID
        const queryParams = {
            'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
        };

        // If we want to pass user ID as a custom header (accessible in agent)
        if (userId) {
            queryParams['X-Amzn-Bedrock-AgentCore-Runtime-Custom-User-Id'] = userId;
        }

        // Create HTTP request for presigning
        const request = new HttpRequest({
            method: 'GET',
            protocol: 'https:',
            hostname: wsHost,
            path: wsPath,
            headers: {
                'host': wsHost,
            },
            query: queryParams
        });

        // Sign the request with SigV4 using query auth (presigned URL style)
        const signer = new SignatureV4({
            service: 'bedrock-agentcore',
            region: region,
            credentials: credentials,
            sha256: Sha256
        });

        // Sign with expiration (5 minutes)
        const expiresIn = 300;
        const signedRequest = await signer.presign(request, {
            expiresIn: expiresIn,
            signingDate: new Date(),
        });

        // Convert to WebSocket URL
        const presignedHttpsUrl = formatUrl(signedRequest);
        const presignedWsUrl = presignedHttpsUrl.replace('https://', 'wss://');

        console.log('✅ Presigned WebSocket URL generated');
        console.log('   Session:', sessionId);
        console.log('   User:', userId);
        console.log('   Expires in:', expiresIn, 'seconds');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify({
                wsUrl: presignedWsUrl,
                sessionId: sessionId,
                userId: userId,
                expiresIn: expiresIn,
                message: 'Presigned WebSocket URL with AWS SigV4 authentication'
            })
        };

    } catch (error) {
        console.error('❌ Error generating presigned URL:', error);
        console.error('Error stack:', error.stack);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Failed to generate presigned WebSocket URL',
                details: error.message
            })
        };
    }
};
